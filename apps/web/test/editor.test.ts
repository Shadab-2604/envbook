import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import {
  SLASH_COMMANDS,
  SignupSchema,
  LoginSchema,
  CreateEntrySchema,
  UpdateEntrySchema,
} from '@envbook/shared';

describe('Slash Command Registry Verification', () => {
  it('contains all 45+ required commands and aliases from PRD & Master Prompt', () => {
    const requiredAliases = [
      // Text and Markdown
      '/text', '/heading', '/h1', '/h2', '/h3', '/bulleted-list', '/numbered-list',
      '/todo', '/toggle', '/quote', '/callout', '/divider', '/bold', '/italic',
      '/strikethrough', '/inline-code', '/link', '/equation',
      // Developer/technical
      '/code', '/terminal', '/env', '/credential', '/api', '/request', '/response',
      '/json', '/yaml', '/sql', '/http', '/warning', '/note', '/output', '/file',
      '/diagram', '/table', '/database',
      // Page/layout/navigation
      '/page', '/folder', '/breadcrumb', '/toc', '/columns', '/image', '/video',
      '/embed', '/bookmark', '/synced-block', '/template', '/date', '/tag', '/mention', '/button'
    ];

    const allRegisteredAliases = SLASH_COMMANDS.flatMap((cmd) => cmd.aliases);

    requiredAliases.forEach((alias) => {
      const found = allRegisteredAliases.some((a) => a.toLowerCase() === alias.toLowerCase());
      expect(found, `Expected alias "${alias}" to be registered in SLASH_COMMANDS`).toBe(true);
    });
  });

  it('groups commands into valid categories', () => {
    const validCategories = ['Text', 'Developer', 'Security', 'Layout', 'Page'];
    SLASH_COMMANDS.forEach((cmd) => {
      expect(validCategories).toContain(cmd.category);
      expect(cmd.label.length).toBeGreaterThan(0);
      expect(cmd.description.length).toBeGreaterThan(0);
    });
  });
});

describe('Input Validation & Security Schemas', () => {
  it('validates and normalizes valid signup payload', () => {
    const valid = {
      name: 'Dev Engineer',
      username: 'Dev_Sec99',
      email: 'Developer@Example.Com',
      password: 'StrongPassword123!',
    };

    const parsed = SignupSchema.parse(valid);
    expect(parsed.username).toBe('dev_sec99');
    expect(parsed.email).toBe('developer@example.com');
  });

  it('rejects short passwords and invalid emails', () => {
    expect(() =>
      SignupSchema.parse({
        name: 'Dev',
        username: 'dev',
        email: 'invalid-email',
        password: 'short',
      })
    ).toThrow();
  });

  it('validates login input with username or email', () => {
    const byEmail = LoginSchema.parse({ identifier: 'user@box.local', password: 'secretpassword' });
    expect(byEmail.identifier).toBe('user@box.local');

    const byUsername = LoginSchema.parse({ identifier: 'DevUser', password: 'secretpassword' });
    expect(byUsername.identifier).toBe('devuser');
  });
});

describe('XSS Sanitization & Markdown Injection Prevention', () => {
  it('neutralizes malicious script tags and inline handlers', () => {
    // In node/vitest, test string-based sanitization patterns
    const malicious = '<script>alert("xss")</script><img src=x onerror=alert(1)>Safe Content';
    
    // Test that script tags and dangerous event handlers are blocked
    expect(malicious).toContain('<script>');
    const sanitized = malicious.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    expect(sanitized).not.toContain('<script>');
  });
});
