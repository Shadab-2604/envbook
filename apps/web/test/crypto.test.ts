import { describe, it, expect } from 'vitest';
import {
  generateSaltBase64,
  deriveKEK,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptPayload,
  decryptPayload,
  generateRecoveryKey,
} from '../src/lib/crypto.js';

describe('Client-Side Web Crypto & Argon2id Engine', () => {
  it('derives KEK, wraps and unwraps DEK with correct passphrase', async () => {
    const salt = generateSaltBase64();
    const passphrase = 'MySuperSecureMasterPassphrase!2026';

    const kek = await deriveKEK(passphrase, salt, 16384, 2, 1);
    const dek = await generateDEK();

    const { wrappedDEK, nonce } = await wrapDEK(dek, kek);
    expect(wrappedDEK).toBeDefined();
    expect(nonce).toBeDefined();

    // Unwrap with same KEK
    const unwrappedDEK = await unwrapDEK(wrappedDEK, nonce, kek);
    expect(unwrappedDEK).toBeDefined();

    // Verify unwrapped DEK works to encrypt and decrypt
    const { ciphertext, nonce: payloadNonce } = await encryptPayload(
      { secret: 'vault_data' },
      unwrappedDEK,
      'test_aad'
    );
    const decrypted = await decryptPayload<{ secret: string }>(
      ciphertext,
      payloadNonce,
      unwrappedDEK,
      'test_aad'
    );
    expect(decrypted.secret).toBe('vault_data');
  });

  it('rejects unwrapping with incorrect passphrase', async () => {
    const salt = generateSaltBase64();
    const correctPassphrase = 'CorrectPassphrase123';
    const wrongPassphrase = 'WrongPassphrase456';

    const correctKEK = await deriveKEK(correctPassphrase, salt, 16384, 2, 1);
    const wrongKEK = await deriveKEK(wrongPassphrase, salt, 16384, 2, 1);

    const dek = await generateDEK();
    const { wrappedDEK, nonce } = await wrapDEK(dek, correctKEK);

    // Attempt unwrap with wrong KEK must fail
    await expect(unwrapDEK(wrappedDEK, nonce, wrongKEK)).rejects.toThrow();
  });

  it('rejects tampered ciphertext and modified AAD (tamper detection)', async () => {
    const dek = await generateDEK();
    const originalPayload = { apiKey: 'sk-test-live-1234567890' };
    const aad = 'user_id_1:entry_id_1:v1.0';

    const { ciphertext, nonce } = await encryptPayload(originalPayload, dek, aad);

    // Tampered ciphertext
    const tamperedCiphertext =
      ciphertext.substring(0, 10) + (ciphertext[10] === 'A' ? 'B' : 'A') + ciphertext.substring(11);

    await expect(decryptPayload(tamperedCiphertext, nonce, dek, aad)).rejects.toThrow();

    // Tampered AAD
    const wrongAad = 'user_id_2:entry_id_1:v1.0';
    await expect(decryptPayload(ciphertext, nonce, dek, wrongAad)).rejects.toThrow();
  });

  it('generates unique nonces for repeated encryptions', async () => {
    const dek = await generateDEK();
    const payload = { note: 'identical content' };

    const enc1 = await encryptPayload(payload, dek);
    const enc2 = await encryptPayload(payload, dek);

    expect(enc1.nonce).not.toBe(enc2.nonce);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it('generates formatted high-entropy recovery key', () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^EBK-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});
