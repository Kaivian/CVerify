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
  secret_id = "cverify-prod-secrets"
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
    "google.subject"       = "assertion.subject"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}'"

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
  role               = "roles/iam.serviceAccountUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/${var.github_repository}"
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

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e
    
    # 1. Update system dependencies
    apt-get update
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release nginx jq git
    
    # 2. Add Docker repository and key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 3. Install Docker Engine and Compose Plugin
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # 4. Set up deployer user and directory permissions
    mkdir -p /app/cverify
    chown -R ubuntu:ubuntu /app/cverify
    usermod -aG docker ubuntu
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
