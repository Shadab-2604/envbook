# EnvBook — Master Implementation Checklist

This checklist maps all functional requirements from the Master Prompt and `PRD.md` to specific components, endpoints, security safeguards, and test suites.

---

## 1. Environment & Architecture Constraints
- [ ] Root `.env` and `.env.example` strictly contain only:
  - `MONGODB_URI=mongodb://127.0.0.1:27017/envbook`
  - `PORT=5000`
  - `JWT_SECRET=replace-with-a-long-random-secret`
- [ ] No extraneous environment variables (`NEXT_PUBLIC_*`, encryption keys, URLs, etc.).
- [ ] Next.js runs on port `3000`. Express runs on port `PORT` (default `5000`).
- [ ] Next.js server-side rewrite proxies `/api/...` to `http://127.0.0.1:${PORT || 5000}/api/...`.
- [ ] Monorepo structure with clean boundaries: `apps/web`, `apps/api`, `packages/shared`.
- [ ] `.gitignore` configured for `.env`, dumps, backups, test logs, coverage, and build artifacts.

---

## 2. Authentication & Account Management
- [ ] Signup fields in order: Full name, Username, Email, Password, Confirm password.
- [ ] Field-level validation: length, case-insensitive unique username and email, email format.
- [ ] Password hashing: Argon2id with high-entropy salt and calibrated memory/time cost.
- [ ] Client-side confirm-password check; `confirmPassword` is never sent to backend.
- [ ] Login identifier: username or email + password.
- [ ] Generic error responses to prevent account enumeration.
- [ ] Rate limiting on login and signup endpoints.
- [ ] Session authentication: `HttpOnly`, `SameSite=Lax`, `Path=/`, short-lived JWT in cookies.
- [ ] CSRF & origin protection for API mutations.
- [ ] Working show/hide eye toggle buttons for EVERY password/passphrase input across all forms.
- [ ] Logout endpoint clearing session cookie and frontend auth state.

---

## 3. Zero-Knowledge Client-Side Vault Encryption
- [ ] Separation of Account Password (server hash) vs Vault Passphrase (client-only).
- [ ] Vault Passphrase is never transmitted over the network, never logged, and never stored in MongoDB.
- [ ] Client-side Key Derivation: Argon2id (via `hash-wasm`) deriving KEK from vault passphrase + random salt.
- [ ] Random DEK (Data Encryption Key) generated client-side via Web Crypto CSPRNG (256-bit AES-GCM).
- [ ] KEK wraps the DEK using AES-256-GCM. Wrapped DEK, salt, and KDF metadata sent to backend.
- [ ] Recovery Key: High-entropy random recovery secret generated client-side, wraps DEK as secondary path. Shown once with save confirmation.
- [ ] Authenticated encryption (AES-256-GCM) with unique IV/nonce per record and AAD (bound to userId, entryId, version).
- [ ] Sensitive payloads (title, body, tags, env variables, secrets) encrypted client-side before transmission.
- [ ] In-memory DEK storage only; wiped immediately on lock, logout, or session timeout.
- [ ] Configurable inactivity lock (default 15m) and manual lock (`Esc` / button).
- [ ] 15-second auto-remasking for revealed secrets and best-effort clipboard scrub.

---

## 4. Backend API & MongoDB Data Model (Express + TypeScript + Mongoose)
- [ ] MongoDB connection with graceful shutdown and error resilience.
- [ ] Models:
  - `User`: name, normalized username, normalized email, passwordHash, vaultMetadata, timestamps.
  - `Entry`: owner, entryId, parentId, type, sortOrder, encryptedPayload, nonce, aad, cryptoVersion, isFavorite, isArchived, isDeleted, deletedAt, timestamps, version history.
  - `AuditLog`: safe security telemetry only (eventType, userId, timestamp; no secrets).
- [ ] Strict Zod schema validation on every API endpoint.
- [ ] Server-side ownership verification on all entry CRUD operations.
- [ ] API Endpoints (`/api/v1`):
  - Health & readiness: `GET /health`, `GET /ready`.
  - Auth: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`.
  - Vault: `GET /vault/status`, `POST /vault/setup`, `POST /vault/rekey`.
  - Entries: `GET /entries`, `POST /entries`, `GET /entries/:id`, `PUT /entries/:id`, `DELETE /entries/:id`, `POST /entries/:id/restore`, `POST /entries/:id/archive`, `POST /entries/:id/duplicate`, `POST /entries/move`, `GET /entries/:id/history`, `POST /entries/:id/history/:versionId/restore`.
  - Backup: `GET /backup/export`, `POST /backup/restore`.
- [ ] Security middleware: Helmet, rate limiting, origin verification, sanitized logging (redacting secrets).

---

## 5. Stitch UI & Terminal Noir Design System
- [ ] Color Palette: Canvas `#0d1117`, panels `#12151a`, `#161b22`, `#21262d`, borders `#21262d`/`#30363d`, emerald accent `#10b981`/`#34d399`.
- [ ] Typography: Inter (UI/headings), JetBrains Mono (code, env keys, masked secret dots `••••••••`).
- [ ] Subtle dot-grid canvas background (`radial-gradient(#21262d 1px, transparent 1px) 24px 24px`).
- [ ] Desktop layout: 240px collapsible sidebar, main editor canvas (840px max-width reading container), contextual TOC drawer.
- [ ] Mobile layout: collapsible off-canvas drawer, compact topbar, full responsiveness down to 320px.
- [ ] All Stitch UI reference screens faithfully implemented:
  - `envbook_vault_unlock_passphrase_setup`
  - `envbook_notes_block_editor`
  - `envbook_environments_secrets_manager`
  - `envbook_ideas_inbox_quick_capture`
  - Mobile variants for editor, environments, and ideas.

