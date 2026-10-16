import { describe, it, expect } from 'vitest';
import {
  encryptProviderKey,
  decryptProviderKey,
  deriveSubkey,
} from '../src/server/keyCrypto';
import {
  redactSecrets,
  isResourceAllowed,
  extractSensitiveKeys,
} from '../src/server/securityFilter';
import {
  buildPromptForAction,
  DEFAULT_GEMINI_MODEL,
  isEdenAi,
  isOpenAi,
} from '../src/server/geminiService';
import {
  ENVAI_ACTIONS,
  SLASH_COMMANDS,
  EnvAiConfigSchema,
  EnvAiGenerateSchema,
  normalizeGeminiModel,
  AVAILABLE_GEMINI_MODELS,
} from '@envbook/shared';

describe('envAi Cryptographic Key Protection (Zero-Plaintext Storage)', () => {
  const mockJwtSecret = 'mock-super-secure-jwt-secret-for-envbook-unit-tests-2026';
  const rawApiKey = 'mock-gemini-flash-api-key-test-value-12345';

  it('derives a consistent 256-bit AES key using HKDF-SHA-256', () => {
    const key1 = deriveSubkey(mockJwtSecret);
    const key2 = deriveSubkey(mockJwtSecret);
    expect(key1).toEqual(key2);
    expect(key1.length).toBe(32); // 256 bits
  });

  it('encrypts provider key using AES-256-GCM with unique IVs', () => {
    const enc1 = encryptProviderKey(rawApiKey, mockJwtSecret);
    const enc2 = encryptProviderKey(rawApiKey, mockJwtSecret);

    expect(enc1.ciphertext).not.toBe(rawApiKey);
    expect(enc1.iv).not.toEqual(enc2.iv); // Unique random IV each encryption
    expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
    expect(enc1.tag).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it('successfully decrypts encrypted ciphertext back to original API key', () => {
    const encrypted = encryptProviderKey(rawApiKey, mockJwtSecret);
    const decrypted = decryptProviderKey(encrypted, mockJwtSecret);
    expect(decrypted).toBe(rawApiKey);
  });

  it('fails closed and throws error when ciphertext is tampered', () => {
    const encrypted = encryptProviderKey(rawApiKey, mockJwtSecret);
    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -4) + 'abcd',
    };

    expect(() => decryptProviderKey(tampered, mockJwtSecret)).toThrow();
  });

  it('fails closed and throws error when authentication tag is tampered', () => {
    const encrypted = encryptProviderKey(rawApiKey, mockJwtSecret);
    const tampered = {
      ...encrypted,
      tag: '00000000000000000000000000000000',
    };

    expect(() => decryptProviderKey(tampered, mockJwtSecret)).toThrow();
  });

  it('fails closed when wrong JWT secret is provided', () => {
    const encrypted = encryptProviderKey(rawApiKey, mockJwtSecret);
    expect(() => decryptProviderKey(encrypted, 'wrong-secret-key-that-does-not-match')).toThrow();
  });
});

