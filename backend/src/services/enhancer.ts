const SCORER_URL = process.env.SCORER_URL ?? 'http://scorer:5001';

export async function enhancePhoto(buffer: Buffer): Promise<Buffer> {
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('image', blob, 'photo.jpg');

  const res = await fetch(`${SCORER_URL}/enhance/photo`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Photo enhancer returned ${res.status}: ${msg}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function enhanceVideo(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const ext = mimeType === 'video/webm' ? 'webm' : 'mp4';
  const blob = new Blob([buffer], { type: mimeType });
  const form = new FormData();
  form.append('video', blob, `video.${ext}`);

  const res = await fetch(`${SCORER_URL}/enhance/video`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Video enhancer returned ${res.status}: ${msg}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
