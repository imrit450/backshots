/**
 * Image quality analysis via BRISQUE Python sidecar.
 *
 * Falls back to null gracefully if the sidecar is unreachable — uploads
 * never fail due to quality scoring errors.
 *
 * Sidecar endpoint: POST http://scorer:5001/score (multipart/form-data, field "image")
 * Response: { score: number, brisque_raw: number, flags: { blurry, dark, overexposed, noisy } }
 */

const SCORER_URL = process.env.SCORER_URL ?? 'http://scorer:5001';

export interface QualityFlags {
  blurry: boolean;
  dark: boolean;
  overexposed: boolean;
  noisy: boolean;
}

export interface ImageAnalysis {
  /** 0–100 composite score, higher = better. Stored in quality_score column. */
  qualityScore: number;
  /** Raw BRISQUE output (0 = perfect, 100 = terrible) — for debugging. */
  brisqueRaw: number;
  /** Individual quality diagnostics. */
  flags: QualityFlags;
  /** JSON-stringified flags — stored in quality_issues column for the host UI. */
  issues: string;
}

export async function analyzeImage(inputBuffer: Buffer): Promise<ImageAnalysis> {
  const blob = new Blob([inputBuffer], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('image', blob, 'photo.jpg');

  const response = await fetch(`${SCORER_URL}/score`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scorer returned ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    score: number;
    brisque_raw: number;
    flags: QualityFlags;
    error?: string;
  };

  if (data.error) {
    throw new Error(`Scorer error: ${data.error}`);
  }

  return {
    qualityScore: data.score,
    brisqueRaw:   data.brisque_raw,
    flags:        data.flags,
    issues:       JSON.stringify(data.flags),
  };
}