---

## 6. Workspace, Pages, Folders & Navigation
- [ ] Home dashboard with recent items, favorites, ideas count, quick actions, lock status.
- [ ] Folder tree with nested pages, expand/collapse, drag-and-drop reorder, and keyboard alternatives.
- [ ] Breadcrumbs navigation with hierarchy ancestors.
- [ ] Page icons and custom emoji support.
- [ ] Favorites (pin/unpin) and Recents tracking.
- [ ] Archive/unarchive, Trash soft-delete, and permanent delete with confirmation.
- [ ] Duplicate page and sub-content with new IDs.
- [ ] Context menus for page actions (rename, duplicate, move, favorite, archive, delete).
- [ ] Quick Switcher (`Cmd+K` / `Ctrl+K`) for jumping to any decrypted entry.

---

## 7. Block Editor & Slash Commands
- [ ] Live rendered block editor with Raw Markdown toggle.
- [ ] Markdown shortcuts (`#`, `##`, `###`, `- `, `1. `, `[] `, `> `, `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, ` ``` `).
- [ ] Slash command menu anchored to caret with live keyboard filtering, arrow navigation, and group headers.
- [ ] Complete Slash Command Registry:
  - Text & Markdown: `/text`, `/heading`, `/h1`, `/h2`, `/h3`, `/bulleted-list`, `/numbered-list`, `/todo`, `/toggle`, `/quote`, `/callout`, `/divider`, `/bold`, `/italic`, `/strikethrough`, `/inline-code`, `/link`, `/equation`.
  - Developer & Technical: `/code` (with language selector & copy), `/terminal` (display-only), `/env` (masked secret block), `/credential` (encrypted secret card), `/api`, `/request`, `/response`, `/json`, `/yaml`, `/sql`, `/http`, `/warning`, `/note`, `/output`, `/file`, `/diagram`, `/table`, `/database`.
  - Page & Layout: `/page`, `/folder`, `/breadcrumb`, `/toc`, `/columns`, `/image`, `/video`, `/embed`, `/bookmark`, `/synced-block`, `/template`, `/date`, `/tag`, `/mention`, `/button`.
- [ ] XSS sanitization: safe rendering of all content and code blocks (DOMPurify).
- [ ] Table of contents generation and auto-sync with headings.

---

## 8. Credentials & Environment Manager
- [ ] Masked secrets by default with monospace dots `••••••••••••`.
- [ ] Working reveal button with 15-second automatic remasking timer.
- [ ] Working copy button with feedback toast and best-effort clipboard clearing.
- [ ] Overdue rotation indicators and expiration metadata.
- [ ] `.env` Import: file drag-and-drop or text paste, safe parser, duplicate key detection, encrypted storage.
- [ ] `.env` Export: client-side generation, warning & confirmation modal, excludes non-target data.
- [ ] Environment diff view: compare development, staging, production keys without exposing secret values.

---

## 9. Ideas Inbox & Quick Capture
- [ ] Instant capture card with tags (`#backend`, `#ai`, etc.), status, and target project assignment.
- [ ] Status filters: All, Considering, Planned, In Progress, Done, Archived.
- [ ] Convert idea to PRD / full document page action.
- [ ] Star, move, edit, and archive quick actions on each card.

---

## 10. Search, History, Backup & Recovery
- [ ] Global search over decrypted in-memory entries (title, content, tags, properties).
- [ ] Entry version history: view previous revisions and restore past state.
- [ ] Full-vault encrypted backup export (`.envbook.bak.json`) and safe restore validation.
- [ ] Markdown notes export excluding raw credentials and secrets.
- [ ] Honest documentation of unrecoverable scenarios if passphrases/keys are lost.

---

## 11. Testing & Production Readiness Verification
- [ ] Backend Unit & Integration Tests (Vitest / Supertest).
- [ ] Cryptographic Round-Trip Unit Tests (Argon2id + AES-256-GCM + AAD).
- [ ] End-to-End Browser Tests (Playwright) covering auth, eye buttons, vault unlock, slash editor, credentials, .env import/export, ideas, and responsive views.
- [ ] TypeScript strict checks on frontend and backend (`tsc --noEmit`).
- [ ] ESLint validation.
- [ ] Production build tests (`npm run build`).
- [ ] Audit for accidental secret leakage in logs or files.
