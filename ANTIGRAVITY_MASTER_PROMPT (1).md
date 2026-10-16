# EnvBook — Antigravity Master Implementation Prompt

> **Execution mode:** Implement the entire application in the current project repository, test it end to end, repair failures, and deliver only when all achievable production-readiness gates pass. Do not stop after planning, scaffolding, mockups, or a partial MVP.

## 0. Your role and completion rule

Act as a senior full-stack TypeScript engineer, application-security engineer, UI implementation specialist, and test engineer. Work directly in the existing EnvBook project directory. The repository already contains the full `PRD.md` and the Stitch UI ZIP. Locate and read them before changing files. Do not ask me to repeat information already present in the repository.

**Primary inputs:**
- The complete `PRD.md` in the project directory. Read all of it, not only its first pages.
- `stitch_minimalist_dark_notes_ui.zip`, containing desktop/mobile reference screens, HTML exports, and `terminal_noir/DESIGN.md`.
- The actual repository structure and existing code, if any.

If the names or nesting differ, inspect the repository and find the existing files. Do not assume a new empty project. Preserve useful existing work, but refactor insecure or broken code when required. First write a concise internal implementation checklist, then immediately execute it. Do not return only a plan. Do not leave TODOs, placeholder handlers, fake API calls, or nonfunctional UI controls for required features.

**Priority if instructions conflict:**
1. This prompt's explicit technology and environment constraints.
2. The complete `PRD.md` for product scope and functional requirements.
3. The supplied Stitch HTML/screenshots and `DESIGN.md` for visual implementation.
4. Established security and accessibility best practices.

Where the PRD's earlier local-first/SQLite assumption conflicts with this prompt, this prompt overrides it: use Next.js + TypeScript frontend, Express + TypeScript backend, and MongoDB. Retain all compatible PRD requirements and account/login requirements below.

## 1. Product objective

Build **EnvBook**, a polished, responsive private developer workspace that combines:
- Folder and nested-page organization.
- A Notion-inspired block editor with `/` commands and live Markdown rendering.
- Project ideas, technical documentation, code snippets, API notes, and templates.
- A dedicated encrypted secrets vault and `.env` manager.
- Full-text search, tags, favorites, recently updated items, archive, trash, restore, import/export, and backups.
- A deliberate, low-clutter desktop experience and a fully usable mobile experience.

This must be a real, data-backed full-stack application. MongoDB must persist the data, the Express API must enforce authentication/authorization, and the Next.js frontend must call the real backend. Do not fake persistence using only `localStorage`, static JSON, hardcoded records, or frontend-only arrays.

## 2. Mandatory technology and architecture

- **Frontend:** latest stable compatible Next.js using the App Router, React, and TypeScript. Use actual Next.js dynamic route segments such as `[pageId]`, `[folderId]`, and `[entryId]` where appropriate. Use typed route params, strict TypeScript, semantic HTML, and server/client component boundaries deliberately.
- **Backend:** Express.js with TypeScript, independently structured routes/controllers/services/validators/middleware.
- **Database:** MongoDB through Mongoose (or another strongly justified MongoDB TypeScript ODM if the repository already uses one well).
- **Validation:** a typed schema-validation library such as Zod on every API boundary. Validate on the server even when the client validates.
- **Editor:** use a maintained block/rich-text editor library that supports slash menus, code blocks, keyboard navigation, and Markdown import/export. Avoid writing a custom editor engine from scratch. Add an appropriate syntax highlighter and safe Markdown renderer.
- **Testing:** unit tests, API integration tests, and browser end-to-end tests using a maintained test stack such as Vitest/Supertest/Playwright. Reuse existing compatible test infrastructure where practical.
- Use current stable, maintained packages that work together. Avoid prerelease packages, deprecated APIs, and unnecessary dependencies. Check package compatibility before installation.
- Keep readable modules and clean boundaries. Avoid overengineering, duplicate abstractions, giant components, and unnecessary services. Add concise meaningful comments explaining security-sensitive logic and non-obvious data flows.

A straightforward repository layout is encouraged, adapted to the existing repository:

```text
/
  PRD.md
  .env.example
  package.json
  apps/
    web/                 # Next.js App Router + TypeScript
    api/                 # Express + TypeScript + Mongoose
  packages/
    shared/              # shared schemas/types only if truly useful
  tests/                 # cross-app tests if appropriate
  README.md
  SECURITY.md
```

A simpler layout is acceptable if it maintains clear separation between frontend and backend. Provide root scripts to install, develop, test, lint, type-check, and build the apps.

## 3. Environment-file restriction — absolute requirement

