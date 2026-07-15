#!/bin/bash
# ==============================================================================
# CVerify SSL Certificate Setup Script (Let's Encrypt via Certbot)
# ==============================================================================
# Usage: sudo ./setup-ssl.sh <domain>
# Example: sudo ./setup-ssl.sh cverify.io.vn
# ==============================================================================
set -e

# Logging colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

write_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
write_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
write_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
write_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Parse arguments
DOMAIN="${1}"

if [ -z "$DOMAIN" ]; then
  write_error "Domain parameter is required."
  echo "Usage: sudo $0 <domain>"
  echo "Example: sudo $0 cverify.io.vn"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  write_error "This script must be run as root (use sudo)."
  exit 1
fi

write_info "Starting SSL setup for domain: $DOMAIN"

# 2. Install Certbot
write_info "Installing Certbot..."
if command -v certbot &>/dev/null; then
  write_info "Certbot already installed: $(certbot --version 2>&1)"
else
  apt-get update -qq
  apt-get install -y certbot 2>&1
  write_success "Certbot installed successfully."
fi

# 3. Create ACME webroot directory for future renewals
mkdir -p /var/www/certbot

# 4. Check if certificate already exists
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  write_warning "Certificate for $DOMAIN already exists."
  echo "  Expiry: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem)"
  read -p "Do you want to force renewal? (y/N): " FORCE_RENEW
  if [ "$FORCE_RENEW" != "y" ] && [ "$FORCE_RENEW" != "Y" ]; then
    write_info "Skipping certificate acquisition. Proceeding to Nginx restart..."
    # Jump to nginx restart
    SKIP_CERT=true
  fi
fi

if [ "$SKIP_CERT" != "true" ]; then
  # 5. Stop Nginx to free port 80 for standalone mode
  write_info "Stopping Nginx container to free port 80..."
  if docker ps --format '{{.Names}}' | grep -q nginx-proxy; then
    docker stop nginx-proxy
    write_success "Nginx container stopped."
  else
    write_info "Nginx container not running — port 80 is free."
  fi

  # 6. Obtain SSL certificate using standalone mode
  write_info "Requesting SSL certificate from Let's Encrypt..."
  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --domain "$DOMAIN" \
    --preferred-challenges http

  if [ $? -eq 0 ]; then
    write_success "SSL certificate obtained successfully!"
    echo "  Certificate: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    echo "  Private Key: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
  else
    write_error "Failed to obtain SSL certificate. Check DNS and firewall settings."
    # Restart Nginx on HTTP-only mode
    write_warning "Restarting Nginx in HTTP-only mode..."
    docker start nginx-proxy 2>/dev/null || true
    exit 1
  fi
fi

# 7. Restart Nginx with SSL-enabled configuration
write_info "Starting Nginx with SSL configuration..."
cd /app/cverify
docker compose -f docker/compose.nginx.yml up -d
write_success "Nginx restarted with SSL support."

# 8. Setup automatic certificate renewal via systemd timer
write_info "Configuring automatic certificate renewal..."

# Create the renewal service unit
cat <<'UNIT' > /etc/systemd/system/certbot-renew.service
[Unit]
Description=Let's Encrypt Certificate Renewal
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --webroot --webroot-path=/var/www/certbot --deploy-hook "docker exec nginx-proxy nginx -s reload"
UNIT

# Create the renewal timer unit (twice daily, standard certbot practice)
cat <<'TIMER' > /etc/systemd/system/certbot-renew.timer
[Unit]
Description=Run Certbot renewal check twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer

write_success "Automatic renewal timer configured (runs twice daily)."

# 9. Verify
write_info "Running verification checks..."

# Check cert files exist
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  write_success "Certificate file exists."
  EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" | cut -d= -f2)
  echo "  Expires: $EXPIRY"
else
  write_error "Certificate file not found!"
  exit 1
fi

# Check Nginx is running
if docker ps --format '{{.Names}}' | grep -q nginx-proxy; then
  write_success "Nginx container is running."
else
  write_error "Nginx container is not running!"
  exit 1
fi

# Check HTTPS responds
sleep 2
HTTP_CODE=$(curl -sk -o /dev/null -w '%{http_code}' "https://${DOMAIN}/nginx-health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  write_success "HTTPS is responding (HTTP $HTTP_CODE)."
else
  write_warning "HTTPS health check returned HTTP $HTTP_CODE (may need upstream services running)."
fi

# Check HTTP redirect
HTTP_REDIRECT=$(curl -sk -o /dev/null -w '%{http_code}' "http://${DOMAIN}/" 2>/dev/null || echo "000")
if [ "$HTTP_REDIRECT" = "301" ]; then
  write_success "HTTP → HTTPS redirect is working (HTTP 301)."
else
  write_warning "HTTP redirect returned HTTP $HTTP_REDIRECT (expected 301)."
fi

echo ""
write_success "=========================================="
write_success "  SSL setup complete for $DOMAIN"
write_success "=========================================="
echo ""
echo "  HTTPS URL: https://${DOMAIN}"
echo "  Cert Path: /etc/letsencrypt/live/${DOMAIN}/"
echo "  Renewal:   systemctl status certbot-renew.timer"
echo ""
