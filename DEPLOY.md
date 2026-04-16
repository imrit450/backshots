# Deployment Guide — Ubuntu VPS

## Architecture

```
Internet
    │
    ▼
 Nginx (host)  :80 / :443
    ├── /v1/*    →  127.0.0.1:3001  (backend container)
    ├── /uploads/ →  127.0.0.1:3001
    ├── /exports/ →  127.0.0.1:3001
    └── /*       →  127.0.0.1:8080  (frontend container)

Docker Compose (prod)
    ├── backend   — Express API, Prisma, port 3001
    ├── frontend  — React SPA served by nginx:alpine, port 8080
    ├── db        — PostgreSQL 16
    └── scorer    — Python image scoring service, port 5001
```

Nginx runs on the **host** (not in Docker). Containers bind only to `127.0.0.1` so they are not exposed directly to the internet.

---

## Server Requirements

| Requirement | Minimum             |
|-------------|---------------------|
| OS          | Ubuntu 22.04 LTS    |
| RAM         | 1 GB                |
| Disk        | 20 GB               |
| Ports       | 22 (SSH), 80, 443   |

---

## 1. One-Time Server Setup

Run from your local machine. This installs Docker, creates a `deploy` user, opens the firewall, clones the repo, and generates secrets.

```bash
ssh root@YOUR_SERVER_IP 'bash -s' < scripts/vps-setup.sh https://github.com/YOUR_USER/lumora.git
```

The script:
- Installs Docker and Git
- Creates a `deploy` user in the `docker` group
- Configures UFW (ports 22, 80, 443)
- Clones the repo to `/home/deploy/lumora`
- Generates `/home/deploy/lumora/.env.production` with random secrets
- Runs the initial Docker build and brings containers up

### Install host Nginx

```bash
sudo apt install -y nginx
```

### Configure Nginx for your domain

```bash
# Copy the site config (adjust domain name as needed)
sudo cp /home/deploy/lumora/nginx/lumora.zilware.mu.conf \
        /etc/nginx/sites-available/your-domain.conf

# Edit the file to replace lumora.zilware.mu with your actual domain
sudo nano /etc/nginx/sites-available/your-domain.conf

# Enable the site
sudo ln -s /etc/nginx/sites-available/your-domain.conf \
           /etc/nginx/sites-enabled/

# Verify and reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. Environment Configuration

Edit the production env file on the server:

```bash
ssh deploy@YOUR_SERVER_IP
nano ~/lumora/.env.production
```

### Required variables

```bash
# Database
POSTGRES_USER=lumora
POSTGRES_PASSWORD=<generated — keep as-is or set your own>
POSTGRES_DB=lumora

# Auth
JWT_SECRET=<generated — keep as-is or set your own>

# Clerk (if using Clerk auth)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# URLs (update once you have a domain)
FRONTEND_URL=https://your-domain.com
BASE_URL=https://your-domain.com

# Storage
STORAGE_TYPE=filesystem   # or 's3' for object storage
```

### Optional — S3-compatible object storage

```bash
STORAGE_TYPE=s3
S3_BUCKET=your-bucket
S3_REGION=auto
S3_PUBLIC_URL=https://your-cdn.example.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://...          # omit for AWS S3
S3_FORCE_PATH_STYLE=false        # set true for MinIO
```

---

## 3. First Deploy

```bash
ssh deploy@YOUR_SERVER_IP
cd ~/lumora
set -a; source .env.production; set +a
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Verify containers are healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output — all services should show `healthy` or `running`:

```
NAME        STATUS
db          running (healthy)
scorer      running (healthy)
backend     running (healthy)
frontend    running
```

---

## 4. SSL with Let's Encrypt

### Prerequisites
- DNS A record for your domain points to the server IP
- Nginx is running and serving HTTP on port 80
- Containers are up (certbot uses the ACME webroot challenge)

### Obtain a certificate

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot \
  -w /var/www/html \
  -d your-domain.com \
  --email admin@your-domain.com \
  --agree-tos \
  --non-interactive
```

> If your nginx config uses a different webroot path for ACME challenges, adjust `-w` accordingly (the `lumora.zilware.mu.conf` serves `/.well-known/acme-challenge/` from `/var/www/certbot`).

### Activate the SSL nginx config

The nginx config at `nginx/lumora.zilware.mu.conf` already includes both HTTP→HTTPS redirect and the HTTPS server block. Certbot writes certs to `/etc/letsencrypt/live/<domain>/`. Verify the paths match the `ssl_certificate` directives in your nginx config.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Update env URLs

```bash
nano ~/lumora/.env.production
# Set:
#   FRONTEND_URL=https://your-domain.com
#   BASE_URL=https://your-domain.com
```

Restart the backend to pick up new URLs:

```bash
cd ~/lumora
docker compose -f docker-compose.prod.yml restart backend
```

### Auto-renewal

Certbot installs a systemd timer by default. Verify:

```bash
sudo systemctl status certbot.timer
```

Add a reload hook so nginx picks up renewed certs:

```bash
sudo bash -c 'echo -e "#!/bin/sh\nnginx -s reload" > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh'
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 5. CI/CD — GitHub Actions

Pushes to `main` automatically deploy to the VPS.

### GitHub Secrets

Add these in: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret        | Value                                           |
|---------------|-------------------------------------------------|
| `VPS_HOST`    | Server IP or domain                             |
| `VPS_USER`    | `deploy`                                        |
| `VPS_SSH_KEY` | Private key content (see below)                 |
| `VPS_PORT`    | `22` (or your SSH port)                         |
| `APP_DIR`     | `/home/deploy/lumora`                           |

### Generate a deploy SSH key pair

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
```

Copy the public key to the server:

```bash
ssh-copy-id -i deploy_key.pub deploy@YOUR_SERVER_IP
```

Add the **private key** (`deploy_key`) as the `VPS_SSH_KEY` secret in GitHub — paste the full contents including the `-----BEGIN` and `-----END` lines.

---

## 6. Manual Deploy

SSH into the server and run:

```bash
ssh deploy@YOUR_SERVER_IP
cd ~/lumora
git pull origin main
set -a; source .env.production; set +a
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## 7. Common Operations

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Single service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f scorer
```

### Restart a service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Stop everything

```bash
docker compose -f docker-compose.prod.yml down
```

### Database shell

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U lumora -d lumora
```

### Check disk usage (uploads/exports volumes)

```bash
docker system df
docker volume inspect lumora_uploads
```

---

## 8. Troubleshooting

### Containers not starting

```bash
docker compose -f docker-compose.prod.yml logs db
docker compose -f docker-compose.prod.yml logs backend
```

Check that `.env.production` has all required variables set (no empty `?`-required values).

### Nginx 502 Bad Gateway

The backend or frontend container is not up. Check container status:

```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:3001/v1/health
curl -s http://127.0.0.1:8080
```

### SSL certificate errors

```bash
sudo certbot certificates        # list certs and expiry
sudo certbot renew --dry-run     # test renewal
sudo nginx -t                    # verify nginx config syntax
```

### Disk full — clear old Docker layers

```bash
docker system prune -f
docker image prune -f
```
