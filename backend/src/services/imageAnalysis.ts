import sharp from 'sharp';

/**
 * Lightweight image quality analysis using only `sharp`.
 *
 * Checks performed (all run on the raw input buffer, no network calls):
 *   1. **Black / blank screen** – mean brightness near 0 or 255
 *   2. **Blur detection**       – Laplacian variance on a greyscale resize
 *   3. **Low contrast**         – small standard deviation in pixel values
 *   4. **Too dark / too bright**– mean luminance thresholds
 *   5. **Tiny image**           – dimensions below a usable minimum
 *
 * Returns a composite `qualityScore` (0–100) plus individual flags.
 */

export interface ImageAnalysis {
  /** Overall quality score 0-100 (higher = better) */
  qualityScore: number;
  /** True if image is nearly all-black or all-white */
  isBlank: boolean;
  /** True if image appears very blurry */
  isBlurry: boolean;
  /** True if image is extremely dark */
  isDark: boolean;
  /** True if image is extremely bright / washed out */
  isBright: boolean;
  /** True if image has very low contrast */
  isLowContrast: boolean;
  /** True if image is unusually small */
  isTiny: boolean;
  /** Comma-separated list of human-readable issues (empty string if none) */
  issues: string;
}

// ── Thresholds (tuned for phone-camera photos) ─────────────────────────
const BLANK_MEAN_LOW = 8;        // below this → nearly black
const BLANK_MEAN_HIGH = 248;     // above this → nearly white
const BLANK_STD_MAX = 10;        // std-dev must also be low to count as blank
const DARK_MEAN = 30;            // image is "too dark"
const BRIGHT_MEAN = 235;         // image is "too bright"
const LOW_CONTRAST_STD = 20;     // low contrast
const BLUR_THRESHOLD = 120;      // Laplacian variance below this → blurry
const TINY_PIXELS = 50_000;      // width*height below this → tiny (<~224×224)

// ── Internal helpers ───────────────────────────────────────────────────

/**
 * Compute Laplacian variance as a proxy for sharpness.
 * A low variance means the image is soft / blurry.
 */
async function laplacianVariance(buf: Buffer): Promise<number> {
  // Down-sample to 512px max for speed, convert to greyscale
  const grey = sharp(buf, { failOn: 'none' })
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .removeAlpha();

  // Apply a 3×3 Laplacian kernel via sharp convolution
  const laplacian = grey.convolve({
    width: 3,
    height: 3,
    kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    scale: 1,
    offset: 128, // shift into unsigned range
  });

  const { channels } = await laplacian.stats();
  // channels[0] = greyscale channel; use stdev² as variance proxy
  const std = channels[0]?.stdev ?? 0;
  return std * std;
}

// ── Public API ─────────────────────────────────────────────────────────

export async function analyzeImage(inputBuffer: Buffer): Promise<ImageAnalysis> {
  // Get basic stats from the original buffer (greyscale channel)
  const pipeline = sharp(inputBuffer, { failOn: 'none' })
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .removeAlpha();

  const [stats, meta] = await Promise.all([
    pipeline.stats(),
    sharp(inputBuffer, { failOn: 'none' }).metadata(),
  ]);

  const ch = stats.channels[0]; // greyscale channel
  const mean = ch?.mean ?? 128;
  const std = ch?.stdev ?? 50;
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const totalPixels = width * height;

  // ── Individual checks ──────────────────────────────────────────
  const isBlank =
    (mean < BLANK_MEAN_LOW && std < BLANK_STD_MAX) ||
    (mean > BLANK_MEAN_HIGH && std < BLANK_STD_MAX);

  const isDark = mean < DARK_MEAN && !isBlank;
  const isBright = mean > BRIGHT_MEAN && !isBlank;
  const isLowContrast = std < LOW_CONTRAST_STD && !isBlank;
  const isTiny = totalPixels > 0 && totalPixels < TINY_PIXELS;

  // Laplacian blur check (skip for blank images — meaningless)
  let lapVar = 999;
  let isBlurry = false;
  if (!isBlank) {
    try {
      lapVar = await laplacianVariance(inputBuffer);
      isBlurry = lapVar < BLUR_THRESHOLD;
    } catch {
      // If convolution fails (e.g. 1×1 image), skip
    }
  }

  // ── Composite score ────────────────────────────────────────────
  let score = 100;
  if (isBlank) score -= 80;
  if (isBlurry) score -= 25;
  if (isDark) score -= 20;
  if (isBright) score -= 20;
  if (isLowContrast) score -= 15;
  if (isTiny) score -= 20;
  score = Math.max(0, Math.min(100, score));

  // ── Human-readable issues ──────────────────────────────────────
  const issueList: string[] = [];
  if (isBlank) issueList.push(mean < 128 ? 'Black screen' : 'White screen');
  if (isBlurry) issueList.push('Blurry');
  if (isDark) issueList.push('Too dark');
  if (isBright) issueList.push('Too bright');
  if (isLowContrast) issueList.push('Low contrast');
  if (isTiny) issueList.push('Very small image');

  return {
    qualityScore: Math.round(score),
    isBlank,
    isBlurry,
    isDark,
    isBright,
    isLowContrast,
    isTiny,
    issues: issueList.join(', '),
  };
}
