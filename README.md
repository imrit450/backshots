# Lumora - Event Photo Capture System

Lumora is an event photo capture platform where hosts create events, share QR codes, and guests capture photos instantly without installing an app.

## Architecture

- **Backend**: Express + TypeScript + Prisma (SQLite dev / PostgreSQL prod)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Image Processing**: Sharp (thumbnails, large derivatives, EXIF stripping)
- **Auth**: JWT tokens for hosts and guests
- **Storage**: Local filesystem (dev), S3-compatible (prod)

## Run the App (Docker Compose)

This repo is set up to run via the **Docker Compose production stack** (nginx + backend + frontend + postgres).

### Prerequisites

- Docker Desktop running
- `docker` / `docker compose` available

### Command

From the repo root (`Lumora/`):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Access

- App UI: `http://localhost:3000`

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Install all dependencies
npm install

# Generate Prisma client and push schema
npm run db:push

# Seed demo data
npm run db:seed

# Start development servers (backend + frontend)
npm run dev
```

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Demo Login**: demo@lumora.app / demo1234

## Project Structure

```
Lumora/
├── backend/               # Express API server
│   ├── prisma/            # Database schema & migrations
│   ├── src/
│   │   ├── middleware/    # Auth, rate limiting, error handling
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic (media processing)
│   │   └── utils/         # Helpers (QR generation, visibility)
│   └── tests/             # Unit & integration tests
├── frontend/              # React SPA
│   └── src/
│       ├── api/           # API client
│       ├── components/    # Shared components
│       ├── hooks/         # Custom hooks (auth, camera)
│       ├── host/          # Host dashboard pages
│       └── guest/         # Guest experience pages
├── uploads/               # Photo storage (dev)
└── exports/               # ZIP exports (dev)
```

## User Flows

### Host Flow
1. Sign up / Log in
2. Create event with settings (title, reveal delay, photo limits, moderation mode)
3. Share QR code / link with guests
4. Moderate photos (approve/reject, hide/unhide)
5. View gallery, dashboard stats
6. Export approved photos as ZIP

### Guest Flow
1. Scan QR code or open link
2. Enter optional display name
3. Camera opens immediately
4. Capture photo -> Preview -> Submit
5. Take more photos or view gallery

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /v1/auth/host/signup | Host registration |
| POST | /v1/auth/host/login | Host login |
| GET | /v1/auth/host/me | Get host profile |
| POST | /v1/events | Create event |
| GET | /v1/events | List host events |
| GET | /v1/events/:id | Get event details |
| PATCH | /v1/events/:id | Update event settings |
| GET | /v1/events/:id/qr | Get QR code |
| GET | /v1/events/:code/public | Get public event info |
| POST | /v1/events/:code/guest-sessions | Create guest session |
| POST | /v1/events/:id/photos/upload | Upload photo (guest) |
| GET | /v1/events/:id/photos | List photos (host) |
| PATCH | /v1/events/:id/photos/:photoId | Moderate photo |
| GET | /v1/events/:code/gallery | Guest gallery |
| GET | /v1/events/:id/stats | Dashboard stats |
| POST | /v1/events/:id/exports | Create ZIP export |
| GET | /v1/events/:id/exports/:exportId | Check export status |

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## Key Features

- **QR-based guest entry**: No app install needed
- **Camera-first UI**: Guests open directly to camera
- **Reveal delay**: Photos hidden until configured time
- **Per-guest limits**: Server-enforced photo limits
- **Moderation**: Auto-approve or manual review modes
- **Hide/unhide**: Quiet removal from guest gallery
- **ZIP export**: Download all approved photos
- **Privacy**: EXIF data stripped from uploads
- **Rate limiting**: Upload and auth rate limits
- **Responsive**: Mobile-first design

## Configuration

Copy `.env.example` to `.env` and adjust values. See the file for all available options.

### Object Storage (S3-compatible)

For production, use S3-compatible object storage instead of the local filesystem. Supports **AWS S3**, **Cloudflare R2**, **MinIO**, **DigitalOcean Spaces**, etc. See `.env.example` for all S3 config options.

---

## Deployment (CI/CD)

The project uses **GitHub Actions** for CI and **Docker Compose** for production deployment to a VPS.

### How it works

```
Push to main  →  GitHub Actions  →  Test & Build  →  SSH to VPS  →  Pull & Rebuild containers
```

### Architecture (Production)

| Container  | Role                                             |
|------------|--------------------------------------------------|
| `nginx`    | Reverse proxy — routes `/v1/*` to backend, everything else to frontend |
| `backend`  | Express API (Node.js)                            |
| `frontend` | Static React build served by nginx               |
| `db`       | PostgreSQL 16                                    |

### One-time VPS setup

1. **Get a VPS** (Ubuntu 22.04+ recommended) — DigitalOcean, Hetzner, AWS EC2, etc.

2. **Run the setup script** from your local machine:

```bash
ssh root@your-server 'bash -s' < scripts/vps-setup.sh https://github.com/YOUR_USER/lumora.git
```

This installs Docker, creates a `deploy` user, clones the repo, generates secrets, and starts the app.

3. **Edit the production env file** on the server:

```bash
ssh deploy@your-server
nano ~/lumora/.env.production
```

Set your domain, S3 keys, etc. Then restart:

```bash
cd ~/lumora
set -a; source .env.production; set +a
docker compose -f docker-compose.prod.yml up -d
```

### GitHub Secrets

Add these in your GitHub repo → Settings → Secrets and variables → Actions:

| Secret         | Value                          |
|----------------|--------------------------------|
| `VPS_HOST`     | Your server IP or domain       |
| `VPS_USER`     | `deploy`                       |
| `VPS_SSH_KEY`  | Private SSH key for deploy user|
| `VPS_PORT`     | SSH port (default: 22)         |
| `APP_DIR`      | `/home/deploy/lumora`       |

### Generate an SSH key for deployments

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
# Copy public key to server
ssh-copy-id -i deploy_key.pub deploy@your-server
# Add the private key content as VPS_SSH_KEY secret in GitHub
cat deploy_key
```

**VPS_SSH_KEY tips:** Paste the *entire* private key including the `-----BEGIN ... KEY-----` and `-----END ... KEY-----` lines. No extra spaces. If you see "ssh: no key found" in CI, re-create the secret and ensure newlines are preserved.

### Manual deploy (without CI)

SSH into your server and run:

```bash
cd ~/lumora
git pull origin main
set -a; source .env.production; set +a
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Local development with PostgreSQL

Since production uses PostgreSQL, local dev now does too:

```bash
# Start a local PostgreSQL container
docker compose -f docker-compose.dev.yml up -d

# Then run the app as usual
npm install
npm run db:push
npm run dev
```

Your `.env` should have:
```
DATABASE_URL="postgresql://lumora:lumora_dev@localhost:5432/lumora?schema=public"
```

### Adding SSL (HTTPS) with Let's Encrypt

1. **Point your domain to the VPS** — Add an A record: `lumora.zilware.mu` → your server IP.

2. **Ensure the app is running** — `docker compose -f docker-compose.prod.yml up -d`

3. **Run the SSL init script** on the VPS:
   ```bash
   cd ~/lumora
   bash scripts/init-ssl.sh lumora.zilware.mu
   ```

4. **Update `.env.production`** with your HTTPS URLs:
   ```
   FRONTEND_URL=https://lumora.zilware.mu
   BASE_URL=https://lumora.zilware.mu
   ```

5. **Restart the backend** so it uses the new URLs:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

Certificates auto-renew every 12 hours via the certbot container.
