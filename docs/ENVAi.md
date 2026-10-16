# envAi — Google Gemini AI Integration Specification & Architecture

## 1. Overview
**envAi** is the private, intelligent writing and documentation assistant natively integrated into EnvBook. Powered by Google Gemini (default model: `gemini-3.8-flash` Recommended) alongside the **Eden AI (Unified Multi-Model Gateway)**, envAi is designed to assist software engineers, security researchers, and DevOps practitioners in drafting technical proposals, explaining complex code, summarizing documentation, creating Product Requirement Documents (PRDs), and conducting authorized cybersecurity reviews. Users can configure either a Google AI Studio Gemini API key or an Eden AI unified API key (`sk-eden-live...`).

---

## 2. Security Architecture & Zero-Knowledge Boundaries

### A. Strict Three-Variable `.env` Constraint
EnvBook enforces a strict minimal configuration policy with exactly three environment variables:
- `MONGODB_URI`
- `PORT`
- `JWT_SECRET`

**No fourth variable (e.g. `GEMINI_API_KEY`) is ever added to `.env`.** 
Instead, each user configures their personal Google Gemini API key via **Settings → envAi Assistant & Gemini Provider**.

### B. HKDF-Derived AES-256-GCM Key Protection
When a user provides their Gemini API key:
1. The server derives an isolated 256-bit AES encryption key using **HKDF-SHA-256**:
   - Master Secret: `process.env.JWT_SECRET`
   - Info tag: `envbook:envai-provider-key:v1`
   - Salt: `envbook:envai-hkdf-salt:v1`
   - Output Length: 32 bytes (256 bits)
2. The key is encrypted with **AES-256-GCM** using a cryptographically random 12-byte IV (`crypto.randomBytes(12)`).
3. The ciphertext, IV, and 16-byte authentication tag are persisted in MongoDB in `AiProviderSettings` with `select: false` to prevent accidental inclusion in user profile queries.
4. If ciphertext or tag tampering occurs, decryption fails closed immediately.

### C. Zero-Knowledge Credential Privacy Filter
To maintain EnvBook's zero-knowledge security guarantees:
- **Disallowed Resources:** Environment Pages (`environment_page`), Credentials (`credential`), and Environment Variables (`env_var`) are strictly blocked from AI generation context at both UI and server API layers (`isResourceAllowed`).
- **Pre-Flight Regex Screening & Redaction:** All user prompts and note contexts are passed through `redactSecrets()` before any outbound network call to Google Gemini. The filter automatically detects and replaces:
  - Database & URI connection strings (`mongodb+srv://...`, `postgres://...`) with `[REDACTED_USER]:[REDACTED_SECRET]`
  - Private key blocks (`-----BEGIN RSA PRIVATE KEY-----`) with `[REDACTED_PRIVATE_KEY_BLOCK]`
  - Authorization / Bearer tokens with `Bearer [REDACTED_BEARER_TOKEN]`
  - JWT tokens with `[REDACTED_JWT_TOKEN]`
  - Uppercase `.env` credential assignments (`API_KEY=...`, `SECRET=...`, `DB_PASSWORD=...`) with `[REDACTED_SECRET]`
- The API returns `redactedCount` to display an informational privacy banner in the UI whenever sensitive patterns are sanitized.

---

## 3. Supported File Parsing & Multimodal Capabilities
envAi supports multimodal source attachments:
- **Supported Formats:**
  - Source code and text files: `.txt`, `.md`, `.json`, `.csv`, `.ts`, `.tsx`, `.js`, `.py`, `.go`, `.rs`, `.html`, `.css`
  - PDF documents (`application/pdf`) via Gemini inline base64 data
  - Images (`image/png`, `image/jpeg`, `image/webp`)
- **Explicit Audio / Video Rejection:**
  - Uploads matching audio or video formats are rejected on client selection with clear error notifications.

---

## 4. Writing Actions & Confirmation-Based "Apply to Note" Workflow

### The 15 Specialized Actions
1. `brainstorm`: Brainstorm directions, architecture options, and creative angles.
2. `title`: Generate 5-8 descriptive and punchy note titles.
3. `expand`: Expand brief notes into structured technical proposals.
4. `prd`: Generate complete Product Requirements Documents.
5. `outline`: Create hierarchical outlines with sections and checklists.
6. `summarize`: Executive summaries with bullet point digests.
7. `improve`: Enhance clarity, technical precision, and flow.
8. `continue`: Smoothly draft the next logical paragraph.
9. `shorten`: Condense length while retaining core facts.
10. `expand_length`: Deep dive with technical depth and practical examples.
11. `explain_code`: Architecture, logic breakdown, and security caveats.
12. `cybersecurity`: Authorized defensive and controlled lab red/blue team analysis.
13. `tone`: Shift tone (Technical, Concise, Professional, Friendly).
14. `custom`: Custom user instructions.
15. `chat`: Multi-turn conversational questions about notes and attached documents.

### Safe "Apply to Note" Operations
To prevent accidental overwrite of user work, envAi never silently edits the canvas:
- **Insert at Cursor:** Inserts output at the current caret position.
- **Append to Note:** Appends markdown block to the end of the current note.
- **Replace Selected:** Replaces highlighted editor text.
- **Replace Entire Note:** Requires explicit confirmation via modal dialog.
- **Create as New Note:** Creates a new encrypted note entry in the workspace and redirects.
- **Copy:** Copies markdown output to system clipboard.

---

## 5. Verification & Testing
- **Shared Package:** Slash commands (`/envai`, `/ai`, `/gemini`), validation schemas (`EnvAiConfigSchema`, `EnvAiGenerateSchema`), action constants.
- **API Unit Tests (`apps/api/test/envai.test.ts`):** 7/7 passed.
- **Web Unit & Security Tests (`apps/web/test/envai.test.ts`):** 22/22 passed.
- **Monorepo Total Automated Tests:** 68 passed across all suites.
- **TypeScript:** Strict typecheck passed across `@envbook/shared`, `api`, and `web`.
