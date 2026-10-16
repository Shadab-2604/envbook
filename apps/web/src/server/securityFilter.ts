/**
 * envAi Server-Side Sensitive Content Screening & Redaction Layer
 * Defense-in-depth secondary safeguard to ensure secrets are never leaked to external AI models.
 */

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp; replaceWith: string }> = [
  // Database & URI credentials with username/password
  {
    name: 'URI_CREDENTIAL',
    regex: /(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp|https?):\/\/[^:\s'"]+:([^@\s'"]+)@/gi,
    replaceWith: '$1://[REDACTED_USER]:[REDACTED_SECRET]@',
  },
  // Private Key Blocks
  {
    name: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g,
    replaceWith: '[REDACTED_PRIVATE_KEY_BLOCK]',
  },
  // Authorization / Bearer Tokens (matched before standalone JWT)
  {
    name: 'BEARER_TOKEN',
    regex: /Bearer\s+[A-Za-z0-9._~+/-]{16,}/gi,
    replaceWith: 'Bearer [REDACTED_BEARER_TOKEN]',
  },
  // JWT tokens
  {
    name: 'JWT_TOKEN',
    regex: /ey[A-Za-z0-9_-]{12,}\.ey[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}/g,
    replaceWith: '[REDACTED_JWT_TOKEN]',
  },
  // Common key-value secret assignments (.env style, config files)
  {
    name: 'SECRET_KEY_VALUE',
    regex: /(?:^|[\r\n\s,;])([A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|KEY|TOKEN|CREDENTIAL|PRIVATE)[A-Z0-9_]*)\s*[:=]\s*["']?([^\r\n\s"']{3,})["']?/g,
    replaceWith: ' $1=[REDACTED_SECRET]',
  },
];

/**
 * Checks if text contains obvious secret material
 */
export function detectSecrets(text: string): { containsSecrets: boolean; patternsFound: string[] } {
  if (!text) return { containsSecrets: false, patternsFound: [] };

  const found: string[] = [];
  for (const p of SECRET_PATTERNS) {
    p.regex.lastIndex = 0;
    if (p.regex.test(text)) {
      found.push(p.name);
    }
  }

  return {
    containsSecrets: found.length > 0,
    patternsFound: found,
  };
}

/**
 * Redacts detected secrets with safe placeholders
 */
export function redactSecrets(text: string): { redactedText: string; count: number; redactedCount: number } {
  if (!text) return { redactedText: '', count: 0, redactedCount: 0 };

  let result = text;
  let count = 0;

  for (const p of SECRET_PATTERNS) {
    p.regex.lastIndex = 0;
    const matches = result.match(p.regex);
    if (matches) {
      count += matches.length;
      result = result.replace(p.regex, p.replaceWith);
    }
  }

  return { redactedText: result, count, redactedCount: count };
}

/**
 * Extracts sensitive key names from text (.env lines or configs)
 */
export function extractSensitiveKeys(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  const regex = /(?:^|[\r\n\s,;])([A-Za-z0-9_]{3,})\s*[:=]\s*["']?([^\r\n\s"']{3,})["']?/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1];
    if (/SECRET|PASSWORD|PASS|KEY|TOKEN|AUTH/i.test(key)) {
      if (!found.includes(key)) {
        found.push(key);
      }
    }
  }
  return found;
}

/**
 * Enforces resource type allowlists.
 * Strictly disallows Environment Pages and Credentials from being used as context for envAi.
 */
export function isResourceAllowed(resourceType?: string): boolean {
  if (!resourceType) return true;
  const disallowed = ['environment', 'credential', 'environment_page', 'secret', 'env_var'];
  return !disallowed.includes(resourceType.toLowerCase());
}
