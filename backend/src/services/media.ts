import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getStorage } from './storage';

export interface ProcessedImages {
  originalPath: string | null;
  largePath: string;
  thumbPath: string;
  originalUrl: string | null;
  largeUrl: string;
  thumbUrl: string;
  totalFileSize: number;
}

/**
 * Optimised image processing pipeline.
 *
 * Strategy:
 *   - **No separate "original"** — the large derivative is the highest-quality
 *     version we keep (capped at 2048 px). Storing a full-res duplicate just
 *     wastes disk; guests are uploading phone photos, not RAW files.
 *   - **AVIF** for the large derivative (best compression-to-quality ratio,
 *     ~70-80% smaller than JPEG at equivalent perceptual quality, supported by
 *     all modern mobile browsers).
 *   - **WebP** for thumbnails (fast decode for image grids, broad compat, tiny).
 *   - EXIF data is auto-rotated then stripped for privacy.
 *   - `sharp.limitInputPixels` prevents decompression bombs.
 */
export async function processImage(
  inputBuffer: Buffer,
  _originalFilename: string,
  prefix?: string
): Promise<ProcessedImages> {
  const id = uuidv4();
  const storage = getStorage();

  // Decode once, reuse the pipeline — strip EXIF by default via rotate()
  const input = sharp(inputBuffer, {
    limitInputPixels: 100_000_000, // ~10000×10000 max input
    failOn: 'truncated',
  }).rotate(); // auto-orient + strip EXIF

  // ── Large derivative (JPEG) ──────────────────────────────────
  // JPEG has 100% browser support and no content-type guessing issues.
  // AVIF was used before but Express static serves it as application/octet-stream
  // on some environments, causing broken images in the browser.
  const largeName = `${id}.jpg`;
  const base = prefix ? `${prefix.replace(/\/$/, '')}/` : '';
  const largeKey = `${base}images/large/${largeName}`;

  const largeBuffer = await input
    .clone()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer();

  // ── Thumbnail (WebP) ───────────────────────────────────────
  const thumbName = `${id}.webp`;
  const thumbKey = `${base}images/thumbnails/${thumbName}`;

  const thumbBuffer = await input
    .clone()
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 72, effort: 4, smartSubsample: true })
    .toBuffer();

  // Upload both in parallel
  const [largeUrl, thumbUrl] = await Promise.all([
    storage.upload(largeBuffer, largeKey, 'image/jpeg'),
    storage.upload(thumbBuffer, thumbKey, 'image/webp'),
  ]);

  const totalFileSize = largeBuffer.length + thumbBuffer.length;

  return {
    originalPath: null,
    largePath: largeKey,
    thumbPath: thumbKey,
    originalUrl: null,
    largeUrl,
    thumbUrl,
    totalFileSize,
  };
}

export async function deletePhotoFiles(photo: {
  originalUrl: string | null;
  largeUrl: string | null;
  thumbUrl: string | null;
}): Promise<void> {
  const storage = getStorage();
  const urls = [photo.originalUrl, photo.largeUrl, photo.thumbUrl].filter(Boolean);
  for (const url of urls) {
    await storage.delete(url!);
  }
}

export async function deleteVideoFile(video: { url: string | null }): Promise<void> {
  if (!video.url) return;
  const storage = getStorage();
  await storage.delete(video.url);
}