describe('envAi Privacy Screening & Credential Redaction Filter', () => {
  it('detects and redacts database URI connection strings', () => {
    const textWithUri = 'Connect using mongodb+srv://admin:P@ssw0rd123!@cluster0.mongodb.net/production?retryWrites=true in your app';
    const { redactedText, redactedCount } = redactSecrets(textWithUri);

    expect(redactedText).toContain('[REDACTED_USER]:[REDACTED_SECRET]');
    expect(redactedText).not.toContain('P@ssw0rd123!');
    expect(redactedCount).toBeGreaterThanOrEqual(1);
  });

  it('detects and redacts private key blocks', () => {
    const textWithKey = `Here is the deployment key:
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y+uVz5...fake...key...material...
-----END RSA PRIVATE KEY-----
Do not commit this file.`;

    const { redactedText, redactedCount } = redactSecrets(textWithKey);
    expect(redactedText).toContain('[REDACTED_PRIVATE_KEY_BLOCK]');
    expect(redactedText).not.toContain('MIIEowIBAAKCAQEA0Y+uVz5');
    expect(redactedCount).toBe(1);
  });

  it('detects and redacts .env credential assignments', () => {
    const envBlock = `
DATABASE_URL=postgres://user:supersecretpass@db.local:5432/main
STRIPE_SECRET_KEY=mock_stripe_key_for_testing_12345
JWT_SECRET=super-jwt-signing-secret-key
APP_NAME=EnvBook
PORT=3000
    `;

    const { redactedText, redactedCount } = redactSecrets(envBlock);
    expect(redactedText).not.toContain('supersecretpass');
    expect(redactedText).not.toContain('mock_stripe_key_for_testing_12345');
    expect(redactedText).toContain('APP_NAME=EnvBook'); // Non-secret preserved
    expect(redactedText).toContain('PORT=3000'); // Non-secret preserved
    expect(redactedCount).toBeGreaterThanOrEqual(2);
  });

  it('detects and redacts Bearer tokens and JWTs', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const { redactedText, redactedCount } = redactSecrets(text);

    expect(redactedText).toContain('[REDACTED_BEARER_TOKEN]');
    expect(redactedText).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(redactedCount).toBeGreaterThanOrEqual(1);
  });

  it('leaves clean technical documentation intact with 0 redacted count', () => {
    const cleanDoc = 'This is a technical design proposal for client-side HKDF key derivation and zero-knowledge storage architecture.';
    const { redactedText, redactedCount } = redactSecrets(cleanDoc);

    expect(redactedText).toBe(cleanDoc);
    expect(redactedCount).toBe(0);
  });

  it('extracts sensitive keys accurately', () => {
    const keys = extractSensitiveKeys('PORT=3000\nDATABASE_PASSWORD=secret123\nAWS_SECRET_ACCESS_KEY=AKIAxyz');
    expect(keys).toContain('DATABASE_PASSWORD');
    expect(keys).toContain('AWS_SECRET_ACCESS_KEY');
    expect(keys).not.toContain('PORT');
  });
});

describe('envAi Zero-Knowledge Resource Access Control', () => {
  it('strictly blocks environment and credential pages from AI processing', () => {
    expect(isResourceAllowed('environment_page')).toBe(false);
    expect(isResourceAllowed('credential')).toBe(false);
    expect(isResourceAllowed('env_var')).toBe(false);
  });

  it('permits documentation and note types', () => {
    expect(isResourceAllowed('notes_page')).toBe(true);
    expect(isResourceAllowed('page')).toBe(true);
    expect(isResourceAllowed('snippet')).toBe(true);
    expect(isResourceAllowed('idea')).toBe(true);
  });
});

describe('envAi Action Prompt Engineering & Model Behavior', () => {
  it('covers all 15 defined envAi actions', () => {
    expect(ENVAI_ACTIONS).toHaveLength(15);
    const expected = [
      'brainstorm', 'title', 'expand', 'improve', 'continue',
      'summarize', 'outline', 'prd', 'tone', 'shorten',
      'expand_length', 'explain_code', 'cybersecurity', 'custom', 'chat'
    ];
    expected.forEach((act) => {
      expect(ENVAI_ACTIONS).toContain(act);
    });
  });

  it('constructs structured action prompt with context and tone for PRD', () => {
    const prompt = buildPromptForAction('prd', 'Encrypted Note App', 'Feature context');
    expect(prompt).toContain('Product Requirements Document');
    expect(prompt).toContain('Security & Privacy Considerations');
    expect(prompt).toContain('Encrypted Note App');
  });

  it('constructs structured prompt for cybersecurity analysis', () => {
    const prompt = buildPromptForAction('cybersecurity', 'Suspicious outbound port 4444 connection observed on web server');
    expect(prompt).toContain('cybersecurity analysis');
    expect(prompt).toContain('Threat Hypothesis / MITRE ATT&CK');
    expect(prompt).toContain('Remediation');
  });

  it('constructs structured prompt for code explanation', () => {
    const code = 'function aesGcmEncrypt(data) { return crypto.subtle.encrypt(...); }';
    const prompt = buildPromptForAction('explain_code', code);
    expect(prompt).toContain('Explain the following code in detail');
    expect(prompt).toContain('Security caveats & best practice');
  });

  it('constructs prompt with requested tone', () => {
    const prompt = buildPromptForAction('tone', 'This function is fast.', undefined, 'academic');
    expect(prompt).toContain('academic tone');
  });
});

