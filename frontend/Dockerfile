# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy entire workspace so npm ci can resolve all workspaces correctly
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all deps (hoists devDeps like typescript & vite to /app/node_modules)
RUN npm ci

# Copy frontend source
COPY frontend/ ./frontend/

# Build via the workspace's own build script (tsc && vite build).
# npm run --workspace resolves node_modules/.bin automatically.
RUN npm run build --workspace=frontend

# ── Stage 2: Serve with nginx ────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
