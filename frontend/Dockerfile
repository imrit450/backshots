# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy ONLY the frontend package.json (no workspace root — standalone install)
COPY frontend/package.json ./

# Install deps directly — no workspace hoisting confusion
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Vite bakes VITE_* vars into the bundle at build time — pass via --build-arg
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN npm run build

# ── Stage 2: Serve with nginx ────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
