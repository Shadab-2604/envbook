import { argon2id } from 'hash-wasm';

const DEFAULT_MEMORY_COST = 65536; // 64 MB
const DEFAULT_TIME_COST = 3; // 3 iterations
const DEFAULT_PARALLELISM = 1;

// Base64 encoding and decoding helpers safe across browser and Node.js
export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateRandomBytes(length = 16): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateSaltBase64(length = 16): string {
  return toBase64(generateRandomBytes(length));
}

/**
 * Derives a Key-Encryption Key (KEK) using Argon2id via hash-wasm and imports into Web Crypto.
 */
export async function deriveKEK(
  passphrase: string,
  saltBase64: string,
  memoryCost = DEFAULT_MEMORY_COST,
  timeCost = DEFAULT_TIME_COST,
  parallelism = DEFAULT_PARALLELISM
): Promise<CryptoKey> {
  const saltBytes = fromBase64(saltBase64);

  const rawKeyBytes = await argon2id({
    password: passphrase,
    salt: saltBytes,
    parallelism,
    iterations: timeCost,
    memorySize: memoryCost,
    hashLength: 32,
    outputType: 'binary',
  });

  return crypto.subtle.importKey(
    'raw',
    rawKeyBytes as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
  );
}

/**
 * Generates a high-entropy random Data-Encryption Key (DEK) for the vault.
 */
export async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable only for wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Wraps the DEK using the KEK with AES-256-GCM and a unique 12-byte IV.
 */
export async function wrapDEK(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedDEK: string; nonce: string }> {
  const iv = generateRandomBytes(12);

  const rawDEK = await crypto.subtle.exportKey('raw', dek);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    kek,
    rawDEK
  );

  return {
    wrappedDEK: toBase64(new Uint8Array(ciphertextBuffer)),
    nonce: toBase64(iv),
  };
}

/**
 * Unwraps the DEK using the KEK.
 */
export async function unwrapDEK(
  wrappedDEKBase64: string,
  nonceBase64: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  const iv = fromBase64(nonceBase64);
  const ciphertext = fromBase64(wrappedDEKBase64);

  const rawDEK = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    kek,
    ciphertext as any
  );

  return crypto.subtle.importKey(
    'raw',
    rawDEK,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an arbitrary object/string payload with the DEK using AES-256-GCM and unique IV.
 * Binds additional authenticated data (AAD) to prevent record swapping.
 */
export async function encryptPayload(
  payload: unknown,
  dek: CryptoKey,
  aadString = ''
): Promise<{ ciphertext: string; nonce: string }> {
  const iv = generateRandomBytes(12);
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(
    typeof payload === 'string' ? payload : JSON.stringify(payload)
  );

  const additionalData = encoder.encode(aadString);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      additionalData: additionalData as any,
    },
    dek,
    plaintextBytes
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    nonce: toBase64(iv),
  };
}

/**
 * Decrypts a ciphertext payload with the DEK and verifies AAD.
 * Throws an error if ciphertext or tag was tampered with.
 */
export async function decryptPayload<T = unknown>(
  ciphertextBase64: string,
  nonceBase64: string,
  dek: CryptoKey,
  aadString = ''
): Promise<T> {
  const iv = fromBase64(nonceBase64);
  const ciphertext = fromBase64(ciphertextBase64);
  const encoder = new TextEncoder();
  const additionalData = encoder.encode(aadString);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      additionalData: additionalData as any,
    },
    dek,
    ciphertext as any
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return jsonString as unknown as T;
  }
}

/**
 * Generates a high-entropy recovery code formatted into readable chunks:
 * e.g. "EBK-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
 */
export function generateRecoveryKey(): string {
  const bytes = generateRandomBytes(16);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  const parts = hex.match(/.{1,4}/g) || [];
  return `EBK-${parts.join('-')}`;
}
