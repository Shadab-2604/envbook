import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app.js';

const app = createApp();

async function createTestUser(username: string, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      name: `User ${username}`,
      username,
      email,
      password: 'Password123!',
    });
  return res.headers['set-cookie'];
}

describe('Entries API & Ownership Isolation', () => {
  it('enforces strict cross-user ownership isolation', async () => {
    const userACookie = await createTestUser('user_a', 'user_a@envbook.local');
    const userBCookie = await createTestUser('user_b', 'user_b@envbook.local');

    const entryId = randomUUID();

    // User A creates an entry
    const createRes = await request(app)
      .post('/api/v1/entries')
      .set('Cookie', userACookie)
      .send({
        entryId,
        type: 'credential',
        encryptedPayload: 'BASE64_CIPHERTEXT_USER_A',
        nonce: 'BASE64_NONCE_A',
      });
    expect(createRes.status).toBe(201);

    // User B attempts to read User A's entry -> 404 forbidden
    const readRes = await request(app)
      .get(`/api/v1/entries/${entryId}`)
      .set('Cookie', userBCookie);
    expect(readRes.status).toBe(404);

    // User B attempts to edit User A's entry -> 404 forbidden
    const editRes = await request(app)
      .put(`/api/v1/entries/${entryId}`)
      .set('Cookie', userBCookie)
      .send({
        encryptedPayload: 'MALICIOUS_OVERWRITE',
      });
    expect(editRes.status).toBe(404);

    // User B attempts to delete User A's entry -> 404 forbidden
    const delRes = await request(app)
      .delete(`/api/v1/entries/${entryId}`)
      .set('Cookie', userBCookie);
    expect(delRes.status).toBe(404);

    // User A reads their own entry -> 200
    const ownRead = await request(app)
      .get(`/api/v1/entries/${entryId}`)
      .set('Cookie', userACookie);
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.entry.encryptedPayload).toBe('BASE64_CIPHERTEXT_USER_A');
  });

  it('handles trash soft-delete and restore cycles', async () => {
    const cookie = await createTestUser('user_trash', 'user_trash@envbook.local');
    const entryId = randomUUID();

    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId,
        type: 'page',
        encryptedPayload: 'ORIGINAL_NOTE',
        nonce: 'NONCE_1',
      });

    // Soft-delete to Trash
    const delRes = await request(app)
      .delete(`/api/v1/entries/${entryId}`)
      .set('Cookie', cookie);
    expect(delRes.status).toBe(200);

    // Excluded from normal list
    const activeList = await request(app)
      .get('/api/v1/entries')
      .set('Cookie', cookie);
    expect(activeList.body.entries.some((e: any) => e.entryId === entryId)).toBe(false);

    // Present in Trash query
    const trashList = await request(app)
      .get('/api/v1/entries?isDeleted=true')
      .set('Cookie', cookie);
    expect(trashList.body.entries.some((e: any) => e.entryId === entryId)).toBe(true);

    // Restore from Trash
    const restoreRes = await request(app)
      .post(`/api/v1/entries/${entryId}/restore`)
      .set('Cookie', cookie);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.entry.isDeleted).toBe(false);

    // Back in normal list
    const restoredList = await request(app)
      .get('/api/v1/entries')
      .set('Cookie', cookie);
    expect(restoredList.body.entries.some((e: any) => e.entryId === entryId)).toBe(true);
  });

  it('tracks version history on payload update and restores past snapshot', async () => {
    const cookie = await createTestUser('user_hist', 'user_hist@envbook.local');
    const entryId = randomUUID();

    // Create v1
    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId,
        type: 'snippet',
        encryptedPayload: 'VERSION_1_CODE',
        nonce: 'NONCE_V1',
      });

    // Update to v2
    await request(app)
      .put(`/api/v1/entries/${entryId}`)
      .set('Cookie', cookie)
      .send({
        encryptedPayload: 'VERSION_2_CODE',
        nonce: 'NONCE_V2',
      });

    // Get history
    const histRes = await request(app)
      .get(`/api/v1/entries/${entryId}/history`)
      .set('Cookie', cookie);

    expect(histRes.status).toBe(200);
    expect(histRes.body.history.length).toBe(1);
    expect(histRes.body.history[0].encryptedPayload).toBe('VERSION_1_CODE');

    // Restore v1 snapshot
    const versionId = histRes.body.history[0].id;
    const restoreRes = await request(app)
      .post(`/api/v1/entries/${entryId}/history/${versionId}/restore`)
      .set('Cookie', cookie);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.entry.encryptedPayload).toBe('VERSION_1_CODE');
  });
});
