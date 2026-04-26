import { google } from 'googleapis';
import { config } from '../config';
import { getStorage } from './storage';

const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
  'https://www.googleapis.com/auth/photoslibrary.sharing',
];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    `${config.baseUrl}/v1/auth/google/callback`
  );
}

export function getAuthUrl(hostId: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: hostId,
  });
}

export async function exchangeCode(code: string): Promise<string> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned — user may have already granted access. Revoke and retry.');
  }
  return tokens.refresh_token;
}

/** Upload all media items to a new Google Photos album, share it, and return the share URL. */
export async function exportToGooglePhotos(
  refreshToken: string,
  eventTitle: string,
  photos: Array<{ largeUrl?: string | null; thumbUrl?: string | null }>,
  videos: Array<{ url: string }>
): Promise<string> {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  const accessTokenRes = await client.getAccessToken();
  const accessToken = accessTokenRes.token;
  if (!accessToken) throw new Error('Failed to get Google access token');

  const authHeader = `Bearer ${accessToken}`;
  const storage = getStorage();

  // 1. Create album
  const albumRes = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ album: { title: eventTitle } }),
  });
  if (!albumRes.ok) throw new Error(`Failed to create album: ${await albumRes.text()}`);
  const album = (await albumRes.json()) as { id: string; productUrl?: string };

  // 2. Upload photos (raw bytes → upload token)
  const uploadTokens: string[] = [];

  for (const photo of photos) {
    const url = photo.largeUrl;
    if (!url) continue;
    try {
      const stream = await storage.getStream(url);
      // Collect stream into buffer
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const buf = Buffer.concat(chunks);
      const ext = url.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png', webp: 'image/webp', avif: 'image/avif',
      };
      const mime = mimeMap[ext] || 'image/jpeg';

      const upRes = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/octet-stream',
          'X-Goog-Upload-Protocol': 'raw',
          'X-Goog-Upload-File-Name': `photo.${ext}`,
          'X-Goog-Upload-Content-Type': mime,
        },
        body: buf,
      });
      if (upRes.ok) uploadTokens.push(await upRes.text());
    } catch {
      // skip inaccessible files
    }
  }

  for (const video of videos) {
    try {
      const stream = await storage.getStream(video.url);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const buf = Buffer.concat(chunks);
      const ext = video.url.split('.').pop()?.toLowerCase() || 'mp4';

      const upRes = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/octet-stream',
          'X-Goog-Upload-Protocol': 'raw',
          'X-Goog-Upload-File-Name': `video.${ext}`,
          'X-Goog-Upload-Content-Type': 'video/mp4',
        },
        body: buf,
      });
      if (upRes.ok) uploadTokens.push(await upRes.text());
    } catch {
      // skip
    }
  }

  if (uploadTokens.length === 0) throw new Error('No media could be uploaded');

  // 3. Batch-add to album in chunks of 50 (API limit)
  const CHUNK = 50;
  for (let i = 0; i < uploadTokens.length; i += CHUNK) {
    const chunk = uploadTokens.slice(i, i + CHUNK);
    const newMediaItems = chunk.map((token) => ({ simpleMediaItem: { uploadToken: token } }));
    const batchRes = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId: album.id, newMediaItems }),
    });
    if (!batchRes.ok) throw new Error(`batchCreate failed: ${await batchRes.text()}`);
  }

  // 4. Share album → get shareable link (best-effort; fall back to productUrl)
  let shareableUrl: string | undefined = album.productUrl;
  try {
    const shareRes = await fetch(
      `https://photoslibrary.googleapis.com/v1/albums/${album.id}:share`,
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharedAlbumOptions: { isCollaborative: false, isCommentable: false } }),
      }
    );
    if (shareRes.ok) {
      const shareData = (await shareRes.json()) as { shareInfo?: { shareableUrl?: string } };
      shareableUrl = shareData.shareInfo?.shareableUrl || shareableUrl;
    } else {
      console.warn('Google Photos share step failed (non-fatal):', await shareRes.text());
    }
  } catch (err) {
    console.warn('Google Photos share step threw (non-fatal):', err);
  }
  if (!shareableUrl) throw new Error('No album URL returned from Google Photos');
  return shareableUrl;
}
