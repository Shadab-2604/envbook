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

  it('persists, updates, and removes document emoji icons', async () => {
    const cookie = await createTestUser('user_emoji', 'user_emoji@envbook.local');
    const entryId = randomUUID();

    // 1. Create entry with initial emoji icon
    const createRes = await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_NOTE_WITH_ROCKET',
        nonce: 'NONCE_EMOJI_1',
        icon: '🚀',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.entry.icon).toBe('🚀');

    // 2. Fetch entry and verify icon is preserved
    const getRes = await request(app)
      .get(`/api/v1/entries/${entryId}`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.entry.icon).toBe('🚀');

    // 3. Update icon to a different emoji
    const updateRes = await request(app)
      .put(`/api/v1/entries/${entryId}`)
      .set('Cookie', cookie)
      .send({
        icon: '💡',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.entry.icon).toBe('💡');

    // 4. Remove icon (set to null)
    const removeRes = await request(app)
      .put(`/api/v1/entries/${entryId}`)
      .set('Cookie', cookie)
      .send({
        icon: null,
      });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.entry.icon).toBeNull();

    // 5. Create entry without icon and verify default is null
    const noIconId = randomUUID();
    const createDefaultRes = await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: noIconId,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_NOTE_NO_ICON',
        nonce: 'NONCE_NO_ICON',
      });

    expect(createDefaultRes.status).toBe(201);
    expect(createDefaultRes.body.entry.icon).toBeNull();
  });

  it('recursively cascades subpage deletion and permanent deletion without leaving orphans', async () => {
    const cookie = await createTestUser('user_subpage_sync', 'user_subpage_sync@envbook.local');
    const parentId = randomUUID();
    const childId = randomUUID();
    const grandChildId = randomUUID();

    // 1. Create parent page
    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: parentId,
        type: 'notes_page',
        encryptedPayload: 'PARENT_PAGE_PAYLOAD',
        nonce: 'NONCE_PARENT',
      });

    // 2. Create child subpage under parent
    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: childId,
        type: 'notes_page',
        parentId,
        encryptedPayload: 'CHILD_PAGE_PAYLOAD',
        nonce: 'NONCE_CHILD',
      });

    // 3. Create grandchild subpage under child
    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: grandChildId,
        type: 'notes_page',
        parentId: childId,
        encryptedPayload: 'GRANDCHILD_PAGE_PAYLOAD',
        nonce: 'NONCE_GRANDCHILD',
      });

    // 4. Soft-delete parent -> should cascade soft-delete to child AND grandchild
    const softDelRes = await request(app)
      .delete(`/api/v1/entries/${parentId}`)
      .set('Cookie', cookie);
    expect(softDelRes.status).toBe(200);

    const childCheck = await request(app)
      .get(`/api/v1/entries/${childId}`)
      .set('Cookie', cookie);
    expect(childCheck.body.entry.isDeleted).toBe(true);

    const grandChildCheck = await request(app)
      .get(`/api/v1/entries/${grandChildId}`)
      .set('Cookie', cookie);
    expect(grandChildCheck.body.entry.isDeleted).toBe(true);

    // 5. Restore parent -> should cascade restore to child and grandchild
    const restoreRes = await request(app)
      .post(`/api/v1/entries/${parentId}/restore`)
      .set('Cookie', cookie);
    expect(restoreRes.status).toBe(200);

    const childRestored = await request(app)
      .get(`/api/v1/entries/${childId}`)
      .set('Cookie', cookie);
    expect(childRestored.body.entry.isDeleted).toBe(false);

    const grandChildRestored = await request(app)
      .get(`/api/v1/entries/${grandChildId}`)
      .set('Cookie', cookie);
    expect(grandChildRestored.body.entry.isDeleted).toBe(false);

    // 6. Permanent delete parent -> removes parent, child, and grandchild permanently
    const permDelRes = await request(app)
      .delete(`/api/v1/entries/${parentId}?permanent=true`)
      .set('Cookie', cookie);
    expect(permDelRes.status).toBe(200);

    const childPerm = await request(app)
      .get(`/api/v1/entries/${childId}`)
      .set('Cookie', cookie);
    expect(childPerm.status).toBe(404);

    const grandChildPerm = await request(app)
      .get(`/api/v1/entries/${grandChildId}`)
      .set('Cookie', cookie);
    expect(grandChildPerm.status).toBe(404);
  });
});
