import { z } from 'zod';

// ==========================================
// 1. ENTRY TYPES & CONSTANTS
// ==========================================
export const ENTRY_TYPES = [
  'notes_page',
  'section',
  'environment_page',
  'notes_section',
  'page',
  'folder',
  'idea',
  'project',
  'credential',
  'environment',
  'snippet',
  'command',
  'api',
  'document',
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export type WorkspaceItemType = 'notes_page' | 'section' | 'environment_page' | 'notes_section';

// ==========================================
// 2. AUTHENTICATION & USER SCHEMAS
// ==========================================
export const SignupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens and underscores')
    .transform((val) => val.toLowerCase()),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(255)
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Identifier is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export interface SafeUser {
  id: string;
  name: string;
  username: string;
  email: string;
  vaultInitialized: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. VAULT SCHEMAS & METADATA
// ==========================================
export const VaultSetupSchema = z.object({
  salt: z.string().min(1, 'Salt is required'),
  kdfParams: z.object({
    memoryCost: z.number().int().positive(),
    timeCost: z.number().int().positive(),
    parallelism: z.number().int().positive(),
  }),
  keyVersion: z.number().int().default(1),
  wrappedDEK: z.string().min(1, 'Wrapped DEK is required'),
  nonce: z.string().min(1, 'Nonce is required'),
  recoverySalt: z.string().optional(),
  recoveryWrappedDEK: z.string().optional(),
  recoveryNonce: z.string().optional(),
});

export type VaultSetupInput = z.infer<typeof VaultSetupSchema>;

export interface VaultStatusResponse {
  isInitialized: boolean;
  salt?: string;
  kdfParams?: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  keyVersion?: number;
  wrappedDEK?: string;
  nonce?: string;
  recoverySalt?: string;
  recoveryWrappedDEK?: string;
  recoveryNonce?: string;
}

// ==========================================
// 4. ENTRY API SCHEMAS
// ==========================================
export const CreateEntrySchema = z.object({
  entryId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  type: z.enum(ENTRY_TYPES),
  sortOrder: z.number().optional().default(0),
  encryptedPayload: z.string().min(1, 'Encrypted payload is required'),
  nonce: z.string().min(1, 'Nonce is required'),
  aad: z.string().optional().default(''),
  cryptoVersion: z.string().optional().default('1.0'),
  isFavorite: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  icon: z.string().max(32).nullable().optional(),
});

export type CreateEntryInput = z.input<typeof CreateEntrySchema>;

export const UpdateEntrySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
  encryptedPayload: z.string().optional(),
  nonce: z.string().optional(),
  aad: z.string().optional(),
  cryptoVersion: z.string().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  icon: z.string().max(32).nullable().optional(),
});

export type UpdateEntryInput = z.infer<typeof UpdateEntrySchema>;

export interface EntryRecord {
  id: string;
  entryId: string;
  parentId: string | null;
  type: EntryType;
  icon?: string | null;
  sortOrder: number;
  encryptedPayload: string;
  nonce: string;
  aad: string;
  cryptoVersion: string;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versionCount?: number;
}

