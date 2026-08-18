import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  get jwtSecret() { return process.env.JWT_SECRET || 'lumora-dev-secret'; },
  uploadDir: path.resolve(__dirname, process.env.UPLOAD_DIR || '../../uploads'),
  exportDir: path.resolve(__dirname, process.env.EXPORT_DIR || '../../exports'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtExpiresIn: '7d',
  guestTokenExpiresIn: '24h',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  thumbnailSize: 300,
  largeSize: 2048,

  /** Clerk — used to verify JWTs issued by the Clerk frontend SDK. */
  get clerkSecretKey(): string | undefined {
    return process.env.CLERK_SECRET_KEY;
  },
  get clerkPublishableKey(): string | undefined {
    return process.env.CLERK_PUBLISHABLE_KEY;
  },

  /** Storage: 'filesystem' (default) or 's3' */
  get storageType(): 'filesystem' | 's3' {
    return (process.env.STORAGE_TYPE as 'filesystem' | 's3') || 'filesystem';
  },

  /** S3-compatible config (AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces) */
  get s3(): {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl: string;
    forcePathStyle?: boolean;
  } | null {
    const bucket = process.env.S3_BUCKET;
    const publicUrl = process.env.S3_PUBLIC_URL;
    if (!bucket || !publicUrl) return null;
    return {
      bucket,
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      publicUrl,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    };
  },

  /** Google OAuth — for Google Photos export */
  get googleClientId(): string | undefined { return process.env.GOOGLE_CLIENT_ID; },
  get googleClientSecret(): string | undefined { return process.env.GOOGLE_CLIENT_SECRET; },
};
