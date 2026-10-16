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

describe('Sharing, Permissions, Publishing, and Hierarchy Integrity', () => {
  it('prevents circular parent-child relationships', async () => {
    const cookie = await createTestUser('alice_tree', 'alice_tree@test.local');
    const page1Id = randomUUID();
    const page2Id = randomUUID();
    const page3Id = randomUUID();

    // Create Page 1 (root)
    const p1 = await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: page1Id,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_P1',
        nonce: 'NONCE_1',
      });
    expect(p1.status).toBe(201);

    // Create Page 2 with parent = Page 1
    const p2 = await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: page2Id,
        parentId: page1Id,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_P2',
        nonce: 'NONCE_2',
      });
    expect(p2.status).toBe(201);

    // Create Page 3 with parent = Page 2
    const p3 = await request(app)
      .post('/api/v1/entries')
      .set('Cookie', cookie)
      .send({
        entryId: page3Id,
        parentId: page2Id,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_P3',
        nonce: 'NONCE_3',
      });
    expect(p3.status).toBe(201);

    // Attempt to set Page 1's parent to itself -> 400
    const selfParent = await request(app)
      .put(`/api/v1/entries/${page1Id}`)
      .set('Cookie', cookie)
      .send({
        parentId: page1Id,
      });
    expect(selfParent.status).toBe(400);
    expect(selfParent.body.code).toBe('CIRCULAR_REFERENCE');

    // Attempt to set Page 1's parent to Page 3 (circular descendant cycle) -> 400
    const circularParent = await request(app)
      .put(`/api/v1/entries/${page1Id}`)
      .set('Cookie', cookie)
      .send({
        parentId: page3Id,
      });
    expect(circularParent.status).toBe(400);
    expect(circularParent.body.code).toBe('CIRCULAR_REFERENCE');
  });

  it('generates secure public share links and revokes them immediately', async () => {
    const ownerCookie = await createTestUser('bob_share', 'bob_share@test.local');
    const pageId = randomUUID();

    // Create note
    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', ownerCookie)
      .send({
        entryId: pageId,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_NOTE',
        nonce: 'NONCE_SHARE',
      });

    // Enable public link
    const enableRes = await request(app)
      .put(`/api/v1/pages/${pageId}/share/public-link`)
      .set('Cookie', ownerCookie)
      .send({
        isEnabled: true,
        accessLevel: 'viewer',
      });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.share.isPublicLinkEnabled).toBe(true);
    expect(enableRes.body.share.publicShareToken).toBeDefined();

    const token = enableRes.body.share.publicShareToken;

    // Fetch public shared page without authentication
    const publicRes = await request(app).get(`/api/v1/public/s/${token}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.pageId).toBe(pageId);

    // Revoke public link
    const revokeRes = await request(app)
      .delete(`/api/v1/pages/${pageId}/share/public-link`)
      .set('Cookie', ownerCookie);
    expect(revokeRes.status).toBe(200);

    // Public request with revoked token fails with 404
    const postRevokeRes = await request(app).get(`/api/v1/public/s/${token}`);
    expect(postRevokeRes.status).toBe(404);
  });

  it('blocks publication of secret-bearing environment or credential entries', async () => {
    const ownerCookie = await createTestUser('charlie_secrets', 'charlie_secrets@test.local');
    const envPageId = randomUUID();

    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', ownerCookie)
      .send({
        entryId: envPageId,
        type: 'environment_page',
        encryptedPayload: 'ENCRYPTED_ENV_VARS',
        nonce: 'NONCE_ENV',
      });

    // Attempt to publish environment page -> blocked with 400
    const pubRes = await request(app)
      .post(`/api/v1/pages/${envPageId}/publish`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Production Secrets',
        content: '<p>API_KEY=xyz</p>',
      });
    expect(pubRes.status).toBe(400);
    expect(pubRes.body.code).toBe('SECRET_PUBLICATION_BLOCKED');
  });

  it('publishes notes with stable slug and unpublishes cleanly', async () => {
    const ownerCookie = await createTestUser('dave_publish', 'dave_publish@test.local');
    const noteId = randomUUID();

    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', ownerCookie)
      .send({
        entryId: noteId,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_DAVE',
        nonce: 'NONCE_DAVE',
      });

    // Publish note
    const pubRes = await request(app)
      .post(`/api/v1/pages/${noteId}/publish`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Dave Guide to Docker',
        slug: 'docker-guide',
        content: '<h1>Docker Guide</h1><p>Welcome to Docker</p>',
      });
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.share.isPublished).toBe(true);
    expect(pubRes.body.share.publishedSlug).toBe('docker-guide');

    // Anonymous read of published page
    const readPub = await request(app).get('/api/v1/public/p/docker-guide');
    expect(readPub.status).toBe(200);
    expect(readPub.body.title).toBe('Dave Guide to Docker');
    expect(readPub.body.content).toContain('Docker Guide');

    // Unpublish
    const unpubRes = await request(app)
      .post(`/api/v1/pages/${noteId}/unpublish`)
      .set('Cookie', ownerCookie);
    expect(unpubRes.status).toBe(200);

    // Anonymous read now returns 404
    const readAfterUnpub = await request(app).get('/api/v1/public/p/docker-guide');
    expect(readAfterUnpub.status).toBe(404);
  });

  it('supports private collaborator invitation, notifications, and permission management', async () => {
    const ownerCookie = await createTestUser('emma_owner', 'emma@test.local');
    const collabCookie = await createTestUser('frank_collab', 'frank@test.local');
    const pageId = randomUUID();

    await request(app)
      .post('/api/v1/entries')
      .set('Cookie', ownerCookie)
      .send({
        entryId: pageId,
        type: 'notes_page',
        encryptedPayload: 'ENCRYPTED_EMMA',
        nonce: 'NONCE_EMMA',
      });

    // Search user
    const searchRes = await request(app)
      .get('/api/v1/users/search?q=frank')
      .set('Cookie', ownerCookie);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.users.length).toBeGreaterThanOrEqual(1);
    const frankId = searchRes.body.users[0].id;

    // Add collaborator
    const addCollabRes = await request(app)
      .post(`/api/v1/pages/${pageId}/collaborators`)
      .set('Cookie', ownerCookie)
      .send({
        usernameOrEmail: 'frank_collab',
        role: 'editor',
      });
    expect(addCollabRes.status).toBe(200);
    expect(addCollabRes.body.share.collaborators.length).toBe(1);

    // Frank checks notifications
    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Cookie', collabCookie);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.notifications.length).toBe(1);
    expect(notifRes.body.notifications[0].type).toBe('share_invite');
    expect(notifRes.body.unreadCount).toBe(1);

    // Frank marks notification as read
    const notifId = notifRes.body.notifications[0].id;
    const markReadRes = await request(app)
      .put(`/api/v1/notifications/${notifId}/read`)
      .set('Cookie', collabCookie);
    expect(markReadRes.status).toBe(200);

    // Update permission
    const updatePermRes = await request(app)
      .put(`/api/v1/pages/${pageId}/collaborators/${frankId}`)
      .set('Cookie', ownerCookie)
      .send({
        role: 'viewer',
      });
    expect(updatePermRes.status).toBe(200);
    expect(updatePermRes.body.share.collaborators[0].role).toBe('viewer');

    // Remove collaborator
    const removeRes = await request(app)
      .delete(`/api/v1/pages/${pageId}/collaborators/${frankId}`)
      .set('Cookie', ownerCookie);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.share.collaborators.length).toBe(0);
  });
});
