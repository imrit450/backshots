# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files + backend package
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install only backend workspace deps
RUN npm ci --workspace=backend --include-workspace-root

# Generate Prisma client
COPY backend/prisma ./backend/prisma/
RUN npx prisma generate --schema=backend/prisma/schema.prisma

# Build TypeScript
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/
RUN npm run build --workspace=backend

# ── Stage 2: Production ──────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

RUN npm ci --workspace=backend --include-workspace-root --omit=dev

COPY backend/prisma ./backend/prisma/
RUN npx prisma generate --schema=backend/prisma/schema.prisma

COPY --from=builder /app/backend/dist ./backend/dist/
COPY backend/scripts ./backend/scripts/

RUN mkdir -p /app/uploads/originals /app/uploads/thumbnails /app/uploads/large /app/exports

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
