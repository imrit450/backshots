# Lumora — Production Deployment Guide

**Domain:** `lumora.zilware.mu`  
**Stack:** Docker Compose (PostgreSQL, Node backend, React frontend) + host nginx + host Certbot  
**Assumes:** Ubuntu server already running nginx with other sites

---

## Architecture overview

```
Internet
   │
   ▼
Host nginx (port 80/443)           ← shared with your other sites
   ├── lumora.zilware.mu → 127.0.0.1:3001  (Lumora backend)
   │                     → 127.0.0.1:8080  (Lumora frontend)
   └── yourother.site   → ...

Docker Compose (internal only)
   ├── db       (PostgreSQL, internal)
   ├── scorer   (image quality sidecar, internal)
   ├── backend  → 127.0.0.1:3001
   └── frontend → 127.0.0.1:8080
```

Nginx and SSL run on the host — Docker does not bind to port 80 or 443, so it does not conflict with your other sites.

---

## Prerequisites

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Install Certbot (if not already installed)
sudo apt install -y certbot python3-certbot-nginx

# Verify
docker --version
docker compose version
nginx -v
certbot --version
```

---

## Step 1 — Clone the project

Fix permissions on the target directory, then clone:

```bash
sudo mkdir -p /opt/lumora
sudo chown -R $USER:$USER /opt/lumora

git clone https://<YOUR_GITHUB_TOKEN>@github.com/imrit450/backshots.git /opt/lumora
cd /opt/lumora
```

> Generate a GitHub personal access token at: GitHub → Settings → Developer settings → Personal access tokens  
> Make sure the token has the **repo** scope.

---

## Step 2 — Create the environment file

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
```

Generate a strong JWT secret:

```bash
openssl rand -hex 64
```

---

## Step 3 — Add the nginx site config

Copy the site config into nginx's sites-available and enable it:

```bash
sudo cp /opt/lumora/nginx/lumora.zilware.mu.conf /etc/nginx/sites-available/lumora.zilware.mu
sudo ln -s /etc/nginx/sites-available/lumora.zilware.mu /etc/nginx/sites-enabled/

# Verify the config is valid (this checks all enabled sites, not just Lumora)
sudo nginx -t

# Reload nginx to activate the new site
sudo systemctl reload nginx
```

The config routes:
- `/v1/` and `/uploads/` and `/exports/` → backend on `127.0.0.1:3001`
- Everything else → frontend on `127.0.0.1:8080`

---

## Step 4 — Issue the SSL certificate

The `--nginx` plugin handles the ACME challenge and SSL config automatically — no webroot setup needed.

```bash
sudo certbot --nginx \
  --email admin@zilware.mu \
  --agree-tos \
  --no-eff-email \
  -d lumora.zilware.mu
```

If successful you'll see: `Congratulations! Your certificate and chain have been saved.`

Reload nginx to activate HTTPS:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Auto-renewal is handled by the certbot systemd timer that ships with the package:

```bash
# Verify the timer is active
systemctl status certbot.timer
```

---

## Step 5 — Launch the app

```bash
cd /opt/lumora
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This builds and starts:
- `db` — PostgreSQL 16 (internal only)
- `scorer` — Python BRISQUE image quality sidecar (internal only)
- `backend` — Node/Express API, exposed on `127.0.0.1:3001`
- `frontend` — React app, exposed on `127.0.0.1:8080`

Wait ~30 seconds for the backend to run `prisma db push` on first boot.

---

## Step 6 — Verify

```bash
# Check all containers are running
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Check backend logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs backend --tail=50

# Health check
curl https://lumora.zilware.mu/health
# Expected: {"status":"ok","timestamp":"..."}
```

Open `https://lumora.zilware.mu` in your browser.

---

## Step 7 — DNS record

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
git pull

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
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
sudo ufw allow 80/tcp    # HTTP (needed for cert renewal ACME challenge)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `502 Bad Gateway` | Docker containers not running — `docker compose ... ps` and `... up -d` |
| Backend won't start | `docker compose ... logs backend` — likely a missing env var in `.env.production` |
| Cert not found / SSL error | Re-run certbot command in Step 4, check DNS is resolving first |
| Port already in use on docker up | Another service owns 3001 or 8080 — change the host port in `docker-compose.prod.yml` and update the nginx config to match |
| Uploads not persisting | Volumes are named Docker volumes — they survive `down` but not `down -v` |
| Scorer returning 500 | `docker compose ... logs scorer` — should self-heal on restart |
| nginx config test fails | `sudo nginx -t` will show which file has the error |
