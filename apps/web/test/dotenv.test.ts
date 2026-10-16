import { describe, it, expect } from 'vitest';
import { parseDotenv, deduplicateVariables } from '../src/lib/dotenv';

describe('Dotenv Parser Unit Tests (ENVBOOK_ENV_IMPORT_CORRECTION_PROMPT.md Section 3)', () => {
  it('parses valid KEY=VALUE pairs ignoring comments and blank lines', () => {
    const raw = `
# Local development configuration
MONGODB_URI=mongodb://localhost:27017/envbook_dev

# App Settings
PORT=3000
JWT_SECRET=super_secret_jwt_key_here
`;

    const result = parseDotenv(raw);
    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(3);

    expect(result.variables[0]).toMatchObject({
      key: 'MONGODB_URI',
      value: 'mongodb://localhost:27017/envbook_dev',
      lineNumber: 3,
    });
    expect(result.variables[1]).toMatchObject({
      key: 'PORT',
      value: '3000',
      lineNumber: 6,
    });
    expect(result.variables[2]).toMatchObject({
      key: 'JWT_SECRET',
      value: 'super_secret_jwt_key_here',
      lineNumber: 7,
    });
  });

  it('supports CRLF and LF line endings equivalently', () => {
    const crlf = 'KEY_ONE=val1\r\nKEY_TWO=val2\r\n\r\nKEY_THREE=val3\r\n';
    const result = parseDotenv(crlf);
    expect(result.validCount).toBe(3);
    expect(result.variables.map((v) => v.key)).toEqual(['KEY_ONE', 'KEY_TWO', 'KEY_THREE']);
    expect(result.variables[2].value).toBe('val3');
  });

  it('splits only on the first equals sign to preserve values with multiple equals signs', () => {
    const raw = 'BASE64_TOKEN=ZXlKaGJHY2lPaUpTVXpVbkxhYmNkZWZn==\nCOMPLEX_FORMULA=a=1&b=2=3';
    const result = parseDotenv(raw);
    expect(result.validCount).toBe(2);
    expect(result.variables[0].value).toBe('ZXlKaGJHY2lPaUpTVXpVbkxhYmNkZWZn==');
    expect(result.variables[1].value).toBe('a=1&b=2=3');
  });

  it('preserves URLs and special query characters in values', () => {
    const raw = 'DATABASE_URL=postgres://app_user:p@ss%23word@cluster.us-east.rds.amazonaws.com:5432/main_db?sslmode=require#replica';
    const result = parseDotenv(raw);
    expect(result.validCount).toBe(1);
    expect(result.variables[0].value).toBe(
      'postgres://app_user:p@ss%23word@cluster.us-east.rds.amazonaws.com:5432/main_db?sslmode=require#replica'
    );
  });

  it('handles double-quoted and single-quoted values and trims whitespace appropriately', () => {
    const raw = `
DOUBLE_QUOTED="  hello world with spaces  "
SINGLE_QUOTED='single quote text'
WITH_ESCAPES="line 1\\nline 2\\ttabbed"
`;
    const result = parseDotenv(raw);
    expect(result.validCount).toBe(3);
    expect(result.variables[0].value).toBe('  hello world with spaces  ');
    expect(result.variables[1].value).toBe('single quote text');
    expect(result.variables[2].value).toBe('line 1\nline 2\ttabbed');
  });

  it('allows empty values when deliberate (KEY=)', () => {
    const raw = 'EMPTY_OPTIONAL_FLAG=';
    const result = parseDotenv(raw);
    expect(result.validCount).toBe(1);
    expect(result.variables[0].key).toBe('EMPTY_OPTIONAL_FLAG');
    expect(result.variables[0].value).toBe('');
  });

  it('detects malformed lines (missing =, invalid key name) and reports line numbers', () => {
    const raw = `
VALID_KEY=good_value
THIS LINE HAS NO EQUALS
123_INVALID_KEY_START=bad
KEY WITH SPACES=bad
=VALUE_WITH_NO_KEY
`;
    const result = parseDotenv(raw);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(4);

    expect(result.errors[0].lineNumber).toBe(3);
    expect(result.errors[0].message).toContain("missing the '=' separator");

    expect(result.errors[1].lineNumber).toBe(4);
    expect(result.errors[1].message).toContain('invalid key "123_INVALID_KEY_START"');

    expect(result.errors[2].lineNumber).toBe(5);
    expect(result.errors[2].message).toContain('invalid key "KEY WITH SPACES"');

    expect(result.errors[3].lineNumber).toBe(6);
    expect(result.errors[3].message).toContain('empty variable key name');
  });

  it('detects duplicate keys in import and supports deterministic deduplication', () => {
    const raw = `
API_KEY=first_value
OTHER_KEY=something
API_KEY=second_value
`;
    const result = parseDotenv(raw);
    expect(result.validCount).toBe(3);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates[0]).toEqual({
      key: 'API_KEY',
      lineNumbers: [2, 4],
    });

    // Test keep_last deduplication
    const keepLast = deduplicateVariables(result.variables, 'keep_last');
    expect(keepLast.length).toBe(2);
    expect(keepLast.find((v) => v.key === 'API_KEY')?.value).toBe('second_value');

    // Test keep_first deduplication
    const keepFirst = deduplicateVariables(result.variables, 'keep_first');
    expect(keepFirst.length).toBe(2);
    expect(keepFirst.find((v) => v.key === 'API_KEY')?.value).toBe('first_value');
  });

  it('detects collisions with existing stored variables', () => {
    const raw = `
EXISTING_VAR=updated_value
NEW_VAR=brand_new_value
`;
    const existing = ['EXISTING_VAR', 'OLD_UNUSED_KEY'];
    const result = parseDotenv(raw, existing);

    expect(result.validCount).toBe(2);
    expect(result.collisionCount).toBe(1);
    expect(result.collisions).toEqual(['EXISTING_VAR']);
    expect(result.variables[0].isCollision).toBe(true);
    expect(result.variables[1].isCollision).toBe(false);
  });

  it('efficiently handles 100+ variables in a test fixture', () => {
    const lines: string[] = [];
    for (let i = 1; i <= 150; i++) {
      lines.push(`SERVICE_${i}_API_KEY=mock_key_generated_val_${i}_xyz789==`);
    }
    const raw = lines.join('\n');

    const start = performance.now();
    const result = parseDotenv(raw);
    const duration = performance.now() - start;

    expect(result.validCount).toBe(150);
    expect(result.errorCount).toBe(0);
    expect(duration).toBeLessThan(50); // parses in < 50ms
  });
});
