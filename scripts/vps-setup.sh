#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════
#  Backshots VPS Setup Script
#  Run this ONCE on a fresh Ubuntu/Debian VPS to prepare
#  for automated deployments.
#
#  Usage:  ssh root@your-server 'bash -s' < scripts/vps-setup.sh
# ═══════════════════════════════════════════════════════

REPO_URL="${1:?Usage: $0 <github-repo-url>}"
APP_DIR="${2:-/home/deploy/backshots}"
DEPLOY_USER="deploy"

echo "── 1. System packages ──────────────────────────"
apt-get update -y
apt-get install -y curl git ufw

echo "── 2. Install Docker ─────────────────────────────"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

echo "── 3. Create deploy user ─────────────────────────"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  # Copy SSH keys from root so GitHub Actions can connect
  mkdir -p /home/$DEPLOY_USER/.ssh
  cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
  chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
  chmod 700 /home/$DEPLOY_USER/.ssh
  chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
fi

echo "── 4. Firewall ───────────────────────────────────"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "── 5. Clone repository ───────────────────────────"
sudo -u "$DEPLOY_USER" bash -c "
  if [ ! -d '$APP_DIR' ]; then
    git clone '$REPO_URL' '$APP_DIR'
  fi
"

echo "── 6. Create production env file ─────────────────"
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  PG_PASSWORD=$(openssl rand -hex 16)
  cat > "$ENV_FILE" <<ENVEOF
# ── Production Environment ──────────────────────
POSTGRES_USER=backshots
POSTGRES_PASSWORD=$PG_PASSWORD
POSTGRES_DB=backshots
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=http://$(hostname -I | awk '{print $1}')
BASE_URL=http://$(hostname -I | awk '{print $1}')
STORAGE_TYPE=filesystem
# APP_PORT=80
ENVEOF
  chown $DEPLOY_USER:$DEPLOY_USER "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE with generated secrets"
  echo "IMPORTANT: Edit this file to set your domain, S3 keys, etc."
else
  echo "$ENV_FILE already exists, skipping"
fi

echo "── 7. Initial deploy ─────────────────────────────"
sudo -u "$DEPLOY_USER" bash -c "
  cd '$APP_DIR'
  set -a; source .env.production; set +a
  docker compose -f docker-compose.prod.yml build
  docker compose -f docker-compose.prod.yml up -d
"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  App dir:     $APP_DIR"
echo "  Env file:    $APP_DIR/.env.production"
echo "  Deploy user: $DEPLOY_USER"
echo ""
echo "  Next steps:"
echo "  1. Edit $APP_DIR/.env.production with your domain + S3 keys"
echo "  2. Add GitHub secrets (see README):"
echo "     - VPS_HOST, VPS_USER (deploy), VPS_SSH_KEY, APP_DIR"
echo "  3. Push to main -> auto deploys!"
echo "═══════════════════════════════════════════════════"