export interface EntryVersionSnapshot {
  id: string;
  versionId: string;
  encryptedPayload: string;
  nonce: string;
  schemaVersion?: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5. CLIENT-SIDE DECRYPTED PAYLOAD TYPES
// ==========================================
export interface PagePayload {
  title: string;
  content: string; // Markdown or block JSON string
  icon?: string;
  tags?: string[];
  properties?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FolderPayload {
  title: string;
  icon?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CredentialPayload {
  title: string;
  provider: string;
  username?: string;
  secret: string;
  project?: string;
  environment?: string; // development, staging, production, custom
  url?: string;
  rotationDate?: string;
  expirationDate?: string;
  notes?: string;
  tags?: string[];
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  comment?: string;
}

export interface EnvironmentPayload {
  title: string;
  project?: string;
  environment: string; // development, staging, production
  variables: EnvironmentVariable[];
  tags?: string[];
}

export interface IdeaPayload {
  title: string;
  problem?: string;
  solution?: string;
  status: 'inbox' | 'considering' | 'planned' | 'in_progress' | 'done' | 'archived';
  project?: string;
  nextAction?: string;
  tags?: string[];
}

export interface ProjectPayload {
  title: string;
  problem?: string;
  objective?: string;
  stack?: string;
  architecture?: string;
  repoUrl?: string;
  status?: string;
  tasks?: Array<{ id: string; text: string; done: boolean }>;
  tags?: string[];
}

export interface SnippetPayload {
  title: string;
  language: string;
  code: string;
  purpose?: string;
  project?: string;
  tags?: string[];
}

export interface CommandPayload {
  title: string;
  command: string;
  shell?: string;
  description?: string;
  expectedOutput?: string;
  isDestructive?: boolean;
  tags?: string[];
}

export interface ApiPayload {
  title: string;
  baseUrl?: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  authType?: string;
  headers?: string;
  requestBody?: string;
  responseBody?: string;
  statusCodes?: string;
  tags?: string[];
}

export type DecryptedPayload =
  | ({ type: 'page' } & PagePayload)
  | ({ type: 'folder' } & FolderPayload)
  | ({ type: 'credential' } & CredentialPayload)
  | ({ type: 'environment' } & EnvironmentPayload)
  | ({ type: 'idea' } & IdeaPayload)
  | ({ type: 'project' } & ProjectPayload)
  | ({ type: 'snippet' } & SnippetPayload)
  | ({ type: 'command' } & CommandPayload)
  | ({ type: 'api' } & ApiPayload)
  | ({ type: 'document' } & PagePayload);

// ==========================================
// 6. SLASH COMMAND REGISTRY
// ==========================================
export interface SlashCommandItem {
  id: string;
  command: string; // e.g., '/h1'
  aliases: string[]; // e.g., ['/heading', '/h1']
  label: string; // e.g., 'Heading 1'
  description: string;
  category: 'Text' | 'Developer' | 'Security' | 'Layout' | 'Page';
  icon: string; // Material Symbol / Lucide icon name
  shortcut?: string;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  // --- AI Assistant ---
  {
    id: 'envai',
    command: '/envai',
    aliases: ['/envai', '/ai', '/assistant', '/ask', '/gemini'],
    label: 'Ask envAi',
    description: 'Brainstorm, summarize, turn to PRD, or analyze code with Gemini',
    category: 'Developer',
    icon: 'sparkles',
    shortcut: 'Ctrl+J',
  },
  // --- Text and Markdown ---
  {
    id: 'text',
    command: '/text',
    aliases: ['/text', '/p', '/paragraph'],
    label: 'Text',
    description: 'Plain body paragraph with Markdown formatting',
    category: 'Text',
    icon: 'text_fields',
  },
  {
    id: 'h1',
    command: '/h1',
    aliases: ['/h1', '/heading'],
    label: 'Heading 1',
    description: 'Large document section title',
    category: 'Text',
    icon: 'title',
    shortcut: '#',
  },
  {
    id: 'h2',
    command: '/h2',
    aliases: ['/h2', '/subheading'],
    label: 'Heading 2',
    description: 'Medium section heading',
    category: 'Text',
    icon: 'format_size',
    shortcut: '##',
  },
  {
    id: 'h3',
    command: '/h3',
    aliases: ['/h3', '/subsubheading'],
    label: 'Heading 3',
    description: 'Small subsection heading',
    category: 'Text',
    icon: 'text_format',
    shortcut: '###',
  },
  {
    id: 'bulleted-list',
    command: '/bulleted-list',
    aliases: ['/bulleted-list', '/bullet', '/ul'],
    label: 'Bulleted List',
    description: 'Unordered bullet list item',
    category: 'Text',
    icon: 'format_list_bulleted',
    shortcut: '-',
  },
  {
    id: 'numbered-list',
    command: '/numbered-list',
    aliases: ['/numbered-list', '/numbered', '/ol'],
    label: 'Numbered List',
    description: 'Ordered sequential list item',
    category: 'Text',
    icon: 'format_list_numbered',
    shortcut: '1.',
  },
  {
    id: 'todo',
    command: '/todo',
    aliases: ['/todo', '/check', '/task'],
    label: 'To-do List',
    description: 'Interactive checklist task item',
    category: 'Text',
    icon: 'check_box',
    shortcut: '[]',
  },
  {
    id: 'toggle',
    command: '/toggle',
    aliases: ['/toggle', '/collapsible'],
    label: 'Toggle List',
    description: 'Collapsible accordion block for details',
    category: 'Text',
    icon: 'chevron_right',
  },
  {
    id: 'quote',
    command: '/quote',
    aliases: ['/quote', '/blockquote'],
    label: 'Quote',
    description: 'Blockquote callout for citations',
    category: 'Text',
    icon: 'format_quote',
    shortcut: '>',
  },
  {
    id: 'callout',
    command: '/callout',
    aliases: ['/callout', '/info'],
    label: 'Callout',
    description: 'Highlighted note block with accent line',
    category: 'Text',
    icon: 'info',
  },
  {
    id: 'divider',
    command: '/divider',
    aliases: ['/divider', '/hr', '/line'],
    label: 'Divider',
    description: 'Hairline 1px horizontal rule separator',
    category: 'Text',
    icon: 'horizontal_rule',
    shortcut: '---',
  },
  {
    id: 'bold',
    command: '/bold',
    aliases: ['/bold', '/b'],
    label: 'Bold Format',
    description: 'Wrap active text in strong emphasis',
    category: 'Text',
    icon: 'format_bold',
    shortcut: '**text**',
  },
  {
    id: 'italic',
    command: '/italic',
    aliases: ['/italic', '/i'],
    label: 'Italic Format',
    description: 'Wrap active text in oblique emphasis',
    category: 'Text',
    icon: 'format_italic',
    shortcut: '*text*',
  },
  {
    id: 'strikethrough',
    command: '/strikethrough',
    aliases: ['/strikethrough', '/strike'],
    label: 'Strikethrough',
    description: 'Cross out text line',
    category: 'Text',
    icon: 'strikethrough_s',
    shortcut: '~~text~~',
  },
  {
    id: 'inline-code',
    command: '/inline-code',
    aliases: ['/inline-code', '/code-inline'],
    label: 'Inline Code',
    description: 'Format monospace code snippet within text',
    category: 'Text',
    icon: 'terminal',
    shortcut: '`code`',
  },
  {
    id: 'link',
    command: '/link',
    aliases: ['/link', '/url'],
    label: 'Hyperlink',
    description: 'Insert safe web or internal link',
    category: 'Text',
    icon: 'link',
  },
  {
    id: 'equation',
    command: '/equation',
    aliases: ['/equation', '/math', '/latex'],
    label: 'Math Equation',
    description: 'Mathematical expression block',
    category: 'Text',
    icon: 'functions',
  },

  // --- Developer & Technical ---
  {
    id: 'code',
    command: '/code',
    aliases: ['/code', '/snippet'],
    label: 'Code Block',
    description: 'Syntax-highlighted code block with language & copy',
    category: 'Developer',
    icon: 'code',
    shortcut: '```',
  },
  {
    id: 'terminal',
    command: '/terminal',
    aliases: ['/terminal', '/shell', '/bash', '/cli'],
    label: 'Terminal Command',
    description: 'Display-only shell command block (never auto-executed)',
    category: 'Developer',
    icon: 'terminal',
  },
  {
    id: 'env',
    command: '/env',
    aliases: ['/env', '/dotenv'],
    label: 'Environment Block',
    description: 'Structured KEY=VALUE block with masked secret values',
    category: 'Security',
    icon: 'key',
  },
  {
    id: 'credential',
    command: '/credential',
    aliases: ['/credential', '/secret', '/apikey'],
    label: 'Credential Card',
    description: 'AES-256-GCM client-side encrypted secret card',
    category: 'Security',
    icon: 'lock',
  },
  {
    id: 'api',
    command: '/api',
    aliases: ['/api', '/endpoint'],
    label: 'API Specification',
    description: 'Structured endpoint, method, headers, and params',
    category: 'Developer',
    icon: 'api',
  },
  {
    id: 'request',
    command: '/request',
    aliases: ['/request', '/http-request'],
    label: 'HTTP Request Sample',
    description: 'Formatted sample HTTP request payload',
    category: 'Developer',
    icon: 'send',
  },
  {
    id: 'response',
    command: '/response',
    aliases: ['/response', '/http-response'],
    label: 'HTTP Response Sample',
    description: 'Formatted sample HTTP response payload',
    category: 'Developer',
    icon: 'reply',
  },
  {
    id: 'json',
    command: '/json',
    aliases: ['/json'],
    label: 'JSON Data Block',
    description: 'Validated, syntax-colored JSON container',
    category: 'Developer',
    icon: 'data_object',
  },
  {
    id: 'yaml',
    command: '/yaml',
    aliases: ['/yaml', '/yml'],
    label: 'YAML Config Block',
    description: 'Structured YAML formatting with indentation check',
    category: 'Developer',
    icon: 'tune',
  },
  {
    id: 'sql',
    command: '/sql',
    aliases: ['/sql', '/query'],
    label: 'SQL Query Block',
    description: 'Syntax-colored SQL block (display only)',
    category: 'Developer',
    icon: 'database',
  },
  {
    id: 'http',
    command: '/http',
    aliases: ['/http', '/rest'],
    label: 'Raw HTTP Snippet',
    description: 'Raw protocol request/response representation',
    category: 'Developer',
    icon: 'http',
  },
  {
    id: 'warning',
    command: '/warning',
    aliases: ['/warning', '/alert', '/danger'],
    label: 'Security Warning',
    description: 'High-visibility security alert callout',
    category: 'Security',
    icon: 'warning',
  },
  {
    id: 'note',
    command: '/note',
    aliases: ['/note', '/annotation'],
    label: 'Technical Note',
    description: 'Compact technical annotation block',
    category: 'Developer',
    icon: 'sticky_note_2',
  },
  {
    id: 'output',
    command: '/output',
    aliases: ['/output', '/log'],
    label: 'Command Output',
    description: 'Expected console output or log excerpt',
    category: 'Developer',
    icon: 'output',
  },
  {
    id: 'file',
    command: '/file',
    aliases: ['/file', '/attachment'],
    label: 'File Attachment',
    description: 'Local file reference or supported download link',
    category: 'Developer',
    icon: 'attach_file',
  },
  {
    id: 'diagram',
    command: '/diagram',
    aliases: ['/diagram', '/flowchart', '/mermaid'],
    label: 'Mermaid Diagram',
    description: 'Architecture flow or sequence diagram',
    category: 'Developer',
    icon: 'schema',
  },
  {
    id: 'table',
    command: '/table',
    aliases: ['/table', '/grid'],
    label: 'Data Table',
    description: 'Structured rows and columns table',
    category: 'Developer',
    icon: 'table_chart',
  },
  {
    id: 'database',
    command: '/database',
    aliases: ['/database', '/collection'],
    label: 'Database View',
    description: 'Filtered view of entries or credentials',
    category: 'Developer',
    icon: 'view_kanban',
  },

  // --- Page, Layout & Navigation ---
  {
    id: 'page',
    command: '/page',
    aliases: ['/page', '/subpage', '/new-page'],
    label: 'New Page',
    description: 'Open type selector to create a page or container',
    category: 'Page',
    icon: 'article',
  },
  {
    id: 'section',
    command: '/section',
    aliases: ['/section', '/new-section', '/folder', '/dir'],
    label: 'New Section',
    description: 'Create an organizational container for child items',
    category: 'Page',
    icon: 'folder',
  },
  {
    id: 'notes-page',
    command: '/notes-page',
    aliases: ['/notes-page', '/note', '/notes'],
    label: 'Notes Page',
    description: 'Create a standard rich-text document with inline editor',
    category: 'Page',
    icon: 'description',
  },
  {
    id: 'environment',
    command: '/environment',
    aliases: ['/environment', '/env-page', '/env-vars'],
    label: 'Environment Page',
    description: 'Create a page for managing bulk .env variables',
    category: 'Page',
    icon: 'tune',
  },
  {
    id: 'notes-section',
    command: '/notes-section',
    aliases: ['/notes-section'],
    label: 'Notes Section',
    description: 'Create a container specifically for organizing notes',
    category: 'Page',
    icon: 'folder_special',
  },
  {
    id: 'breadcrumb',
    command: '/breadcrumb',
    aliases: ['/breadcrumb', '/path'],
    label: 'Breadcrumbs',
    description: 'Display ancestry path to the active document',
    category: 'Layout',
    icon: 'more_horiz',
  },
  {
    id: 'toc',
    command: '/toc',
    aliases: ['/toc', '/table-of-contents', '/outline'],
    label: 'Table of Contents',
    description: 'Auto-updating jump links to all headings',
    category: 'Layout',
    icon: 'format_list_bulleted',
  },
  {
    id: 'columns',
    command: '/columns',
    aliases: ['/columns', '/grid-2', '/split'],
    label: 'Two Columns',
    description: 'Side-by-side split that collapses on mobile',
    category: 'Layout',
    icon: 'view_column',
  },
  {
    id: 'image',
    command: '/image',
    aliases: ['/image', '/img'],
    label: 'Image',
    description: 'Safe local or web image embed',
    category: 'Layout',
    icon: 'image',
  },
  {
    id: 'video',
    command: '/video',
    aliases: ['/video'],
    label: 'Video Link',
    description: 'Safe external video placeholder',
    category: 'Layout',
    icon: 'smart_display',
  },
  {
    id: 'embed',
    command: '/embed',
    aliases: ['/embed', '/iframe'],
    label: 'Safe Embed',
    description: 'Allowlisted iframe preview',
    category: 'Layout',
    icon: 'web',
  },
  {
    id: 'bookmark',
    command: '/bookmark',
    aliases: ['/bookmark'],
    label: 'Web Bookmark',
    description: 'Link card with title and safe preview',
    category: 'Layout',
    icon: 'bookmark',
  },
  {
    id: 'synced-block',
    command: '/synced-block',
    aliases: ['/synced-block', '/reusable'],
    label: 'Synced Block',
    description: 'Reusable block synced across pages',
    category: 'Layout',
    icon: 'sync',
  },
  {
    id: 'template',
    command: '/template',
    aliases: ['/template', '/insert-template'],
    label: 'Insert Template',
    description: 'Apply pre-configured PRD, project or API layout',
    category: 'Page',
    icon: 'content_paste',
  },
  {
    id: 'date',
    command: '/date',
    aliases: ['/date', '/today'],
    label: 'Current Date',
    description: 'Insert timestamp or date badge',
    category: 'Page',
    icon: 'calendar_today',
  },
  {
    id: 'tag',
    command: '/tag',
    aliases: ['/tag', '/label'],
    label: 'Tag Badge',
    description: 'Add a categorized filter tag',
    category: 'Page',
    icon: 'label',
  },
  {
    id: 'mention',
    command: '/mention',
    aliases: ['/mention', '/link-page'],
    label: 'Mention Entry',
    description: 'Cross-reference another page or credential',
    category: 'Page',
    icon: 'alternate_email',
  },
  {
    id: 'button',
    command: '/button',
    aliases: ['/button', '/action'],
    label: 'Action Button',
    description: 'Predefined safe in-app action (e.g. Export, Lock)',
    category: 'Layout',
    icon: 'smart_button',
  },
];

// ==========================================
// 7. PREDEFINED TEMPLATES
// ==========================================
export interface PredefinedTemplate {
  id: string;
  name: string;
  description: string;
  type: EntryType;
  defaultPayload: DecryptedPayload;
}

export const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    id: 'project-starter',
    name: 'Project Specification',
    description: 'Standard software engineering project outline',
    type: 'project',
    defaultPayload: {
      type: 'project',
      title: 'New Engineering Project',
      problem: 'What specific friction or business limitation are we solving?',
      objective: 'Core outcome and verifiable definition of success.',
      stack: 'TypeScript, Next.js, Express, MongoDB, Tailwind CSS',
      architecture: 'Asymmetric encryption boundary, client-side AES-GCM, Express REST API',
      repoUrl: '',
      status: 'In Planning',
      tasks: [
        { id: '1', text: 'Define threat model & security boundaries', done: false },
        { id: '2', text: 'Configure Express endpoints & Zod validators', done: false },
        { id: '3', text: 'Build client-side Web Crypto decryption', done: false },
        { id: '4', text: 'Execute end-to-end integration tests', done: false },
      ],
      tags: ['architecture', 'engineering'],
    },
  },
  {
    id: 'prd-template',
    name: 'Product Requirements Document (PRD)',
    description: 'Exhaustive product requirements and acceptance criteria template',
    type: 'document',
    defaultPayload: {
      type: 'document',
      title: 'PRD: Feature Specification',
      content: `# Feature Specification PRD\n\n## 1. Executive Summary\nBrief summary of the feature and core value proposition.\n\n## 2. Problem Statement\nWhat pain points exist and why are existing tools insufficient?\n\n## 3. Goals & Non-Goals\n- **Goal:** Specific achievable milestone.\n- **Non-Goal:** Items explicitly postponed or out of scope.\n\n## 4. Personas & Use Cases\n- **Primary Persona:** Developer or security engineer.\n- **User Journey:** Capture idea -> organize into project -> secure credentials.\n\n## 5. Technical Architecture\n- Data model specifications.\n- Encryption boundaries & zero-knowledge guarantees.\n\n## 6. Acceptance Criteria\n- [ ] All inputs validated with typed schemas.\n- [ ] Client-side encryption verifies round trip.\n- [ ] UI tested on desktop and mobile viewports.\n`,
      tags: ['prd', 'spec'],
    },
  },
  {
    id: 'api-reference-template',
    name: 'API Reference',
    description: 'REST API endpoint documentation with requests and responses',
    type: 'api',
    defaultPayload: {
      type: 'api',
      title: 'API: Auth Service v1',
      baseUrl: 'https://api.internal.local',
      endpoint: '/api/v1/session/verify',
      method: 'POST',
      authType: 'Bearer Token (Ed25519)',
      headers: 'Authorization: Bearer <TOKEN>\nContent-Type: application/json',
      requestBody: '{\n  "sessionId": "uuid-v4",\n  "clientNonce": "base64-nonce"\n}',
      responseBody: '{\n  "valid": true,\n  "expiresIn": 900,\n  "claims": { "role": "operator" }\n}',
      statusCodes: '200 OK - Token valid\n401 Unauthorized - Signature mismatch\n429 Too Many Requests - Throttled',
      tags: ['api', 'rest'],
    },
  },
  {
    id: 'idea-quick-capture',
    name: 'Idea Capture',
    description: 'Lightweight technical concept or architectural thought',
    type: 'idea',
    defaultPayload: {
      type: 'idea',
      title: 'Distributed SQLite Sync with CRDTs',
      problem: 'Multi-device state synchronization without central server plaintext access.',
      solution: 'Evaluate Yjs over WebRTC with client-side encrypted blobs.',
      status: 'considering',
      nextAction: 'Benchmark y-webrtc latency across local LAN mesh.',
      tags: ['sqlite', 'sync', 'crdt'],
    },
  },
  {
    id: 'snippet-template',
    name: 'Code Snippet',
    description: 'Reusable algorithm, middleware or utility function',
    type: 'snippet',
    defaultPayload: {
      type: 'snippet',
      title: 'auth_middleware.go',
      language: 'go',
      purpose: 'Validates asymmetric Ed25519 JWT bearer tokens and checks revocation cache.',
      code: `package middleware

import (
    "strings"
    "errors"
)

var ErrMalformedHeader = errors.New("malformed authorization header")

func ValidateBearer(authHeader string) (string, error) {
    if !strings.HasPrefix(authHeader, "Bearer ") {
        return "", ErrMalformedHeader
    }
    return strings.TrimPrefix(authHeader, "Bearer "), nil
}`,
      tags: ['backend', 'go', 'auth'],
    },
  },
];

export const TEMPLATES = PREDEFINED_TEMPLATES.map((t) => ({
  id: t.id === 'project-starter' ? 'project' : t.id === 'prd-starter' ? 'prd' : t.id === 'api-contract' ? 'api' : t.id,
  name: t.name,
  description: t.description,
  content:
    t.id === 'project-starter'
      ? '## Problem Statement\n\n## Objectives\n\n## Architecture Stack\n\n## Acceptance Criteria'
      : t.id === 'prd-starter'
      ? '## Overview\n\n## Functional Scope\n\n## Security & Threat Model\n\n## Tasks & Milestones'
      : '## Base URL\n\n## Endpoints\n\n## Authentication & Headers\n\n## Request & Response Payloads',
}));

export type DecryptedNotePayload = PagePayload;
export type DecryptedIdeaPayload = IdeaPayload & { description?: string; votes?: number; createdAt?: string };
export type DecryptedCredentialPayload = {
  title: string;
  value: string;
  type: 'api_key' | 'database_uri' | 'password' | 'token' | 'ssh_key' | 'smtp' | 'secret';
  provider?: string;
  project?: string;
  purpose?: string;
  rotationDays?: number;
  updatedAt?: string;
};
export type DecryptedEnvironmentPayload = {
  name: 'production' | 'staging' | 'development' | 'testing';
  variables: Array<{ key: string; value: string; comment?: string }>;
  updatedAt?: string;
};
export type DecryptedSnippetPayload = {
  title: string;
  language: string;
  code: string;
  description?: string;
  tags?: string[];
  updatedAt?: string;
};

// ==========================================
// 8. ENVAI TYPES, SCHEMAS & INTERFACES
// ==========================================
export const ENVAI_ACTIONS = [
  'brainstorm',
  'title',
  'expand',
  'improve',
  'continue',
  'summarize',
  'outline',
  'prd',
  'tone',
  'shorten',
  'expand_length',
  'explain_code',
  'cybersecurity',
  'custom',
  'chat',
] as const;

export type EnvAiAction = (typeof ENVAI_ACTIONS)[number];

export type EnvAiContextScope = 'current_note' | 'selected' | 'my_notes';

export interface EnvAiCitation {
  source: 'note' | 'file';
  title: string;
  id?: string;
  path?: string;
  snippet?: string;
  pageOrLine?: string;
}

export interface EnvAiFileMeta {
  name: string;
  type: string;
  size: number;
  parsed?: boolean;
  error?: string;
}

export interface EnvAiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: EnvAiCitation[];
  timestamp: string;
  files?: EnvAiFileMeta[];
  mode?: string;
}

