import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Auth API Endpoints', () => {
  it('registers a new user successfully and sets HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Alice Security',
        username: 'alice_sec',
        email: 'alice@envbook.local',
        password: 'SuperSecretPassword123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('alice_sec');
    expect(res.body.user.email).toBe('alice@envbook.local');
    expect(res.body.user.vaultInitialized).toBe(false);

    // Verify cookie was set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieString = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieString).toContain('envbook_token=');
    expect(cookieString).toContain('HttpOnly');
  });

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Bob Original',
        username: 'bob_unique',
        email: 'bob1@envbook.local',
        password: 'Password123!',
      });

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Bob Duplicate',
        username: 'bob_unique',
        email: 'bob2@envbook.local',
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_EXISTS');
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Charlie One',
        username: 'charlie1',
        email: 'charlie@envbook.local',
        password: 'Password123!',
      });

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Charlie Two',
        username: 'charlie2',
        email: 'charlie@envbook.local',
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_EXISTS');
  });

  it('logs in with username or email', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'David Test',
        username: 'david_test',
        email: 'david@envbook.local',
        password: 'SecretPassword99!',
      });

    // Login with username
    const resUser = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'david_test',
        password: 'SecretPassword99!',
      });

    expect(resUser.status).toBe(200);
    expect(resUser.body.user.username).toBe('david_test');

    // Login with email
    const resEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'david@envbook.local',
        password: 'SecretPassword99!',
      });

    expect(resEmail.status).toBe(200);
    expect(resEmail.body.user.email).toBe('david@envbook.local');
  });

  it('rejects login with wrong password without leaking user existence', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Eva Test',
        username: 'eva_test',
        email: 'eva@envbook.local',
        password: 'RealPassword123!',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'eva_test',
        password: 'WrongPassword456!',
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('enforces auth on /me and handles logout', async () => {
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Frank Vault',
        username: 'frank_v',
        email: 'frank@envbook.local',
        password: 'FrankPassword123!',
      });

    const cookies = signupRes.headers['set-cookie'];

    // Call /me without cookie -> 401
    const unauth = await request(app).get('/api/v1/auth/me');
    expect(unauth.status).toBe(401);

    // Call /me with cookie -> 200
    const authRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies);
    expect(authRes.status).toBe(200);
    expect(authRes.body.user.username).toBe('frank_v');

    // Logout
    const logoutRes = await request(app).post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(200);
  });
});
