import crypto from 'crypto';

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

let _keyPair: KeyPair | null = null;

/**
 * Generate (or return cached) RSA-OAEP key pair for password encryption in transit.
 * Keys are generated once per server lifetime and held in memory.
 */
export function getKeyPair(): KeyPair {
  if (!_keyPair) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    _keyPair = { publicKey, privateKey };
  }
  return _keyPair;
}

/**
 * Decrypt a base64-encoded RSA-OAEP ciphertext back to the original plaintext string.
 */
export function decryptPassword(encryptedBase64: string): string {
  const { privateKey } = getKeyPair();
  const buffer = Buffer.from(encryptedBase64, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );
  return decrypted.toString('utf8');
}
