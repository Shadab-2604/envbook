import { describe, it, expect } from 'vitest';
import {
  encryptProviderKey,
  decryptProviderKey,
  deriveSubkey,
} from '../src/services/envai/keyCrypto.js';
import {
  redactSecrets,
  isResourceAllowed,
} from '../src/services/envai/securityFilter.js';
import {
  buildPromptForAction,
  DEFAULT_GEMINI_MODEL,
  isEdenAi,
} from '../src/services/envai/geminiService.js';
import {
  ENVAI_ACTIONS,
  EnvAiConfigSchema,
  normalizeGeminiModel,
  AVAILABLE_GEMINI_MODELS,
} from '@envbook/shared';

describe('Express Backend envAi Cryptographic & Security Layer', () => {
  const secret = 'backend-test-jwt-secret-with-sufficient-entropy-for-hkdf-test';
  const apiKey = 'mock-gemini-flash-api-key-test-value-12345';

  it('correctly derives 256-bit subkey in Express backend', () => {
    const key = deriveSubkey(secret);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('encrypts and decrypts provider key without loss', () => {
    const enc = encryptProviderKey(apiKey, secret);
    expect(enc.ciphertext).not.toBe(apiKey);
    expect(enc.keyVersion).toBe(1);

    const decrypted = decryptProviderKey(enc, secret);
    expect(decrypted).toBe(apiKey);
  });

  it('fails closed when ciphertext is corrupted', () => {
    const enc = encryptProviderKey(apiKey, secret);
    const corrupted = { ...enc, ciphertext: 'bad' + enc.ciphertext.slice(3) };
    expect(() => decryptProviderKey(corrupted, secret)).toThrow();
  });

  it('redacts sensitive credentials before reaching Gemini', () => {
    const sensitive = 'POSTGRES_PASSWORD=supersecretpass\nSECRET_KEY=12345';
    const { redactedText, redactedCount } = redactSecrets(sensitive);
    expect(redactedText).toContain('[REDACTED_SECRET]');
    expect(redactedText).not.toContain('supersecretpass');
    expect(redactedCount).toBeGreaterThanOrEqual(1);
  });

  it('blocks environment records from AI context', () => {
    expect(isResourceAllowed('environment_page')).toBe(false);
    expect(isResourceAllowed('credential')).toBe(false);
    expect(isResourceAllowed('notes_page')).toBe(true);
  });

  it('defaults to gemini-3.8-flash', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.8-flash');
  });

  it('normalizes model strings and auto-migrates deprecated models while preserving edenai', () => {
    expect(normalizeGeminiModel('models/gemini-3.8-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('gemini-3.8-flash')).toBe('gemini-3.8-flash');
    // Deprecated models auto-migrate to DEFAULT_GEMINI_MODEL
    expect(normalizeGeminiModel('gemini-2.0-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('models/gemini-2.0-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('gemini-1.5-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel(undefined)).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('edenai')).toBe('edenai');
    expect(normalizeGeminiModel('eden-ai')).toBe('edenai');
  });

  it('positions Eden AI directly below recommended model and detects keys', () => {
    const recommendedIndex = AVAILABLE_GEMINI_MODELS.findIndex((m) => m.id === 'gemini-3.8-flash');
    expect(AVAILABLE_GEMINI_MODELS[recommendedIndex + 1].id).toBe('edenai');
    expect(isEdenAi('sk-eden-live-key123')).toBe(true);
    expect(isEdenAi(undefined, 'edenai')).toBe(true);
    expect(isEdenAi('AIzaSyKey', 'gemini-3.8-flash')).toBe(false);
  });

  it('builds valid prompts for all 15 actions', () => {
    for (const action of ENVAI_ACTIONS) {
      const prompt = buildPromptForAction(action, 'Test prompt', 'Test context');
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});