export interface EnvAiConfigStatus {
  isConfigured: boolean;
  model: string;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed' | 'untested';
  message?: string;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow: string;
  outputLimit: string;
  isRecommended?: boolean;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const AVAILABLE_GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Flagship next-gen Flash model with exceptional speed, deep reasoning, and high throughput (Google Recommended)',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
    isRecommended: true,
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o (Omni)',
    description: 'Flagship high-intelligence reasoning model from OpenAI for coding, synthesis, and deep logic (OpenAI Recommended)',
    contextWindow: '128,000 tokens',
    outputLimit: '16,384 tokens',
    isRecommended: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    description: 'Ultra-fast and cost-efficient multimodal intelligence model from OpenAI',
    contextWindow: '128,000 tokens',
    outputLimit: '16,384 tokens',
  },
  {
    id: 'openai/gpt-latest',
    name: 'Eden AI — OpenAI GPT Latest (gpt-6-astra)',
    description: 'OpenAI flagship multi-modal reasoning model via Eden AI Unified Gateway with 1M context window',
    contextWindow: '1,050,000 tokens (~1M)',
    outputLimit: '4,096 tokens',
  },
  {
    id: 'edenai',
    name: 'Eden AI (Unified Multi-Model Gateway)',
    description: 'Unified AI engine aggregating top LLMs with automated provider routing, fallbacks, and multi-model access via Eden AI API key',
    contextWindow: '128,000+ tokens',
    outputLimit: '4,096 tokens',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    description: 'Always routes to the newest stable production Flash model released by Google',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'High-speed reasoning model tailored for technical documentation, coding, and analysis',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Fast, cost-efficient, and versatile multimodal model with strong baseline capabilities',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'Frontier reasoning model for complex architectural reviews, PRDs, and deep refactoring',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro Latest',
    description: 'Latest high-capacity Pro model with advanced analytical depth',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Ultra-low latency model engineered for quick completions, grammar, and brief summaries',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Established high-reasoning model with expansive 1M context',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Reliable high-throughput workhorse for standard developer workflows',
    contextWindow: '1,048,576 tokens (~1M)',
    outputLimit: '65,536 tokens',
  },
  {
    id: 'gemma-4-31b-it',
    name: 'Gemma 4 31B IT',
    description: 'Instruction-tuned open model architecture optimized for direct coding assistance',
    contextWindow: '262,144 tokens',
    outputLimit: '32,768 tokens',
  },
];

