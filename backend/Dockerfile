# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy ONLY the backend package.json (no workspace root — standalone install)
COPY backend/package.json ./

# Install all deps (including devDeps like typescript)
RUN npm install

# Generate Prisma client
COPY backend/prisma ./prisma/
RUN npx prisma generate --schema=prisma/schema.prisma

# Build TypeScript
COPY backend/tsconfig.json ./
COPY backend/src ./src/
RUN npx tsc

# ── Stage 2: Production ──────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

# Install only production deps
COPY backend/package.json ./

RUN npm install --omit=dev

COPY backend/prisma ./prisma/
RUN npx prisma generate --schema=prisma/schema.prisma

COPY --from=builder /app/dist ./dist/
COPY backend/scripts ./scripts/

RUN mkdir -p /app/uploads/originals /app/uploads/thumbnails /app/uploads/large /app/exports

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
