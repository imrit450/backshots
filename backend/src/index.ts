import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';

import authRoutes from './routes/auth';
import googleAuthRoutes from './routes/googleAuth';
import adminRoutes from './routes/admin';
import eventRoutes from './routes/events';
import guestRoutes from './routes/guests';
import photoRoutes from './routes/photos';
import galleryRoutes from './routes/gallery';
import moderationRoutes from './routes/moderation';
import exportRoutes from './routes/exports';
import videoRoutes from './routes/videos';
import memoriesRoutes from './routes/memories';
import { initRuntimeConfig } from './services/runtimeConfig';

export const prisma = new PrismaClient();

const app = express();

// Trust proxy (ngrok, reverse proxies set X-Forwarded-For)
app.set('trust proxy', 1);

// CORS: allow frontend origin and common variants
function corsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  const allowed = [
    config.frontendUrl,
    config.baseUrl,
    'http://localhost:5173',
    'http://localhost:3001',
  ];
  // Add http/https flip of configured URLs
  for (const u of [config.frontendUrl, config.baseUrl]) {
    if (u.startsWith('https://')) allowed.push(u.replace('https://', 'http://'));
    if (u.startsWith('http://')) allowed.push(u.replace('http://', 'https://'));
  }
  if (!origin) return cb(null, true); // same-origin or non-browser
  if (allowed.some((a) => origin === a || origin === a.replace(/\/$/, ''))) return cb(null, true);
  // Allow if origin host matches our frontend host
  try {
    const o = new URL(origin);
    const f = new URL(config.frontendUrl);
    if (o.hostname === f.hostname) return cb(null, true);
  } catch {
    /* ignore */
  }
  cb(null, false);
}

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(generalLimiter);

// Serve uploaded files — set explicit Content-Type for formats that
// older versions of the mime library don't know (e.g. .avif)
app.use('/uploads', express.static(path.resolve(config.uploadDir), {
  maxAge: '7d',
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.avif')) res.setHeader('Content-Type', 'image/avif');
    else if (filePath.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
  },
}));
app.use('/exports', express.static(path.resolve(config.exportDir), { maxAge: '1h' }));

// API Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/auth', googleAuthRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/events', eventRoutes);
app.use('/v1/events', guestRoutes);
app.use('/v1/events', photoRoutes);
app.use('/v1/events', galleryRoutes);
app.use('/v1/events', moderationRoutes);
app.use('/v1/events', exportRoutes);
app.use('/v1/events', videoRoutes);
app.use('/v1/host/memories', memoriesRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Wrap async route handlers to catch errors
function wrapAsync() {
  const layers = app._router?.stack || [];
  for (const layer of layers) {
    if (layer.route) {
      for (const routeLayer of layer.route.stack) {
        const original = routeLayer.handle;
        if (original.length <= 3) {
          routeLayer.handle = async (req: any, res: any, next: any) => {
            try {
              await original(req, res, next);
            } catch (err) {
              next(err);
            }
          };
        }
      }
    }
  }
}

// Start server
async function main() {
  await prisma.$connect();
  await initRuntimeConfig(prisma);
  console.log('Database connected');

  // Only start server if not in test mode
  if (process.env.NODE_ENV !== 'test') {
    app.listen(config.port, () => {
      console.log(`Lumora API running on http://localhost:${config.port}`);
      console.log(`Frontend URL: ${config.frontendUrl}`);
    });
  }
}

main().catch(console.error);

export { app };
