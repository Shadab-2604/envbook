import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Backup & Restore API', () => {
  it('exports encrypted backup and restores into a clean account', async () => {
    // 1. Create Source User and vault
    const sourceUserRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Source User',
        username: 'source_usr',
        email: 'source@envbook.local',
        password: 'Password123!',
      });
    const sourceCookie = sourceUserRes.headers['set-cookie'];

    // Setup vault
    await request(app)
      .post('/api/v1/vault/setup')
      .set('Cookie', sourceCookie)
      .send({
        salt: 'SALT_SOURCE',
        kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 1 },
        keyVersion: 1,
        wrappedDEK: 'WRAPPED_DEK_SOURCE',
        nonce: 'NONCE_SOURCE',
      });

    // Create 2 entries
    const entryId1 = randomUUID();
    const entryId2 = randomUUID();

    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', sourceCookie)
      .send({
        entryId: entryId1,
        type: 'credential',
        encryptedPayload: 'ENCRYPTED_API_KEY_PAYLOAD',
        nonce: 'NONCE_1',
      });

    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', sourceCookie)
      .send({
        entryId: entryId2,
        type: 'environment',
        encryptedPayload: 'ENCRYPTED_ENV_PAYLOAD',
        nonce: 'NONCE_2',
      });

    // Export backup
    const exportRes = await request(app)
      .get('/api/v1/backup/export')
      .set('Cookie', sourceCookie);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.entries.length).toBe(2);
    expect(exportRes.body.vaultMetadata.salt).toBe('SALT_SOURCE');

    // 2. Create Target User
    const targetUserRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Target User',
        username: 'target_usr',
        email: 'target@envbook.local',
        password: 'Password123!',
      });
    const targetCookie = targetUserRes.headers['set-cookie'];

    // Restore backup into Target User
    const restoreRes = await request(app)
      .post('/api/v1/backup/restore')
      .set('Cookie', targetCookie)
      .send({
        backup: exportRes.body,
      });

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.restoredCount).toBe(2);

    // Verify Target User can list the restored entries
    const targetEntries = await request(app)
      .get('/api/v1/entries')
      .set('Cookie', targetCookie);

    expect(targetEntries.status).toBe(200);
    expect(targetEntries.body.entries.length).toBe(2);
  });
});
