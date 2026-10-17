/**
 * Robust, secure dotenv parser for EnvBook bulk environment-variable manager.
 * Complies with ENVBOOK_ENV_IMPORT_CORRECTION_PROMPT.md Section 3:
 * - Line endings: LF & CRLF
 * - Skips empty/whitespace lines and leading # comments
 * - Splits KEY=VALUE only at the first '='
 * - Trims whitespace around key and delimiter
 * - Strips enclosing double or single quotes safely
 * - Preserves URLs and values with internal '=' and '#'
 * - Never evaluates shell commands or variable interpolations
 * - Validates variable names against ^[A-Za-z_][A-Za-z0-9_]*$
 * - Reports exact line numbers and error diagnostics
 * - Detects duplicates and existing key collisions
 */

export interface ParsedEnvVariable {
  lineNumber: number;
  key: string;
  value: string;
  rawLine: string;
  isDuplicate?: boolean;
  duplicateOfLine?: number;
  isCollision?: boolean;
}

export interface ParseEnvError {
  lineNumber: number;
  rawLine: string;
  message: string;
}

export interface ParseEnvResult {
  variables: ParsedEnvVariable[];
  errors: ParseEnvError[];
  duplicates: Array<{ key: string; lineNumbers: number[] }>;
  collisions: string[];
  totalLines: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  collisionCount: number;
}

const KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Safely strips enclosing quotes and resolves standard string escape sequences if double-quoted.
 */
function normalizeEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();

  // Double quoted value
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const unquoted = trimmed.slice(1, -1);
    // Unescape standard escapes: \\n -> \n, \\r -> \r, \\t -> \t, \\" -> ", \\\\ -> \
    return unquoted
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  // Single quoted value (literal value, no escape translation)
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  // Unquoted value: preserve internal spaces, trim leading/trailing whitespace
  return trimmed;
}

/**
 * Parse raw .env content into structured variables with validation and collision checks.
 *
 * @param content Raw multiline string from user or file
 * @param existingKeys Optional array or set of already saved keys for collision detection
 */
export function parseDotenv(
  content: string,
  existingKeys: string[] | Set<string> = []
): ParseEnvResult {
  const existingSet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);

  const variables: ParsedEnvVariable[] = [];
  const errors: ParseEnvError[] = [];
  const keyOccurrences = new Map<string, number[]>();

  // Normalize line endings: split by CRLF or LF
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    // 1. Ignore blank lines or lines containing only whitespace
    if (!trimmed) {
      return;
    }

    // 2. Ignore comments where first non-whitespace character is '#'
    if (trimmed.startsWith('#')) {
      return;
    }

    // 3. Must contain an '=' separator
    const firstEq = line.indexOf('=');
    if (firstEq === -1) {
      errors.push({
        lineNumber,
        rawLine: line,
        message: `Line ${lineNumber} is missing the '=' separator. Expected KEY=VALUE syntax.`,
      });
      return;
    }

    // 4. Split key and value only at first '='
    const rawKey = line.slice(0, firstEq).trim();
    const rawValue = line.slice(firstEq + 1);

    // 5. Validate Key Name
    if (!rawKey) {
      errors.push({
        lineNumber,
        rawLine: line,
        message: `Line ${lineNumber} has an empty variable key name.`,
      });
      return;
    }

    if (!KEY_REGEX.test(rawKey)) {
      errors.push({
        lineNumber,
        rawLine: line,
        message: `Line ${lineNumber} has invalid key "${rawKey}". Variable names must start with a letter or underscore and contain only alphanumeric characters and underscores (^[A-Za-z_][A-Za-z0-9_]*$).`,
      });
      return;
    }

    // 6. Normalize Value
    const normalizedValue = normalizeEnvValue(rawValue);

    // 7. Track occurrences for duplicate detection
    const existingLines = keyOccurrences.get(rawKey) || [];
    existingLines.push(lineNumber);
    keyOccurrences.set(rawKey, existingLines);

    const isDuplicate = existingLines.length > 1;
    const isCollision = existingSet.has(rawKey);

    variables.push({
      lineNumber,
      key: rawKey,
      value: normalizedValue,
      rawLine: line,
      isDuplicate,
      duplicateOfLine: isDuplicate ? existingLines[0] : undefined,
      isCollision,
    });
  });

  // Calculate duplicate summary
  const duplicates: Array<{ key: string; lineNumbers: number[] }> = [];
  keyOccurrences.forEach((lineNumbers, key) => {
    if (lineNumbers.length > 1) {
      duplicates.push({ key, lineNumbers });
    }
  });

  // Calculate collision summary
  const collisions = Array.from(
    new Set(variables.filter((v) => v.isCollision).map((v) => v.key))
  );

  return {
    variables,
    errors,
    duplicates,
    collisions,
    totalLines: lines.length,
    validCount: variables.length,
    errorCount: errors.length,
    duplicateCount: duplicates.length,
    collisionCount: collisions.length,
  };
}

/**
 * Deduplicate variables based on policy:
 * - 'keep_first': keeps the first occurrence of each key
 * - 'keep_last': keeps the last occurrence of each key
 */
export function deduplicateVariables(
  variables: ParsedEnvVariable[],
  policy: 'keep_first' | 'keep_last' = 'keep_last'
): ParsedEnvVariable[] {
  const map = new Map<string, ParsedEnvVariable>();

  if (policy === 'keep_first') {
    for (const v of variables) {
      if (!map.has(v.key)) {
        map.set(v.key, v);
      }
    }
  } else {
    for (const v of variables) {
      map.set(v.key, v);
    }
  }

  return Array.from(map.values());
}

/**
 * Formats structured environment variables into standard .env file content.
 * Complies with reverse-operation of parseDotenv:
 * - Formats KEY=VALUE
 * - Preserves comments if present (# comment)
 * - Quotes values containing spaces, newlines, quotes, or '#'
 * - Escapes internal quotes and newlines in quoted values
 * - Preserves equal signs in values
 */
export function generateDotenv(
  variables: Array<{ key: string; value: string; comment?: string }>
): string {
  if (!variables || variables.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const v of variables) {
    if (v.comment && v.comment.trim()) {
      lines.push(`# ${v.comment.trim()}`);
    }

    const key = v.key.trim();
    const val = v.value ?? '';

    // Check if value needs quoting:
    // Needs quotes if it has newlines, leading/trailing whitespace, quotes, or contains '#'
    const hasNewlines = val.includes('\n') || val.includes('\r');
    const hasQuotes = val.includes('"') || val.includes("'");
    const hasWhitespace = /^\s|\s$/.test(val);
    const hasCommentChar = val.includes('#');

    if (hasNewlines || hasWhitespace || hasQuotes || hasCommentChar) {
      const escaped = val
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      lines.push(`${key}="${escaped}"`);
    } else {
      lines.push(`${key}=${val}`);
    }
  }

  return lines.join('\n') + '\n';
}