/**
 * Normalizes user/API model input:
 * - Strips redundant 'models/' prefix (e.g. 'models/gemini-3.8-flash' -> 'gemini-3.8-flash')
 * - Automatically migrates retired models (e.g. 'gemini-2.0-flash', 'gemini-1.5-*') to DEFAULT_GEMINI_MODEL
 */
export function normalizeGeminiModel(rawModel?: string): string {
  if (!rawModel) return DEFAULT_GEMINI_MODEL;
  let model = rawModel.trim();
  if (model.startsWith('models/')) {
    model = model.slice(7);
  }
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
    return model;
  }
  if (model === 'openai/gpt-latest' || model.startsWith('openai/')) {
    return model;
  }
  if (model.toLowerCase().includes('edenai') || model.toLowerCase().includes('eden-ai')) {
    return 'edenai';
  }
  // Auto-migrate retired or deprecated models to Google recommended gemini-3.8-flash
  if (
    model === 'gemini-2.0-flash' ||
    model.startsWith('gemini-2.0') ||
    model.startsWith('gemini-1.5')
  ) {
    return DEFAULT_GEMINI_MODEL;
  }
  return model || DEFAULT_GEMINI_MODEL;
}

export const EnvAiConfigSchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters').max(300),
  model: z.string().optional().default(DEFAULT_GEMINI_MODEL),
});

