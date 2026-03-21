#!/usr/bin/env bash
# One-time SSL setup with Let's Encrypt
# Run on VPS: bash scripts/init-ssl.sh lumora.zilware.mu
#
# Prerequisites:
# 1. Domain DNS A record points to this server's IP
# 2. App is running (docker compose up)
# 3. Port 80 is open and reachable from the internet

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> e.g. lumora.zilware.mu}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "── SSL setup for $DOMAIN ─────────────────────────"
cd "$APP_DIR"

# Load env
[ -f .env.production ] && set -a && source .env.production && set +a

# Create dirs
mkdir -p certbot/webroot certbot/conf

# 1. Get certificate
echo "── Requesting certificate from Let's Encrypt ────"
docker run --rm \
  -v "$APP_DIR/certbot/webroot:/var/www/certbot" \
  -v "$APP_DIR/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "admin@$DOMAIN" \
  --agree-tos \
  --non-interactive

echo "── Certificate obtained ─────────────────────────"

# 2. Switch nginx to SSL config
sed "s/REPLACE_DOMAIN/$DOMAIN/g" nginx/default-ssl.conf > nginx/default-ssl-active.conf
cp nginx/default.conf nginx/default-http-backup.conf
cp nginx/default-ssl-active.conf nginx/default.conf

# 3. Restart nginx
docker compose -f docker-compose.prod.yml --env-file .env.production restart nginx

echo ""
echo "── Done! Update .env.production ──────────────────"
echo "  FRONTEND_URL=https://$DOMAIN"
echo "  BASE_URL=https://$DOMAIN"
echo ""
echo "Then restart backend to pick up new URLs:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production restart backend"
echo ""
