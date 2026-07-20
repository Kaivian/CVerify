terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ==============================================================================
# VARIABLES DEFINITIONS
# ==============================================================================
variable "project_id" {
  type        = string
  description = "The GCP project ID"
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "zone" {
  type    = string
  default = "asia-southeast1-a"
}

variable "github_repository" {
  type        = string
  default     = "Kaivian/CVerify"
  description = "The GitHub repository owner/name for Workload Identity validation"
}

variable "vm_machine_type" {
  type    = string
  default = "e2-standard-2"
}

# ==============================================================================
# 1. GOOGLE ARTIFACT REGISTRY
# ==============================================================================
resource "google_artifact_registry_repository" "cverify_registry" {
  location      = var.region
  repository_id = "cverify"
  description   = "Docker container registry for CVerify services"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-release-versions"
    action = "KEEP"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["v"]
    }
  }

  cleanup_policies {
    id     = "delete-old-commits"
    action = "DELETE"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["sha-"]
      older_than   = "2592000s" # 30 days
    }
  }
}

# ==============================================================================
# 2. SECRET MANAGER
# ==============================================================================
resource "google_secret_manager_secret" "cverify_secrets" {
  secret_id = "cverify-production-secrets"
  replication {
    auto {}
  }
}

# ==============================================================================
# 3. WORKLOAD IDENTITY POOL & PROVIDER FOR GITHUB ACTIONS
# ==============================================================================
resource "google_iam_workload_identity_pool" "github_pool" {
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Identity Pool"
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"
  
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "attribute.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# ==============================================================================
# 4. SERVICE ACCOUNT & IAM BINDINGS FOR DEPLOYMENT
# ==============================================================================
resource "google_service_account" "deployer" {
  account_id   = "cverify-deployer"
  display_name = "GitHub Actions CI/CD Deployer Account"
}

# Service Account Permissions on Project Level
resource "google_project_iam_member" "gar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "iap_tunnel_user" {
  project = var.project_id
  role    = "roles/iap.tunnelResourceAccessor"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "compute_viewer" {
  project = var.project_id
  role    = "roles/compute.viewer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Grant IAM role to execute SSH commands on the compute instance
resource "google_project_iam_member" "compute_instance_admin" {
  project = var.project_id
  role    = "roles/compute.instanceAdmin.v1"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Allow GitHub Actions repository to assume the service account role
resource "google_service_account_iam_member" "github_sa_bind" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/${var.github_repository}"
}

# ==============================================================================
# 4.5 VM SERVICE ACCOUNT & IAM BINDINGS
# ==============================================================================
resource "google_service_account" "vm_sa" {
  account_id   = "cverify-prod-vm-sa"
  display_name = "CVerify Production VM Instance Service Account"
}

resource "google_project_iam_member" "vm_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_project_iam_member" "vm_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_artifact_registry_repository_iam_member" "vm_registry_reader" {
  location   = google_artifact_registry_repository.cverify_registry.location
  repository = google_artifact_registry_repository.cverify_registry.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "vm_secrets_accessor" {
  secret_id = google_secret_manager_secret.cverify_secrets.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_storage_bucket_iam_member" "vm_storage_viewer" {
  bucket = google_storage_bucket.metadata_bucket.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_service_account_iam_member" "deployer_sa_user" {
  service_account_id = google_service_account.vm_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# ==============================================================================
# 5. COMPUTE ENGINE VM INSTANCE
# ==============================================================================
resource "google_compute_instance" "app_server" {
  name         = "cverify-prod-vm"
  machine_type = var.vm_machine_type
  zone         = var.zone
  tags         = ["cverify-vm"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 50 # GB
    }
  }

  network_interface {
    network = "default"
    # Assign public IP, but restrict SSH access via IAP using firewall rules
    access_config {} 
  }

  service_account {
    email  = google_service_account.vm_sa.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e
    
    # Function to wait for apt locks
    wait_for_apt() {
      echo "Waiting for apt/dpkg locks..."
      while ! flock -n /var/lib/dpkg/lock-frontend -c "true" >/dev/null 2>&1 || ! flock -n /var/lib/apt/lists/lock -c "true" >/dev/null 2>&1; do
        echo "Apt lock held by another process, sleeping 5 seconds..."
        sleep 5
      done
      echo "Apt locks released."
    }

    # Wait for initial locks
    wait_for_apt
    
    # 1. Update system dependencies
    apt-get update
    wait_for_apt
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release jq git
    
    # 2. Add Docker repository and key
    mkdir -p /etc/apt/keyrings
    wait_for_apt
    if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    fi
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 3. Add Google Cloud SDK repository and install CLI
    if ! command -v gcloud &> /dev/null; then
      echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
      curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --yes --dearmor -o /usr/share/keyrings/cloud.google.gpg
      wait_for_apt
      apt-get update
      wait_for_apt
      apt-get install -y google-cloud-cli
    fi

    # 4. Install Docker Engine and Compose Plugin
    wait_for_apt
    apt-get update
    wait_for_apt
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # 5. Disable host Nginx service if installed to prevent port 80/443 conflicts
    if systemctl is-active --quiet nginx; then
      systemctl stop nginx
    fi
    if systemctl is-enabled --quiet nginx; then
      systemctl disable nginx
    fi

    # 6. Set up directory permissions and deployer user groups
    mkdir -p /app/cverify
    chown -R ubuntu:ubuntu /app/cverify
    usermod -aG docker ubuntu

    # 7. Set up logging directory and logrotate
    mkdir -p /var/log/cverify
    chown -R ubuntu:ubuntu /var/log/cverify

    cat <<'EOF' > /etc/logrotate.d/cverify
    /var/log/cverify/*.log {
        daily
        rotate 7
        compress
        delaycompress
        missingok
        notifempty
        create 0640 ubuntu ubuntu
    }
    EOF

    # 8. Create bootstrap completed marker
    echo "done" > /var/log/cverify-bootstrap-done
  EOT
}

# ==============================================================================
# 6. FIREWALL RULES
# ==============================================================================
# Allow SSH access *only* via GCP IAP tunnel IP range
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "allow-ssh-ingress-from-iap"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"] # Google Identity-Aware Proxy (IAP) range
  target_tags   = ["cverify-vm"]
}

# Allow public HTTP and HTTPS access (Nginx routes traffic to client/core)
resource "google_compute_firewall" "allow_web" {
  name    = "allow-http-https-ingress"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["cverify-vm"]
}

# ==============================================================================
# 6. STORAGE BUCKET FOR BUILD METADATA MANIFESTS
# ==============================================================================
resource "google_storage_bucket" "metadata_bucket" {
  name                        = "cverify-build-metadata-${var.project_id}"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

resource "google_storage_bucket_iam_member" "deployer_storage_admin" {
  bucket = google_storage_bucket.metadata_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deployer.email}"
}