export type EnvAiConfigInput = z.infer<typeof EnvAiConfigSchema>;

export const EnvAiGenerateSchema = z.object({
  action: z.enum(ENVAI_ACTIONS).default('custom'),
  prompt: z.string().trim().max(12000, 'Prompt too long'),
  contextText: z.string().max(40000).optional(),
  scope: z.enum(['current_note', 'selection', 'selected', 'my_notes']).default('current_note').optional(),
  currentNoteId: z.string().optional(),
  currentNoteTitle: z.string().optional(),
  tone: z.enum(['concise', 'professional', 'technical', 'friendly']).optional(),
  files: z
    .array(
      z.object({
        name: z.string().max(255),
        type: z.string().max(100),
        content: z.string().max(300000), // base64 or raw text
        isBase64: z.boolean().optional(),
      })
    )
    .max(10)
    .optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20)
    .optional(),
});

export type EnvAiGenerateInput = z.infer<typeof EnvAiGenerateSchema>;
export type EnvAiScope = 'current_note' | 'selection' | 'selected' | 'my_notes';
export type EnvAiTone = 'concise' | 'professional' | 'technical' | 'friendly';

// ==========================================
// 8. SHARING, PUBLISHING & COLLABORATION
// ==========================================
export type CollaboratorRole = 'viewer' | 'editor';