The project's `.env` and `.env.example` must contain **only these three variable names** and nothing else:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/envbook
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
```

- `MONGODB_URI`: MongoDB connection URI.
- `PORT`: Express API port, default `5000`.
- `JWT_SECRET`: high-entropy server-only JWT signing secret. It is a signing key, **not** a pre-generated user JWT.
- Do not add `NEXT_PUBLIC_API_URL`, encryption keys, vault passphrases, frontend URL variables, `NODE_ENV`, analytics keys, email keys, or other environment variables.
- Next.js should run explicitly on port `3000` using its npm scripts. Express uses `PORT` (default to `5000` only when the variable is absent). Proxy frontend `/api/...` requests through Next.js to the Express service using a server-side rewrite/configuration that derives the backend port from the existing `PORT` variable and has a safe `5000` fallback. The browser must call relative `/api/...` URLs and must not receive the MongoDB URI or JWT secret.
- In a production deployment, route the public app origin to Next.js and proxy `/api/*` to Express through the deployment/reverse-proxy configuration. Do not require another `.env` variable for the frontend API origin.
- Do not overwrite a pre-existing real `.env` or disclose/print its values. Inspect whether the three required keys exist without displaying secret values. Update `.env.example` to exactly those three keys. If the local `.env` has unrelated old variables, remove them only after preserving the three required values and ensuring the app remains runnable; never commit `.env`.
- Add `.env`, database dumps, backups, test reports with sensitive payloads, and key material to `.gitignore` as appropriate. Never commit working credentials. Document how to generate a random `JWT_SECRET` without storing another setting.
- Do not log connection strings, JWTs, cookies, request bodies containing secrets, passwords, passphrases, decrypted note bodies, recovery keys, or `.env` values.

## 4. Authentication and account flows

Implement actual signup, login, logout, session protection, and account settings.

### Signup fields, in this order
1. Full name.
2. Username.
3. Email.
4. Password.
5. Confirm password.

Requirements:
- Name and username must be required and length-limited.
- Normalize username consistently and enforce case-insensitive uniqueness; normalize email and enforce case-insensitive uniqueness.
- Validate email format and a sensible username format (letters/numbers/underscores/dashes as appropriate).
- Enforce a strong password policy; use a modern password hashing algorithm, preferably Argon2id with a justified, benchmarked cost. Never store or log plaintext passwords. Do not hash passwords with SHA-256 alone.
- Client-side confirm-password equality validation, but never send/store `confirmPassword` as an account field.
- Correct inline validation, field-level messages, loading state, disabled submit while pending, accessible error summaries, and duplicate username/email handling.
- Do not create a production default account or hardcode demo credentials.

### Login fields
1. One identifier field accepting **username or email**.
2. Password.

Requirements:
- Validate input, use a generic response for invalid credentials to reduce account enumeration, and rate-limit login attempts.
- Implement logout that invalidates/removes the client session cookie and has a documented/token-revocation strategy appropriate to the chosen JWT design.
- Protected pages redirect unauthenticated users to login without redirect loops. Authenticated users should not be sent back to signup/login unnecessarily.
- Show useful error states without returning stack traces or sensitive internals.
- Never store the JWT in `localStorage`, `sessionStorage`, URLs, or browser-readable persistent storage. Use a secure `HttpOnly`, `SameSite` cookie and `Secure` in production; keep the cookie path and expiry deliberate. Use appropriately short-lived JWTs, verify issuer/audience/expiry and expected claims, and avoid sensitive data in claims.
- Because cookie authentication is used, implement same-origin/origin checking and suitable CSRF protection. Avoid broad wildcard CORS. Allow the known local development origin, and use same-origin reverse proxy in production.
- Apply reasonable request body limits and rate limits to signup, login, unlock-related metadata endpoints, import, export, and expensive operations.

### Password eye/reveal controls — must be universal
Every UI field that accepts a password or passphrase must have a working show/hide eye button, including password and confirm-password on signup, login password, account password change, vault passphrase creation/confirmation, vault unlock, and recovery-key/passphrase entry when applicable.
- Toggle the corresponding field between `password` and `text` without clearing its value or moving focus.
- Provide accessible names such as “Show password” / “Hide password”, keyboard operation, visible focus state, and a non-submit button type.
- Use the supplied eye/eye-off icon style where available.
- Never implement the icon as a decorative control with no action.

## 5. Vault encryption and secret handling

Credential security is a core product feature. Do not treat a JWT or server login as encryption for note contents.

### Separate two concepts
- **Account password:** authenticates the account; server stores only a modern adaptive hash.
- **Vault passphrase:** unlocks client-side encryption; it must never be sent to Express, stored in MongoDB, logged, or added to `.env`.

### Encryption architecture
- Use reviewed, maintained cryptographic libraries/APIs. Use browser Web Crypto AES-256-GCM for authenticated encryption and Argon2id-based key derivation using a maintained compatible library. Do not invent cryptography, use ECB, hardcode a key, use a fixed salt, or use reversible encryption for account passwords.
- Generate a cryptographically secure random vault data-encryption key (DEK) client-side. Derive a key-encryption key from the user's vault passphrase using a unique per-vault random salt and appropriate Argon2id parameters, then wrap/encrypt the DEK. Store only the salt, KDF parameters, key version, nonce and wrapped ciphertext on the server. Do not persist the unwrapped DEK or decrypted content in localStorage/sessionStorage/IndexedDB. Keep the unlocked key in memory only and clear it from application state on lock/logout/session end. Explain unavoidable limits of memory clearing in documentation.
- If implementing the recovery feature in the PRD, generate a high-entropy recovery secret client-side, use it only to wrap the DEK as an additional recovery path, show it once, require the user to confirm they saved it, and never upload/store its plaintext. Recovery metadata/wrapped key may be stored on the backend. Document that losing all unlock/recovery material makes the encrypted data unrecoverable.
- Generate a new unique nonce/IV for every AES-GCM encryption. Store algorithm/version metadata needed for future migrations. Use safe authenticated additional data (AAD) binding ciphertext to its user, record, and schema/key version so encrypted records cannot be swapped between users/records unnoticed.
- Encrypt the whole sensitive payload client-side before sending it to Express: page/folder title, rich-text/Markdown document JSON, tags, credentials and values, environment names/values, snippets, notes, filenames and other user-authored sensitive content. MongoDB may store only the minimum routing and lifecycle metadata required by the backend (random record ID, owner ID, parent ID, entry type/category only if accepted by the threat model, position, timestamps, ciphertext, nonce, KDF/key version fields). Do not store plaintext titles or note bodies merely to simplify search.
- Search must work client-side over decrypted in-memory records while the vault is unlocked. Do not build plaintext server-side indexes for sensitive fields.
- Use cryptographically secure IDs where appropriate and enforce record ownership on every request. An encrypted payload is not a replacement for backend authorization.
- Show a vault-unlock passphrase setup screen during first-time onboarding, informed by the Stitch design. Distinguish it clearly from the account password. Re-lock after an inactivity period, on logout, and on explicit lock; stop rendering decrypted data immediately and clear decrypted in-memory state as far as practical.
- Mask secrets by default. Reveal a secret only after an explicit click, auto-remask after 15 seconds (matching the design guidance), and make copy a deliberate action. Clear clipboard after a configurable short interval when feasible, without falsely claiming guaranteed clipboard deletion. Avoid accidental copying from a masked card.
- Exclude secret values and decrypted payloads from analytics, logs, telemetry, crash reports, notifications, URLs, error details, normal exports, and UI debugging tools. Do not add analytics/AI cloud processing.
- Normal notes/Markdown export must exclude credential entries and environment secret values by default. Secret export and `.env` generation require explicit action, confirmation, and client-side generation/download; never log or transmit plaintext export content unnecessarily.
- Any content rendered as HTML must be sanitized. Disable arbitrary unsafe HTML in Markdown unless an explicit sanitizer with safe allowlisting is used. Prevent stored/reflected XSS in notes, code blocks, link previews and imported Markdown.

If any cryptographic design requirement proves incompatible with a selected library, do not silently weaken it. Use another maintained library, implement an established construction correctly, test it, and document the decision. The app must not claim “zero knowledge” unless the server genuinely cannot decrypt any user content and the design has been verified accordingly.

## 6. MongoDB data model and backend requirements

Create typed, indexed models and migrations/versioning as necessary. Every user-created record is owned by a user and server-side ownership must be checked for list/read/update/move/archive/trash/delete/restore/export operations.

Recommended model boundaries:
- `User`: name, normalized username, normalized email, password hash, account timestamps/status, vault KDF metadata, wrapped DEK/recovery-wrapped DEK metadata, key/schema versions. Never save plaintext vault passphrase or plaintext recovery key.
- `Entry`: owner ID, stable random ID, type, parent ID, sort position, encrypted payload, nonce, encryption/schema version, created/updated timestamps, archived/trash metadata.
- Optional `Session`/revocation record only if needed for the selected JWT invalidation design.
- Optional audit/security-event model records event type, user/record ID, timestamp and safe metadata only; never secret or decrypted content.

Backend conventions:
- Version the API under `/api/v1` and keep request/response shapes typed and documented.
- Separate route definitions, controllers, validation schemas, business services, DB models, auth middleware, encryption metadata validators, error middleware and config validation.
- Add health/readiness endpoints that reveal status, not secrets or DB connection details.
- Add pagination for large lists, stable sorting, query limits and reasonable body/upload size limits.
- Add indexes for normalized unique username/email, owner+updatedAt, owner+parentId, owner+status/type and other evidence-based query patterns. Use projections and pagination to avoid reading every record unnecessarily.
- Configure Mongoose connection lifecycle correctly, graceful shutdown, unhandled rejection/exception handling, and predictable API errors. Do not swallow DB failures.
- Validate MongoDB IDs and all input types. Protect against operator injection and mass assignment by allowing only known fields; never pass arbitrary client objects directly to Mongo queries or model updates.
- Use Helmet with sensible headers, TLS in production, origin/CSRF protections, login and API rate limiting, secure cookies, request-size limits, input validation, dependency auditing and generic production errors. Do not expose stack traces, secrets, file paths, internal environment values or raw Mongo errors to clients.
- Configure logging with structured redaction. Verify by tests that passwords, JWTs, passphrases, recovery keys, encrypted or decrypted secret values and `.env` lines do not leak into logs.

## 7. Next.js routing and application layout

Use App Router and true dynamic routes with typed parameters. Avoid implementing a fake client-side router around a single page.

Implement routes appropriate to the design and PRD, including at least:
- `/` — redirect appropriately based on auth/vault state, without a loop.
- `/signup` and `/login`.
- `/vault/setup` and `/vault/unlock`.
- `/app` — home/dashboard.
- `/app/ideas` — ideas inbox/quick capture.
- `/app/credentials` — credentials manager.
- `/app/environments` — environments/secrets manager.
- `/app/projects` — project library.
- `/app/search` — global search.
- `/app/favorites`, `/app/recent`, `/app/archive`, `/app/trash`.
- `/app/settings` — account, vault lock/inactivity, security and export/backup settings.
- `/app/page/[pageId]`, `/app/folder/[folderId]`, `/app/entry/[entryId]` (or equivalent clear dynamic routes).
- A real not-found page and safe redirect/authorization handling.

Use server-side/session-aware protection where appropriate and verify ownership through the API on every data operation. The frontend's protected layout is not a substitute for backend authorization. Set correct dynamic metadata, avoid leaking decrypted records through server-rendered HTML caches, static generation, shared caches, error telemetry, or prefetch payloads. Sensitive pages/data must not be publicly cached. Use `Cache-Control: no-store` for sensitive API responses and avoid storing decrypted content in Next.js server caches.

## 8. Required product features — do not omit items from PRD

Read the entire `PRD.md` and create a requirement checklist keyed to each feature. Every feature categorized as required or included in the PRD's planned phases must be implemented and checked. If an item is explicitly a non-goal (for example, team collaboration/public sharing/cloud account features), do not implement it; record that exclusion clearly. Do not silently drop features or treat a static UI as implementation.

### 8.1 Workspace, pages, folders and navigation
- Home dashboard with recent items, favorites and quick actions.
- One private workspace.
- Create/rename/delete/move folders and pages; nested folders and subpages.
- Drag-and-drop ordering and moving, with accessible keyboard alternatives.
- Collapse/expand hierarchy; breadcrumbs.
- Page/folder icons.
- Favorites/pinned items; recently opened and modified lists.
- Archive/unarchive; soft-delete to trash; restore; permanent delete confirmation.
- Duplicate a page and, where appropriate, its child content.
- Sorting by title/date/modified time; tags and project categories.
- Templates for pages, projects, PRDs and common entries.
- Import supported Markdown/text/document formats with validation and safe parsing; export notes as Markdown and other PRD-supported formats.
- Context menus and bulk move/tag/archive operations.
- Empty, loading, error, success and destructive-confirmation states.

### 8.2 Block editor — mandatory inline WYSIWYG behavior

**Critical acceptance requirement:** The default page editor must behave like Notion: the user writes directly on the formatted page canvas, and block formatting is displayed in place as they type or select slash commands. Do not build a Markdown `<textarea>` with a separate rendered preview beneath it. Do not ship two synchronized source/preview panels. Use one genuinely editable content surface backed by a maintained rich-text/block editor such as Tiptap/ProseMirror.

- Title and page content are edited in place. Tags/properties may appear beneath the title. The content canvas uses an empty-state placeholder such as “Type '/' for commands…”.
- A `contenteditable`-based rich-text/block editing surface is the default. Headings, lists, tasks, quotes, callouts, tables and code blocks render formatted while they are being edited. Raw Markdown markers should transform in place when recognized.
- The Markdown/source view is optional and disabled by default. Remove the always-visible separate preview. Markdown remains a supported import/export format, not the primary edit surface.
- Type `/` at the caret to open a filtered command menu anchored near the caret. Typing filters results. Arrow keys navigate, Enter selects, Escape dismisses, and selection/caret/focus are preserved. The picker must work with mouse, keyboard and mobile touch.
- Use real editor nodes/transactions rather than regex replacements across a textarea. Code blocks must be editable, support language selection, syntax highlighting and copy, and must not be marked read-only unless the user explicitly chooses such a block type.
- Persist a versioned structured editor document, preferably Tiptap/ProseMirror JSON, as the authoritative document. Convert existing Markdown content safely and preserve older notes. Keep title, tags and page metadata in their appropriate fields.
- Autosave through the Express API to MongoDB. Show Saving/Saved/Save failed only based on real backend outcomes. Preserve undo/redo and selection; prevent stale responses from overwriting newer edits.
- Use maintained, version-compatible extensions for common blocks, tasks, tables, links, code and slash commands. Keep a typed, centralized registry for every required slash command and alias.
- Sanitize imported Markdown/HTML and URLs. Maintain all credential-encryption and secret-handling requirements; never expose secret plaintext through logs, HTML attributes or analytics.
- On mobile, keep the slash picker inside the viewport and ensure typing, selection, block tools and save states remain usable. Follow both Stitch references.
- Add acceptance tests proving that there is no Markdown textarea-plus-preview split, slash commands insert at the caret, blocks stay editable after reload, autosave is real, failed saves are visible, and every command alias works. Inspect running desktop/mobile screenshots before delivery.

### 8.2 Block editor
- Live-formatted block editor with a raw Markdown/source toggle.
- Markdown import/export and predictable conversion behavior.
- Slash command opens beside the caret; live filtering; grouped commands; keyboard arrow navigation; Enter to choose; Escape to close; preserve cursor/content; undo/redo.
- Block type conversion, copy controls, code syntax highlighting, language selector, tables, links, callouts, quote/toggle blocks, dividers, images and supported embeds.
- Table of contents, breadcrumbs, columns that collapse to a vertical stack on mobile, synced/reusable block functionality where supported, date, mention/cross-link, safe bookmark/link preview, diagram embed, template and tag insertion.
- Keyboard-first editing, accessible focus indicators, and no raw HTML/XSS execution.

### 8.3 Required slash-command registry
Implement all of the following commands/aliases, grouping and documenting them in the code. Aliases may map to the same editor node/transform, but every alias listed must be searchable and usable:

**Text and Markdown:**
`/text`, `/heading`, `/h1`, `/h2`, `/h3`, `/bulleted-list`, `/numbered-list`, `/todo`, `/toggle`, `/quote`, `/callout`, `/divider`, `/bold`, `/italic`, `/strikethrough`, `/inline-code`, `/link`, `/equation`.

**Developer/technical:**
`/code`, `/terminal`, `/env`, `/credential`, `/api`, `/request`, `/response`, `/json`, `/yaml`, `/sql`, `/http`, `/warning`, `/note`, `/output`, `/file`, `/diagram`, `/table`, `/database`.

**Page/layout/navigation:**
`/page`, `/folder`, `/breadcrumb`, `/toc`, `/columns`, `/image`, `/video`, `/embed`, `/bookmark`, `/synced-block`, `/template`, `/date`, `/tag`, `/mention`, `/button`.

- `/code` must open a real language-selectable code block with copy functionality.
- `/terminal` is a display-only terminal command block; never execute commands.
- `/env` creates a structured environment block with masked values, never plaintext-by-default.
- `/credential` creates a secure secret entry/card and encrypts the payload before network transmission.
- `/api`, `/request`, `/response`, `/json`, `/yaml`, `/sql`, `/http` create useful predefined structures or code/data blocks, not empty decorative placeholders.
- `/warning`, `/note`, `/output`, `/table`, `/database`, `/template`, `/image`, `/file`, `/folder`, `/page`, and all other commands must perform the behavior their label promises or show a clear supported flow/error when the underlying feature is unavailable.
- `/equation` can use a maintained safe math renderer. `/video` and `/embed` must use a safe allowlist; they are never a reason to allow arbitrary script execution.
- `/button` may run only explicitly configured safe in-app actions. It must not run arbitrary shell commands, dynamic code, or network requests to unknown hosts.

### 8.4 Markdown typing shortcuts
Implement and test these shortcuts, including conversion only in the appropriate context:
- `# Heading` → H1.
- `## Heading` → H2.
- `### Heading` → H3.
- `- Item` → bulleted list.
- `1. Item` → numbered list.
- `[] ` → checkbox trigger if supported by the editor's parser; document its exact behavior.
- `> ` → map consistently to a quote or toggle shortcut and document the choice; don't ambiguously map it to two blocks.
- `**text**` → bold.
- `*text*` → italic.
- `` `code` `` → inline code.
- `~~text~~` → strikethrough.
- Triple backticks → multiline code block with optional language.
- `/` → slash menu.

### 8.5 Ideas, projects, snippets and databases
- Quick capture ideas without a multi-step form, plus an Ideas Inbox.
- Project templates and PRD template fields: problem, objective, stack, architecture, scope, acceptance criteria, tasks and links.
- Technical notes, API docs, endpoint/auth/request/response snippets, code/terminal library, deployment notes and reusable snippets.
- Entry types: idea, project, credential, environment, snippet, API document, page/document and supported attachment.
- Typed properties such as type, project, tags, status, dates and relations. Keep sensitive values encrypted in the client payload.
- Table/list/card views, saved views, grouping, filters, sorting, relations between records, templates, bulk operations.
- Views: All Entries, Credentials, Projects, Ideas Inbox, Code Library, Recently Updated, Favorites, Archived.
- Global search by decrypted titles/content/tags/commands while unlocked, using client-side indexes or in-memory search. Search must not send decrypted content to a remote indexing/analytics service.
- Quick switcher and command palette to jump to entries or actions.

### 8.6 Credentials and `.env` management
- Types: API keys, database URIs, passwords, tokens, SSH/private key material when supported safely, SMTP credentials and arbitrary key/value secrets.
- Environment groups such as development/staging/production.
- `.env` import with safe parsing, preview, duplicate-key handling and confirmation before encrypting/saving.
- `.env` export generated client-side only on explicit user request; show a warning and confirmation. Never auto-execute imported values.
- Copy/reveal controls, default masks, 15-second auto-remask, and best-effort clipboard clearing with honest UI behavior.
- Credential metadata: provider, project, purpose, created/updated/rotation dates; encrypt user-authored metadata where it contains sensitive information.
- Environment diff compares names/changed-value status without exposing values by default.
- Rotation reminders and expiration metadata (no outbound notification/email integrations because the environment constraint prohibits extra service credentials).
- Version history for changed secret ciphertext/versions where included by PRD; avoid unnecessary plaintext retention.
- User-triggered secret and backup exports, never included in routine exports or logs.
- Vault lock, inactivity lock, immediate manual lock, recovery workflow and visible lock state.

### 8.7 Search, history, backups and portability
- Full-text search while unlocked; search by type/tag/title/content after client-side decryption.
- Page/entry version history and restore where specified in PRD, preserving encrypted data safely.
- Encrypted backup and documented restore flow. Backups must not contain plaintext credentials or decrypted secret payloads by default.
- Test recovery with a real backup generated by the running implementation.
- Markdown import/export; normal notes exports exclude credential/environment secret values by default.
- Explicit `.env` export only from a deliberate client-side action.
- Auto-save with a visible save state, retry and conflict/failed-save handling; never tell the user an item was saved until the API confirms it.

### 8.8 Usability and responsive behavior
- Minimal dark interface, optional light/dark theme if PRD lists it, keyboard shortcuts, Quick Switcher (`Cmd/Ctrl+K`), search, context menus, command palette, custom templates, and accessible alternatives for drag-and-drop.
- Fully usable responsive layout, no horizontal overflow or clipped modal/actions at common widths and at 320px.
- PWA installation and offline behavior where included in the PRD. Cache only safe app assets and encrypted data; never persist decrypted content/plaintext keys just to make offline support easy. Clearly show offline/unsaved/sync states and avoid falsely claiming sync success.
- Empty/loading/error/success states across all pages. Real not-found page; no broken/dead links. Use meaningful toast/status announcements without exposing secrets.
- Maintain accessibility: labels, keyboard navigation, contrast, screen-reader announcements, focus management, dialog focus traps and reduced-motion support.

## 9. Stitch UI — visual fidelity requirements

Extract and inspect **every** supplied Stitch file, including all `code.html`, `screen.png`, and `terminal_noir/DESIGN.md` files. Use the desktop and mobile screens as visual references. Do not simply render the exported HTML as an embedded iframe or ship it as the application. Rebuild the design using real Next.js/React components, actual routing and backend state.

Screens found in the supplied bundle include:
- `envbook_vault_unlock_passphrase_setup`
- `envbook_notes_block_editor`
- `envbook_environments_secrets_manager`
- `envbook_mobile_environments_secrets`
- `envbook_mobile_ideas_inbox`
- `envbook_mobile_notes_block_editor`
- `envbook_ideas_inbox_quick_capture`
- `terminal_noir/DESIGN.md`

Follow the provided **Terminal Noir** design system unless the actual screenshots clearly establish a more specific component detail:
- Root canvas: `#0d1117`; panels/surfaces: `#12151a`, `#161b22`, `#21262d`; subtle borders: `#21262d` and `#30363d`.
- Text: `#f0f6fc`, secondary `#c9d1d9`, muted `#8b949e`.
- Emerald accent: `#10b981`, bright accent `#34d399`; use accent sparingly for active states, lock/verification indicators and primary actions.
- Inter for UI/content and JetBrains Mono for code, variable names, masks and technical metadata. Use supplied fonts if already available or a stable font loading approach; do not ship font files that are not licensed/available.
- Precise 1px borders, compact radii, deliberate spacing multiples, low clutter, minimal shadows, focus indicators and subtle dot-grid canvas only where it matches the references.
- Desktop: collapsible utility sidebar around 240px, main editor canvas, suitable max-width for reading, optional contextual drawer when supported by reference.
- Mobile: off-canvas/collapsible navigation and compact navigation, vertical stacking, touch-friendly controls, no desktop sidebar permanently consuming the viewport. Match the included phone screens rather than merely shrinking desktop layouts.
- Credential cards: masked monospace values, reveal/copy controls, explicit lock/encryption status text/icon; do not communicate security state with color alone.
- Code blocks: language header and copy action; handle long lines with horizontal scrolling without breaking the page.
- Slash picker: caret-adjacent, grouped, keyboard-selectable, compact; use active row and emerald left indicator as in the design notes.
- Build design tokens once and reuse them. Do not replace the design with a generic admin template or add unrelated gradients, illustrations, animation clutter, or new brand colors.
- Compare running app screenshots at desktop and mobile sizes against Stitch and fix visible spacing, typography, layout, responsiveness and hierarchy differences.

## 10. UI behavior: every control must work

Audit every visible button, link, dropdown, eye icon, menu item, checkbox, tab, search bar, pagination control, card action and keyboard affordance. Each must:
- Perform its stated action against real application state/API, or
- Be disabled with a clear reason when unavailable.

No `href="#"`, dead buttons, sample forms that do nothing, fake notifications, dummy loading timers, or UI-only success messages. All save/delete/move/export/import/lock/reveal/copy/restore actions must handle loading, success and failure correctly. Destructive operations require confirmation and proper authorization. Keep focus stable after action and provide undo when safe.

## 11. API and expected core flows

Design a small, consistent versioned REST API, including real endpoints for:
- Health/readiness.
- Sign up, login, logout, session/current-user status, and password change if included.
- Vault setup metadata, unlock-related metadata/key-wrap update and lock/session interactions as architecturally appropriate. The vault passphrase itself must never be submitted.
- Entry/folder/page create, read, update, move/reorder, list, duplicate, archive/unarchive, trash, restore and permanent delete.
- Favorites/recent access, tags/properties, saved views, templates, and relations.
- Secure credential/environment records as encrypted payloads.
- Import/export operations and backup/restore metadata. Generate decrypted exports client-side.
- Version history and restoration where required.

Use predictable JSON error shapes with safe machine-readable codes and human-readable messages. Implement idempotent or conflict-aware behavior where appropriate. Add typed API client functions; components must not hardcode ad hoc fetch calls everywhere. Ensure cancellation, loading, empty, and failure states are consistent.

## 12. Test strategy — execute, don't merely describe

Build automated tests and actually run them. Never claim a test passed without observing a successful command result. Keep a `TESTING.md` or README test section with exact commands and genuine results.

### Unit tests
- Authentication identifier normalization and validation.
- Password hashing/verification behavior.
- JWT validation for valid, invalid, expired and wrong-audience/issuer tokens.
- Encryption/decryption round trip, modified ciphertext/tag rejection, nonce uniqueness behavior, AAD record/user binding, passphrase incorrect-key behavior and key lock lifecycle.
- Markdown transformations, slash command registry/aliases, shortcut parsing and sanitization.
- Input validators and safe error mapping.

### API integration tests
- Sign up, duplicate username/email, username login, email login, wrong password, logout, protected requests and expired/invalid JWT.
- Every record operation requires authentication and correct ownership. Attempt cross-user reads, edits, moves, archive/trash/restore, deletes, export, and relation changes; all must be denied without leaking data.
- Invalid payloads, oversized bodies, malformed IDs, injection attempts, rate limits, CSRF/origin protections, generic errors and request validation.
- Confirm sensitive fields and raw secrets never appear in normal API responses/logs.
- Verify Mongo indexes/uniqueness and database failures are handled safely.

### Browser end-to-end tests
Use Playwright or equivalent against the **actual frontend and Express API**, not component-only mocks. Test at least:
1. Fresh app launches, signup works with name/username/email/password/confirm password.
2. Eye buttons show/hide password and confirmation without clearing the input.
3. Duplicate signup is handled; username and email login both work; wrong credentials show safe errors; logout works.
4. First-time vault passphrase setup, reveal toggle, successful unlock, incorrect passphrase rejection, inactivity/manual lock and logout clearing decrypted content.
5. Create folder, nested page, note, rename, move, duplicate, favorite, search, archive, trash, restore and permanently delete.
6. Slash menu opens; every registered alias is selectable; block transformations work; all listed Markdown shortcuts pass tests.
7. Create/edit/save/reload formatted content; confirm real persistence in MongoDB; failure/offline save is visible, not falsely reported successful.
8. Create credential/environment, see masked value, reveal, observe auto-remask, copy deliberate value, edit and rotate metadata; ensure value never leaks in list/search logs.
9. Import a test `.env`, preview/validate it, encrypt it, export only by explicit action, and verify no plaintext secret in normal note export.
10. Backup and restore; test recovery path and document unrecoverable scenarios honestly.
11. XSS payloads in imported Markdown/title/link/code are inert; path traversal/open redirects/HTML injection attempts are rejected or safely rendered.
12. All key screens work at desktop and phone viewports, including horizontal nav behavior, dialogs, editor, search, credentials, and keyboard controls.
13. Not-found route, stale session, API outage, DB outage, empty state and validation errors display correctly.

### Build and quality gates
Run, fix failures, rerun and record real output for:
- dependency install using the repository's lockfile/package manager;
- formatter check if configured;
- lint;
- strict TypeScript check for both frontend and backend;
- unit tests;
- API integration tests with a safe isolated test database;
- Playwright/browser E2E tests;
- production build of Next.js and compiled Express backend;
- dependency audit such as `npm audit` or equivalent and inspect/fix applicable vulnerabilities;
- mobile/desktop visual regression or screenshot review.

Never run destructive tests against the user's real database. Use a separate `envbook_test` database derived from the provided MongoDB URI or an isolated disposable MongoDB test instance. Never print the production `MONGODB_URI` while deriving it. Tests must create and clean up only their own known test records/database.

Do not suppress TypeScript errors, disable lint rules broadly, skip failing tests, use `as any` everywhere, hide failed builds, or weaken security controls to make tests pass. Add a proper `.gitignore`, README setup guide, `SECURITY.md`, architecture summary, API testing instructions and backup/recovery documentation.

## 13. Definition of production-ready

Do not deliver as “production ready” unless all of these are true:
- All required functional features are wired to real frontend state and backend operations.
- The supplied desktop/mobile design references are implemented and responsively checked.
- Authentication, authorization, CSRF/origin, validation, rate limits, error handling, secret masking, encryption and safe logging have tests.
- No plaintext vault passphrase, master key, recovery key, password or encrypted-field plaintext is sent to the backend or written to persistent browser storage/logs.
- All user data operations enforce server-side ownership and all data is persisted through MongoDB.
- No hardcoded credentials/secrets/default production accounts; `.env` contains only `MONGODB_URI`, `PORT`, and `JWT_SECRET`.
- Lint, type checking, unit/integration/E2E tests and production builds pass.
- No unresolved critical/high exploitable dependency vulnerability remains without being explicitly investigated and mitigated; do not claim a clean audit if the command was not run.
- Backup/recovery is exercised. Data-loss and key-loss behavior is documented.
- No dead buttons, dummy data in real flows, unresolved TODOs for required features, or fake success states.

If an external prerequisite prevents a test (for example MongoDB is unavailable or a browser binary cannot be installed), continue with all other work, attempt a safe local alternative, document exactly which checks were blocked and why, and **do not** claim full production readiness. Do not stop to ask me questions for ordinary implementation choices; choose a safe, conventional solution and document it.

## 14. Execution sequence

Proceed autonomously in one implementation pass:
1. Inspect repository, `PRD.md`, all ZIP contents and design tokens. Identify current stack/state and any existing code.
2. Produce a requirement-to-implementation checklist internally or in `IMPLEMENTATION_CHECKLIST.md`; map every PRD requirement and each section of this prompt to a component/endpoint/test.
3. Implement backend models, validation, authentication, secure cookies/JWT, encryption metadata APIs, CRUD/ownership checks and API tests.
4. Implement Next.js routes/layouts and responsive Stitch-matched UI, slash editor, workspace and vault flows.
5. Complete all required commands, templates, search, organization, import/export, history and backup/recovery features within the PRD scope.
6. Add representative test fixtures only in tests; never ship fake production content as if user data.
7. Run all checks from Section 12, fix root causes, rerun until passing.
8. Inspect the running app with browser automation; compare desktop and mobile screenshots against Stitch; correct visual issues and broken interactions.
9. Audit `.env` variable names without displaying values; check logs and repository for accidental secrets. Review `git diff` for unrelated changes and accidental file removal.
10. Update the README with exact local run/build/test instructions, route map, architecture, security model, environment-variable explanation, known constraints and backup/recovery steps.
11. Deliver a final concise implementation report with: completed feature groups; stack and startup commands; test/build/audit commands actually run and their actual statuses; visual/E2E status; any blockers/known limitations; exact files created/changed. Separate verified facts from anything not tested. Do not state that something is secure or production-ready without evidence.

## 15. Final non-negotiable instructions

- **Implement and test now; do not reply with just a plan.**
- Use the real `PRD.md` and Stitch bundle in this project path. Do not omit requirements because the document is long.
- Preserve the Stitch design for both desktop and mobile; the ZIP is a reference, not a deployable substitute for the application.
- **Editor UX is a hard requirement:** a single Notion-like inline WYSIWYG/block canvas with caret-anchored slash commands. A raw Markdown textarea with a separate rendered preview is incorrect and must not be shipped. Follow `EDITOR_CORRECTION_PROMPT.md` if present in the project.
- Use Next.js App Router + TypeScript, Express + TypeScript, and MongoDB. Do not replace this stack with SQLite, Flask, Firebase, or a monolithic Next.js-only API.
- Keep `.env` to exactly `MONGODB_URI`, `PORT`, `JWT_SECRET`.
- Include show/hide eye controls everywhere a password or vault passphrase is typed.
- Use real persistence and enforce server authorization on every protected operation.
- Do not reveal or log secrets; do not store vault content plaintext server-side or in persistent browser storage.
- No fake integrations, mock persistence, dead controls, skipped tests, or unsupported production-ready claims.
- Prefer concise maintainable code with meaningful comments, preserve working behavior, and explain important architecture/security choices in the documentation.

Begin by inspecting the repository and both supplied inputs, then continue straight through implementation, E2E testing, fixes, and final verification.

## Reference documentation
Use current official documentation when resolving implementation details:
- Next.js App Router and Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js TypeScript: https://nextjs.org/docs/app/api-reference/config/typescript
- Express production security: https://expressjs.com/en/advanced/best-practice-security/
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
