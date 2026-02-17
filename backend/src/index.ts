import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import eventRoutes from './routes/events';
import guestRoutes from './routes/guests';
import photoRoutes from './routes/photos';
import galleryRoutes from './routes/gallery';
import moderationRoutes from './routes/moderation';
import exportRoutes from './routes/exports';

export const prisma = new PrismaClient();

const app = express();

// Trust proxy (ngrok, reverse proxies set X-Forwarded-For)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());
app.use(generalLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(config.uploadDir)));
app.use('/exports', express.static(path.resolve(config.exportDir)));

// API Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/events', eventRoutes);
app.use('/v1/events', guestRoutes);
app.use('/v1/events', photoRoutes);
app.use('/v1/events', galleryRoutes);
app.use('/v1/events', moderationRoutes);
app.use('/v1/events', exportRoutes);

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
  console.log('Database connected');

  // Only start server if not in test mode
  if (process.env.NODE_ENV !== 'test') {
    app.listen(config.port, () => {
      console.log(`Backshots API running on http://localhost:${config.port}`);
      console.log(`Frontend URL: ${config.frontendUrl}`);
    });
  }
}

main().catch(console.error);

export { app };
