# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files + frontend package
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Install all workspace deps (including devDependencies needed for tsc + vite)
RUN npm ci --include-workspace-root

# Copy source and build
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# ── Stage 2: Serve with nginx ────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