export interface CollaboratorInfo {
  userId: string;
  username: string;
  email: string;
  name?: string;
  role: CollaboratorRole;
  invitedAt: string;
}

export interface PageShareRecord {
  pageId: string;
  ownerId: string;
  isOwner?: boolean;
  currentUserRole?: 'owner' | CollaboratorRole;
  isPublicLinkEnabled: boolean;
  publicShareToken: string | null;
  publicAccessLevel: CollaboratorRole;
  publicUrl?: string;
  isPublished: boolean;
  publishedSlug: string | null;
  publishedUrl?: string;
  publishedTitle?: string;
  publishedContent?: string;
  publishedAt?: string | null;
  collaborators: CollaboratorInfo[];
  createdAt: string;
  updatedAt: string;
}

export const SharePublicLinkSchema = z.object({
  isEnabled: z.boolean(),
  accessLevel: z.enum(['viewer', 'editor']).default('viewer').optional(),
});
export type SharePublicLinkInput = z.infer<typeof SharePublicLinkSchema>;

export const PublishPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(60, 'Slug cannot exceed 60 characters')
    .regex(/^[a-z0-9-_]+$/, 'Slug must only contain lowercase letters, numbers, hyphens and underscores')
    .optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string(),
});
export type PublishPageInput = z.infer<typeof PublishPageSchema>;

