import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

export interface StorageService {
  /** Upload buffer and return the public URL */
  upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
  /** Delete by key (e.g. "large/xxx.avif") or by full URL */
  delete(keyOrUrl: string): Promise<void>;
  /** Get a readable stream for the file (for ZIP exports) */
  getStream(keyOrUrl: string): Promise<Readable>;
}

// ─── Filesystem storage (default for dev) ────────────────────────────────────

function urlToKey(url: string): string {
  // Strip leading slash and /uploads/ prefix
  return url.replace(/^\/uploads\//, '');
}

export class FileSystemStorage implements StorageService {
  constructor(private baseDir: string) {}

  private keyToPath(key: string): string {
    return path.join(this.baseDir, key);
  }

  async upload(buffer: Buffer, key: string, _contentType: string): Promise<string> {
    const filePath = this.keyToPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return `/uploads/${key.replace(/\\/g, '/')}`;
  }

  async delete(keyOrUrl: string): Promise<void> {
    const key = keyOrUrl.startsWith('/') ? urlToKey(keyOrUrl) : keyOrUrl;
    const filePath = this.keyToPath(key);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  async getStream(keyOrUrl: string): Promise<Readable> {
    const key = keyOrUrl.startsWith('/') ? urlToKey(keyOrUrl) : keyOrUrl;
    const filePath = this.keyToPath(key);
    const { createReadStream } = await import('fs');
    return createReadStream(filePath);
  }
}

// ─── S3-compatible storage (prod) ───────────────────────────────────────────

function keyFromUrl(url: string, publicBase: string): string {
  const base = publicBase.replace(/\/$/, '');
  if (url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  return url.replace(/^\/uploads\//, '');
}

export class S3Storage implements StorageService {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor() {
    const endpoint = config.s3?.endpoint;
    const region = config.s3?.region || 'us-east-1';
    this.bucket = config.s3!.bucket;
    this.publicBase = config.s3!.publicUrl;

    this.client = new S3Client({
      region,
      ...(endpoint && { endpoint }),
      credentials: config.s3?.accessKeyId
        ? {
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey!,
          }
        : undefined,
      forcePathStyle: config.s3?.forcePathStyle,
    });
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const normalizedKey = key.replace(/^\/uploads\//, '');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizedKey,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `${this.publicBase.replace(/\/$/, '')}/${normalizedKey}`;
  }

  async delete(keyOrUrl: string): Promise<void> {
    const key = keyOrUrl.startsWith('http')
      ? keyFromUrl(keyOrUrl, this.publicBase)
      : keyOrUrl.replace(/^\/uploads\//, '');
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
      );
    } catch {
      // Object may not exist
    }
  }

  async getStream(keyOrUrl: string): Promise<Readable> {
    const key = keyOrUrl.startsWith('http')
      ? keyFromUrl(keyOrUrl, this.publicBase)
      : keyOrUrl.replace(/^\/uploads\//, '');
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    if (!response.Body) {
      throw new Error(`Empty response for key: ${key}`);
    }
    return response.Body as Readable;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let _storage: StorageService | null = null;

export function getStorage(): StorageService {
  if (!_storage) {
    if (config.storageType === 's3' && config.s3?.bucket && config.s3?.publicUrl) {
      _storage = new S3Storage();
    } else {
      _storage = new FileSystemStorage(config.uploadDir);
    }
  }
  return _storage;
}
