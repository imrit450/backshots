const API_BASE = '/v1';

let _publicKey: CryptoKey | null = null;

/** Web Crypto subtle is only available in secure contexts (HTTPS or localhost). */
export function isEncryptionAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.crypto?.subtle;
}

/**
 * Fetch the server's RSA public key and import it for use with Web Crypto API.
 * The key is cached in memory so subsequent calls reuse it.
 * Throws if crypto.subtle is unavailable (HTTP / non-secure context).
 */
async function getPublicKey(): Promise<CryptoKey> {
  if (!isEncryptionAvailable()) {
    throw new Error('ENCRYPTION_UNAVAILABLE');
  }
  if (_publicKey) return _publicKey;

  // Retry once if the first fetch fails (e.g. temporary rate-limit or network blip)
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/public-key`);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetch(`${API_BASE}/auth/public-key`);
  }

  if (!res.ok) {
    throw new Error('Failed to fetch encryption key. Please refresh the page and try again.');
  }

  const { publicKey: pem } = await res.json();

  const binaryDer = pemToArrayBuffer(pem);

  _publicKey = await window.crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  return _publicKey;
}

/**
 * Convert a PEM-encoded key to an ArrayBuffer.
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt a plaintext password using the server's RSA public key.
 * Returns a base64-encoded ciphertext string.
 * Throws "ENCRYPTION_UNAVAILABLE" when crypto.subtle is unavailable (HTTP).
 */
export async function encryptPassword(password: string): Promise<string> {
  if (!isEncryptionAvailable()) {
    throw new Error('ENCRYPTION_UNAVAILABLE');
  }
  const key = await getPublicKey();
  const encoded = new TextEncoder().encode(password);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    encoded
  );
  return arrayBufferToBase64(encrypted);
}

/**
 * Convert an ArrayBuffer to a base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Clear the cached public key. Call this if the server restarts
 * and the key pair changes (e.g. on a decryption failure / 400 response).
 */
export function clearPublicKeyCache(): void {
  _publicKey = null;
}