describe('envAi Schemas & Slash Command Verification', () => {
  it('validates valid envAi config payload', () => {
    const valid = {
      apiKey: 'mock-gemini-flash-api-key-test-value-12345',
      model: 'gemini-3.8-flash',
    };
    const parsed = EnvAiConfigSchema.parse(valid);
    expect(parsed.apiKey).toBe(valid.apiKey);
    expect(parsed.model).toBe(valid.model);
  });

  it('defaults omitted model to gemini-3.8-flash', () => {
    const parsed = EnvAiConfigSchema.parse({
      apiKey: 'mock-gemini-flash-api-key-test-value-12345',
    });
    expect(parsed.model).toBe('gemini-3.8-flash');
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.8-flash');
  });

  it('contains curated models with gpt-4o and gemini-3.8-flash marked recommended and Eden AI models directly below them', () => {
    const recommendedList = AVAILABLE_GEMINI_MODELS.filter((m) => m.isRecommended);
    expect(recommendedList.some((m) => m.id === 'gpt-4o')).toBe(true);
    expect(recommendedList.some((m) => m.id === 'gemini-3.8-flash')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gpt-4o-mini')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'openai/gpt-latest')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'edenai')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-flash-latest')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-3.1-pro-preview')).toBe(true);
  });

  it('normalizes model input and auto-migrates deprecated models while preserving openai, edenai and gpt-latest', () => {
    expect(normalizeGeminiModel('models/gemini-3.8-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('gemini-2.0-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('models/gemini-2.0-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('gpt-4o')).toBe('gpt-4o');
    expect(normalizeGeminiModel('gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(normalizeGeminiModel('openai/gpt-latest')).toBe('openai/gpt-latest');
    expect(normalizeGeminiModel('edenai')).toBe('edenai');
    expect(normalizeGeminiModel('eden-ai')).toBe('edenai');
  });

  it('detects Eden AI keys and models correctly via isEdenAi', () => {
    expect(isEdenAi('sk-eden-live-abcdef123456')).toBe(true);
    expect(isEdenAi(undefined, 'edenai')).toBe(true);
    expect(isEdenAi(undefined, 'openai/gpt-latest')).toBe(true);
    expect(isEdenAi('AIzaSyDummyKey', 'gemini-3.8-flash')).toBe(false);
  });

  it('detects OpenAI keys and models correctly via isOpenAi', () => {
    expect(isOpenAi('sk-proj-ilbg1AJHRxPCK8K04OZBbXeNlQbT')).toBe(true);
    expect(isOpenAi('sk-abcdef1234567890')).toBe(true);
    expect(isOpenAi('sk-eden-live-abcdef123456')).toBe(false);
    expect(isOpenAi(undefined, 'gpt-4o')).toBe(true);
    expect(isOpenAi(undefined, 'gpt-4o-mini')).toBe(true);
    expect(isOpenAi('AIzaSyDummyKey', 'gemini-3.8-flash')).toBe(false);
  });

  it('rejects empty or whitespace-only API key', () => {
    expect(() => EnvAiConfigSchema.parse({ apiKey: '   ' })).toThrow();
  });

  it('registers /envai slash command with valid category and aliases', () => {
    const envaiCmd = SLASH_COMMANDS.find((cmd) => cmd.id === 'envai');
    expect(envaiCmd).toBeDefined();
    expect(envaiCmd?.command).toBe('/envai');
    expect(envaiCmd?.aliases).toContain('/ai');
    expect(envaiCmd?.aliases).toContain('/gemini');
    expect(['Text', 'Developer', 'Security', 'Layout', 'Page']).toContain(envaiCmd?.category);
  });
});
