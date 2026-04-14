# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy entire workspace so npm ci can resolve all workspaces correctly
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all deps (hoists devDeps like typescript & vite to /app/node_modules)
RUN npm ci

# Ensure hoisted binaries are on PATH for ALL run commands
ENV PATH="/app/node_modules/.bin:/app/frontend/node_modules/.bin:${PATH}"

# Copy frontend source
COPY frontend/ ./frontend/

# Build — tsc and vite are now on PATH regardless of where npm hoisted them
RUN cd frontend && tsc && vite build

# ── Stage 2: Serve with nginx ────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
