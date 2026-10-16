import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Vault API Endpoints', () => {
  it('handles vault status, initialization, and re-key lifecycle', async () => {
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Vault Master',
        username: 'vault_master',
        email: 'vaultmaster@envbook.local',
        password: 'Password123!',
      });
    const cookie = signupRes.headers['set-cookie'];

    // Check status before setup
    const statusBefore = await request(app)
      .get('/api/v1/vault/status')
      .set('Cookie', cookie);
    expect(statusBefore.status).toBe(200);
    expect(statusBefore.body.isInitialized).toBe(false);

    // Initialize vault
    const setupRes = await request(app)
      .post('/api/v1/vault/setup')
      .set('Cookie', cookie)
      .send({
        salt: 'BASE64_SALT_XYZ',
        kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 1 },
        keyVersion: 1,
        wrappedDEK: 'BASE64_WRAPPED_DEK_CIPHER',
        nonce: 'BASE64_DEK_NONCE',
      });
    expect(setupRes.status).toBe(200);
    expect(setupRes.body.isInitialized).toBe(true);

    // Second initialization attempt must be rejected
    const dupSetup = await request(app)
      .post('/api/v1/vault/setup')
      .set('Cookie', cookie)
      .send({
        salt: 'OTHER_SALT',
        kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 1 },
        keyVersion: 1,
        wrappedDEK: 'OTHER_DEK',
        nonce: 'OTHER_NONCE',
      });
    expect(dupSetup.status).toBe(400);
    expect(dupSetup.body.code).toBe('VAULT_ALREADY_INITIALIZED');

    // Check status after setup
    const statusAfter = await request(app)
      .get('/api/v1/vault/status')
      .set('Cookie', cookie);
    expect(statusAfter.status).toBe(200);
    expect(statusAfter.body.isInitialized).toBe(true);
    expect(statusAfter.body.wrappedDEK).toBe('BASE64_WRAPPED_DEK_CIPHER');

    // Rekey vault with new passphrase wrap
    const rekeyRes = await request(app)
      .post('/api/v1/vault/rekey')
      .set('Cookie', cookie)
      .send({
        salt: 'NEW_BASE64_SALT',
        kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 1 },
        keyVersion: 2,
        wrappedDEK: 'NEW_WRAPPED_DEK',
        nonce: 'NEW_NONCE',
      });
    expect(rekeyRes.status).toBe(200);
    expect(rekeyRes.body.keyVersion).toBe(2);
  });
});
