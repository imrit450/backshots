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

## 4. Install nginx config on the host

Since other sites already run on this server, Lumora uses the **host nginx** for SSL termination. Docker only exposes the backend and frontend on localhost ports.

```bash
# Copy the site config
sudo cp /opt/lumora/nginx/lumora.zilware.mu.conf /etc/nginx/sites-available/lumora.zilware.mu
sudo ln -s /etc/nginx/sites-available/lumora.zilware.mu /etc/nginx/sites-enabled/

# Test and reload (HTTP only for now — SSL cert not yet issued)
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Get the SSL certificate (Let's Encrypt)

Certbot runs on the host (not in Docker) using the nginx plugin:

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot certonly --webroot \
  -w /var/www/certbot \
  --email admin@zilware.mu \
  --agree-tos \
  --no-eff-email \
  -d lumora.zilware.mu
```

> If `/var/www/certbot` doesn't exist: `sudo mkdir -p /var/www/certbot`

Once the cert is issued, reload nginx to pick up HTTPS:

```bash
sudo systemctl reload nginx
```

Auto-renewal is handled by the certbot systemd timer that ships with the package (`systemctl status certbot.timer`).

---

## 6. Launch the app stack

```bash
cd /opt/lumora
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This builds and starts:
- `db` — PostgreSQL 16
- `scorer` — Python BRISQUE image quality sidecar
- `backend` — Node/Express API on `127.0.0.1:3001`
- `frontend` — React app on `127.0.0.1:8080`

The host nginx proxies `lumora.zilware.mu` → those two ports.

---

## 7. Verify everything is up

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
