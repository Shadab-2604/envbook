import { Request, Response } from 'express';
import { AiProviderSettings } from '../models/AiProviderSettings.js';
import { Entry } from '../models/Entry.js';
import { logSecurityEvent } from '../models/AuditLog.js';
import { encryptProviderKey, decryptProviderKey } from '../services/envai/keyCrypto.js';
import { testGeminiApiKey, callGeminiApi, DEFAULT_GEMINI_MODEL } from '../services/envai/geminiService.js';
import { isResourceAllowed } from '../services/envai/securityFilter.js';
import { EnvAiConfigSchema, EnvAiGenerateSchema } from '@envbook/shared';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: JWT_SECRET is not defined');
  }
  return secret;
}

/**
 * GET /api/v1/envai/status
 * Returns provider status metadata without leaking secret key material
 */
export async function getEnvAiStatus(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const settings = await AiProviderSettings.findOne({ userId });

  if (!settings) {
    res.json({
      isConfigured: false,
      model: DEFAULT_GEMINI_MODEL,
      lastTestStatus: 'untested',
    });
    return;
  }

  res.json({
    isConfigured: true,
    model: settings.model || DEFAULT_GEMINI_MODEL,
    lastTestedAt: settings.lastTestedAt?.toISOString(),
    lastTestStatus: settings.lastTestStatus || 'untested',
    message: settings.lastTestMessage,
  });
}

/**
 * PUT /api/v1/envai/config
 * Encrypts and persists user's Gemini API key using HKDF subkey
 */
export async function saveEnvAiConfig(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const parseResult = EnvAiConfigSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid configuration payload',
      details: parseResult.error.format(),
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { apiKey, model = DEFAULT_GEMINI_MODEL } = parseResult.data;
  const jwtSecret = getJwtSecret();

  // Test the key non-destructively
  const testResult = await testGeminiApiKey(apiKey, model);

  // Encrypt with HKDF derived key
  const { ciphertext, iv, tag, keyVersion } = encryptProviderKey(apiKey, jwtSecret);

  await AiProviderSettings.findOneAndUpdate(
    { userId },
    {
      userId,
      encryptedApiKey: ciphertext,
      iv,
      tag,
      keyVersion,
      model,
      lastTestedAt: new Date(),
      lastTestStatus: testResult.success ? 'success' : 'failed',
      lastTestMessage: testResult.message,
    },
    { upsert: true, new: true }
  );

  await logSecurityEvent('ENVAI_KEY_CONFIGURED', {
    userId,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: (req.headers['user-agent'] as string) || 'unknown',
    metadata: { model, testSuccess: testResult.success },
  });

  res.json({
    success: true,
    isConfigured: true,
    testResult,
  });
}

/**
 * POST /api/v1/envai/test
 * Tests the stored key against Gemini API
 */
export async function testEnvAiConnection(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const settings = await AiProviderSettings.findOne({ userId }).select('+encryptedApiKey +iv +tag');
  if (!settings || !settings.encryptedApiKey) {
    res.status(400).json({
      error: 'envAi is not configured. Please add your Gemini API key first.',
      code: 'NOT_CONFIGURED',
    });
    return;
  }

  const jwtSecret = getJwtSecret();
  let apiKey: string;
  try {
    apiKey = decryptProviderKey(
      {
        ciphertext: settings.encryptedApiKey,
        iv: settings.iv,
        tag: settings.tag,
      },
      jwtSecret
    );
  } catch (err) {
    res.status(500).json({
      error: 'Failed to decrypt stored provider key. Please reconfigure your key.',
      code: 'DECRYPTION_FAILED',
    });
    return;
  }

  const testResult = await testGeminiApiKey(apiKey, settings.model || DEFAULT_GEMINI_MODEL);

  settings.lastTestedAt = new Date();
  settings.lastTestStatus = testResult.success ? 'success' : 'failed';
  settings.lastTestMessage = testResult.message;
  await settings.save();

  res.json(testResult);
}

/**
 * DELETE /api/v1/envai/config
 * Removes the stored provider key
 */
export async function deleteEnvAiConfig(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  await AiProviderSettings.findOneAndDelete({ userId });

  await logSecurityEvent('ENVAI_KEY_REMOVED', {
    userId,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: (req.headers['user-agent'] as string) || 'unknown',
  });

  res.json({
    success: true,
    message: 'envAi provider configuration removed successfully.',
  });
}

/**
 * POST /api/v1/envai/generate
 * Executes writing actions and answers questions using Google Gemini
 */
export async function generateEnvAiContent(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  // 1. Validate payload
  const parseResult = EnvAiGenerateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request payload',
      details: parseResult.error.format(),
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const input = parseResult.data;

  // 2. Enforce resource type security restrictions
  if (!isResourceAllowed((req.body as any).currentNoteType)) {
    res.status(403).json({
      error: 'envAi cannot be used with environment variables or credential records for zero-knowledge privacy.',
      code: 'RESOURCE_DISALLOWED',
    });
    return;
  }

  // 3. Fetch user's decrypted key
  const settings = await AiProviderSettings.findOne({ userId }).select('+encryptedApiKey +iv +tag');
  if (!settings || !settings.encryptedApiKey) {
    res.status(400).json({
      error: 'envAi is not configured. Please configure your Google Gemini API key in Settings → envAi.',
      code: 'NOT_CONFIGURED',
    });
    return;
  }

  const jwtSecret = getJwtSecret();
  let apiKey: string;
  try {
    apiKey = decryptProviderKey(
      {
        ciphertext: settings.encryptedApiKey,
        iv: settings.iv,
        tag: settings.tag,
      },
      jwtSecret
    );
  } catch (err) {
    res.status(500).json({
      error: 'Failed to decrypt provider key. Please reconfigure your key.',
      code: 'DECRYPTION_FAILED',
    });
    return;
  }

  // 4. Workspace Retrieval if scope is "my_notes"
  const citations: Array<{ source: 'note' | 'file'; title: string; id?: string }> = [];
  let contextualNotes = input.contextText || '';

  if (input.scope === 'my_notes') {
    // Retrieve user's eligible notes (excluding environments and credentials)
    const eligibleEntries = await Entry.find({
      owner: userId,
      type: { $in: ['notes_page', 'page', 'snippet', 'idea'] },
      isDeleted: false,
      isArchived: false,
    })
      .sort({ updatedAt: -1 })
      .limit(10);

      for (const entry of eligibleEntries) {
        citations.push({
          source: 'note',
          title: 'Note ' + entry.entryId.slice(0, 8),
          id: entry.entryId,
        });
      }
  }

  // 5. Call Gemini API
  try {
    const result = await callGeminiApi({
      apiKey,
      model: settings.model || DEFAULT_GEMINI_MODEL,
      action: input.action,
      prompt: input.prompt,
      contextText: contextualNotes,
      tone: input.tone,
      citations,
      files: input.files,
      conversationHistory: input.conversationHistory,
    });

    res.json({
      success: true,
      text: result.text,
      citations: result.citations,
      redactedCount: result.redactedCount,
    });
  } catch (err: any) {
    console.error('[envAi] Generation error:', err.message);
    res.status(500).json({
      error: err.message || 'Failed to generate response from envAi',
      code: 'GENERATION_ERROR',
    });
  }
}
