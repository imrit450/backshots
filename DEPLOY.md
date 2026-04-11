# Lumora — Ubuntu Server Deployment Guide

**Domain:** `lumora.zilware.mu`  
**Stack:** Docker Compose (PostgreSQL, Node backend, React frontend, nginx, Certbot)

---

## Prerequisites on the server

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

## 1. Copy the project to the server

From your local machine, rsync the project (excluding node_modules and local build artifacts):

```bash
rsync -avz --exclude='node_modules' \
            --exclude='.git' \
            --exclude='frontend/dist' \
            --exclude='backend/dist' \
            --exclude='scorer/__pycache__' \
  /e/Admin/Documents/Development/Backshots/ \
  your-user@lumora.zilware.mu:/opt/lumora/
```

Or clone from Git if you have it in a repo:

```bash
git clone <your-repo-url> /opt/lumora
cd /opt/lumora
```

---

## 2. Create the production env file

```bash
cd /opt/lumora
nano .env.production
```

Paste and fill in your values:

```env
# Database
POSTGRES_USER=lumora
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=lumora

# JWT — generate with: openssl rand -hex 64
JWT_SECRET=<64-char-hex>

# Clerk (copy from your Clerk dashboard → API Keys)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# URLs — use your actual domain
FRONTEND_URL=https://lumora.zilware.mu
BASE_URL=https://lumora.zilware.mu

# Storage (filesystem is simplest to start)
STORAGE_TYPE=filesystem

# Port nginx listens on (keep 80 for SSL cert acquisition)
APP_PORT=80
```

> **Tip:** Generate a strong JWT secret:
> ```bash
> openssl rand -hex 64
> ```

---

## 3. Configure nginx for your domain

### Step 3a — Point the nginx config to your domain

Edit the SSL config file:

```bash
nano /opt/lumora/nginx/default-ssl.conf
```

Replace both occurrences of `REPLACE_DOMAIN` with `lumora.zilware.mu`:

```nginx
ssl_certificate /etc/letsencrypt/live/lumora.zilware.mu/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/lumora.zilware.mu/privkey.pem;
```

Also update `server_name` in both server blocks:

```nginx
server_name lumora.zilware.mu;
```

---

## 4. Get the SSL certificate (Let's Encrypt)

**Phase 1 — Start nginx on HTTP only** so Certbot can complete the ACME challenge.

Make sure `nginx/default.conf` is the active config (it should be by default — it serves HTTP only). Then start only nginx and db:

```bash
cd /opt/lumora

# Create the certbot directories Certbot will write into
mkdir -p certbot/webroot certbot/conf

# Start nginx (HTTP only mode)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d nginx db
```

**Phase 2 — Issue the certificate:**

```bash
docker run --rm \
  -v /opt/lumora/certbot/webroot:/var/www/certbot \
  -v /opt/lumora/certbot/conf:/etc/letsencrypt \
  certbot/certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email admin@zilware.mu \
    --agree-tos \
    --no-eff-email \
    -d lumora.zilware.mu
```

If successful you'll see: `Congratulations! Your certificate and chain have been saved.`

**Phase 3 — Switch nginx to HTTPS mode:**

```bash
# Swap the config
cp /opt/lumora/nginx/default-ssl.conf /opt/lumora/nginx/default.conf
```

---

## 5. Launch the full stack

```bash
cd /opt/lumora
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This builds and starts:
- `db` — PostgreSQL 16
- `scorer` — Python BRISQUE image quality sidecar
- `backend` — Node/Express API (runs `prisma db push` on startup)
- `frontend` — React app served by nginx
- `nginx` — Reverse proxy with SSL
- `certbot` — Auto-renews the certificate every 12 hours

**Reload nginx to pick up the new upstream IPs:**

```bash
docker exec lumora-nginx-1 nginx -s reload
```

> The container name prefix may differ. Check with `docker ps` if the above fails.

---

## 6. Verify everything is up

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Check backend logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs backend --tail=50

# Hit the health endpoint
curl https://lumora.zilware.mu/health
# Expected: {"status":"ok","timestamp":"..."}
```

Open `https://lumora.zilware.mu` in your browser — you should see the Lumora landing page.

---

## 7. DNS record

In your DNS provider for `zilware.mu`, add an **A record**:

| Name | Type | Value |
|------|------|-------|
| `lumora` | A | `<your-server-public-IP>` |

TTL 300 is fine. Allow up to 10 minutes to propagate.

---

## Day-to-day operations

### Redeploy after a code update

```bash
cd /opt/lumora
git pull   # if using git

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker exec lumora-nginx-1 nginx -s reload
```

### View logs

```bash
# All services
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Specific service
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f scorer
```

### Restart a single service

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart backend
```

### Stop everything

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

### Database backup

```bash
docker exec lumora-db-1 pg_dump -U lumora lumora > backup_$(date +%Y%m%d).sql
```

---

## Firewall (ufw)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (needed for cert renewal)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `502 Bad Gateway` after deploy | `docker exec lumora-nginx-1 nginx -s reload` |
| Backend won't start | Check `docker logs lumora-backend-1` — likely a missing env var |
| Cert not found | Re-run the certbot command in step 4, check DNS is resolving |
| Uploads not persisting | Volumes are named Docker volumes — they survive `down` but not `down -v` |
| Scorer returning 500 | `docker logs lumora-scorer-1` — should self-heal on restart |
