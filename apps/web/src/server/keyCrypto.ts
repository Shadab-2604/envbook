import crypto from 'crypto';

const HKDF_INFO = 'envbook:envai-provider-key:v1';
const HKDF_SALT = 'envbook:envai-hkdf-salt:v1';

/**
 * Derives a dedicated 256-bit AES encryption key from JWT_SECRET using HKDF-SHA-256.
 * Enforces strict isolation per PRD constraints without needing a 4th environment variable.
 */
export function deriveEnvAiEncryptionKey(jwtSecret: string): Buffer {
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters to derive provider encryption key');
  }
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(jwtSecret, 'utf-8'),
      Buffer.from(HKDF_SALT, 'utf-8'),
      Buffer.from(HKDF_INFO, 'utf-8'),
      32
    )
  );
}

export const deriveSubkey = deriveEnvAiEncryptionKey;

/**
 * Encrypts provider API key using AES-256-GCM with a unique 12-byte IV.
 */
export function encryptProviderKey(
  plainKey: string,
  jwtSecret: string
): { ciphertext: string; iv: string; tag: string; keyVersion: number } {
  if (!plainKey || plainKey.trim().length === 0) {
    throw new Error('Cannot encrypt empty API key');
  }

  const derivedKey = deriveEnvAiEncryptionKey(jwtSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

  let encrypted = cipher.update(plainKey, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
    keyVersion: 1,
  };
}

/**
 * Decrypts provider API key using AES-256-GCM.
 * Fails closed if ciphertext or authentication tag has been tampered with.
 */
export function decryptProviderKey(
  encryptedData: { ciphertext: string; iv: string; tag: string },
  jwtSecret: string
): string {
  const derivedKey = deriveEnvAiEncryptionKey(jwtSecret);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    derivedKey,
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

  let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}