export const AddCollaboratorSchema = z.object({
  usernameOrEmail: z.string().trim().min(1, 'Username or email is required'),
  role: z.enum(['viewer', 'editor']).default('viewer'),
});
export type AddCollaboratorInput = z.infer<typeof AddCollaboratorSchema>;

export const UpdateCollaboratorSchema = z.object({
  role: z.enum(['viewer', 'editor']),
});
export type UpdateCollaboratorInput = z.infer<typeof UpdateCollaboratorSchema>;

// ==========================================
// 9. IN-APP NOTIFICATIONS
// ==========================================
export const NOTIFICATION_TYPES = [
  'share_invite',
  'permission_change',
  'access_revoked',
  'page_published',
  'page_unpublished',
  'collab_edit',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRecord {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  pageId: string;
  pageTitle: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ==========================================
// 10. CODE BLOCK PROGRAMMING LANGUAGES
// ==========================================
export interface CodeLanguage {
  id: string;
  label: string;
  aliases?: string[];
}

export const SUPPORTED_CODE_LANGUAGES: CodeLanguage[] = [
  { id: 'plaintext', label: 'Plain Text', aliases: ['text', 'txt', 'none'] },
  { id: 'javascript', label: 'JavaScript', aliases: ['js', 'jsx', 'node'] },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts', 'tsx'] },
  { id: 'python', label: 'Python', aliases: ['py', 'python3'] },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++', aliases: ['c++', 'cplusplus', 'cc'] },
  { id: 'csharp', label: 'C#', aliases: ['c#', 'cs', 'dotnet'] },
  { id: 'php', label: 'PHP' },
  { id: 'html', label: 'HTML', aliases: ['xml', 'svg'] },
  { id: 'css', label: 'CSS', aliases: ['scss', 'sass', 'less'] },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML', aliases: ['yml'] },
  { id: 'sql', label: 'SQL', aliases: ['mysql', 'postgres', 'sqlite'] },
  { id: 'bash', label: 'Bash', aliases: ['sh', 'shell', 'zsh'] },
  { id: 'powershell', label: 'PowerShell', aliases: ['ps1', 'ps'] },
  { id: 'markdown', label: 'Markdown', aliases: ['md'] },
];


