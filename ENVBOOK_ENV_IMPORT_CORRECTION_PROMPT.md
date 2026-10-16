# Antigravity Correction Prompt — EnvBook Bulk `.env` Credential Manager

## Mission

Inspect the existing EnvBook repository, its `PRD.md`, the supplied Stitch UI ZIP/references, and the current credential-management implementation. Fix the credential-management UX and implementation in the existing project. **Do not build a disconnected demo, do not rebuild the app from scratch, and do not break existing working functionality.** Implement the feature end to end, test it, and report verified results only.

## The current problem

The current UI uses a modal titled **“New Encrypted Credential”** with a **Credential Type** dropdown and a form for one secret at a time. This is not the required experience. The user wants to paste a complete `.env` block containing many variables, then have EnvBook parse each line into an independent key/value entry that can subsequently be viewed, copied, edited, or deleted individually.

## Required UX

### 1. Replace the current single-secret dropdown workflow

- Remove the required **Credential Type** dropdown from the primary add/import experience. Do not make the user classify every entry before saving.
- Keep the existing design language from the Stitch references (minimal dark UI, restrained green accent, clear spacing, responsive desktop/mobile layout).
- Provide a main **Environment Variables** or **Environment** page/panel with:
  - Page title and a short explanation.
  - A prominent **Import / Paste `.env`** action.
  - An optional **Add variable** action for manually adding one key/value pair.
  - Search/filter field.
  - A responsive list/table of individually stored variables.
- The import flow should open a simple editor/dialog/panel with a large multiline textarea where users can paste `.env` text directly. It must not use a separate per-credential type dropdown.
- Add buttons such as **Parse preview**, **Encrypt & Save**, and **Cancel**. It is acceptable to parse as the user types, but the user must see a review of parsed keys and validation issues before committing.
- Show parsed entries in rows with **Key**, masked **Value**, and actions: **Reveal/Hide**, **Copy**, **Edit**, and **Delete**. On narrow mobile screens, rows may become stacked cards with the same controls.
- Support at least dozens of entries in one import without requiring the user to repeat a modal for every key.
- Render the key and value as distinct fields. Do not display the entire `KEY=VALUE` text as one combined uneditable string once saved.

### 2. Example of expected input and output

A user may paste a block in this format (use only synthetic/example values in tests and documentation):

```dotenv
# Local development configuration
MONGODB_URI=mongodb://localhost:27017/envbook_dev
PORT=3000
JWT_SECRET=replace-with-a-long-random-development-secret
```

The preview should show three independent entries:

| Key | Value | Default display |
|---|---|---|
| `MONGODB_URI` | Parsed value | `••••••••••••` |
| `PORT` | `3000` | `••••` or visible if the product deliberately classifies it as non-secret |
| `JWT_SECRET` | Parsed value | `••••••••••••` |

This table is illustrative. Never hardcode example values into the app. The app must parse whatever valid keys and values the user supplies.

### 3. `.env` parsing behavior

Implement a tested parser for common dotenv syntax. At minimum:

- Split into lines and support LF and CRLF line endings.
- Ignore empty lines and lines containing only whitespace.
- Ignore comments where the first non-whitespace character is `#`.
- Parse `KEY=VALUE` by splitting only at the **first** `=` so values can contain additional equals signs.
- Trim whitespace around keys and the syntactic separator, while preserving value content according to documented dotenv-like rules.
- Support common quoted values (`"value"` and `'value'`) and document how quotes/escapes are handled. Do not silently mutate arbitrary values.
- Support values containing `=` and URL characters such as `://`, `/`, `?`, `&`, and `#`.
- Do not evaluate shell expressions, perform variable interpolation, execute commands, or source the uploaded text.
- Identify malformed lines and show the line number and a useful validation message. Do not silently drop malformed non-empty, non-comment lines.
- Validate variable names using a clear, documented rule compatible with common environment variable names (for example `^[A-Za-z_][A-Za-z0-9_]*$`).
- Detect duplicate keys within one import. Do not choose a value silently. Require the user to decide whether to keep the first, keep the last, or resolve each duplicate before saving. If a simple and safe first release is preferred, block saving until duplicates are resolved.
- Detect collisions with existing variables and offer explicit choices: update existing value, skip existing entry, or cancel. Never overwrite existing encrypted values silently.
- Show a preview count: valid variables, malformed lines, duplicate keys, and conflicts with existing entries.
- The importer must handle at least 100 variables in a normal test fixture without freezing the UI.
- Include tests for comments, blanks, whitespace, duplicate keys, missing `=`, empty values, values with many `=`, quoted values, CRLF, invalid key names, and URLs with special characters.

Be careful not to incorrectly split or trim a legitimate secret. Prefer a well-maintained dotenv parsing package if compatible with the existing project, but do not introduce unnecessary dependencies or execute configuration files.

### 4. Individual variable management

For each saved variable, implement and verify:

- **Reveal/hide:** Mask the value by default. An eye button toggles the value for that item only; toggling one item must not expose every other secret.
- **Copy:** Copy only that variable's value. Provide unobtrusive confirmation and do not log the copied value. Explain that clipboard clearing is best-effort and browser/platform dependent; do not claim a guaranteed secure clipboard wipe.
- **Edit:** Open an inline editor or small modal with key and value fields. Allow renaming a key and changing its value. Validate the new key and check for collisions before saving.
- **Save/cancel edits:** Do not persist partial edits; support cancel without changing the stored item.
- **Delete:** Require a clear confirmation for deleting an entry, then remove it from the active list. If the application has a trash/recovery model in its PRD, follow it; otherwise provide a deliberate permanent-delete confirmation.
- **Search:** Search by key name and safe metadata. Avoid searching or indexing decrypted secret values by default.
- **Bulk actions:** Optional but useful for selecting multiple entries to delete or move into an environment group; require confirmation for destructive actions.
- **Timestamps:** Show created/updated timestamps as metadata if supported by the existing data model.
- **Environment grouping:** Allow a group such as Development, Staging, or Production if already supported by the PRD. Do not require a dropdown classification for every single variable merely to import it.

### 5. Encryption and secret-handling requirements

Credential storage is security-sensitive. Preserve and strengthen the existing security design rather than making the UI work by storing plaintext secrets insecurely.

- Encrypt sensitive values before they are persisted. Use the encryption/key-management design specified by `PRD.md`; if the existing implementation does not meet it, document the gap and implement the approved secure architecture rather than inventing a shortcut.
- Use authenticated encryption (for example AES-256-GCM) with a unique nonce/IV per encrypted record and a versioned ciphertext format, when compatible with the documented architecture.
- If the project specifies client-side/zero-knowledge encryption, plaintext must not be sent to the server for persistent storage and the server must not be able to decrypt it. Do not silently replace that design with server-side plaintext handling.
- Never store imported raw `.env` text in MongoDB, logs, analytics, error-reporting payloads, localStorage, sessionStorage, or other persistent plaintext storage.
- Parse in memory, validate and preview, then encrypt values as part of the intended secure save flow. Clear temporary input state after a successful save and when the import panel is abandoned, to the extent supported by the app/runtime.
- Never log secret values, request bodies that contain them, JWTs, authorization headers, encryption keys, or full MongoDB URIs. Scrub exceptions and validation output.
- Apply authentication and per-user authorization on every read, reveal/decrypt, copy-supporting fetch, update, and delete API. A valid JWT alone is not sufficient; verify resource ownership on every request.
- Do not expose secret values in server-rendered HTML, page metadata, URLs, query strings, client console output, React error overlays, API debug responses, or logs.
- Use safe HTTP headers, rate limits and request-size limits appropriate to the existing architecture. Enforce reasonable import-size and item-count limits with clear UI feedback.
- Keep `JWT_SECRET` and `MONGODB_URI` in the project's server-side `.env` only as required by the project's architecture. Never expose them through `NEXT_PUBLIC_*` variables or send the server JWT signing secret to the browser.
- Use synthetic test values only. Do not copy any credentials from chat, screenshots, prior logs, or project notes into tests, seed data or documentation.
- Add a security test that verifies response bodies/logging do not leak plaintext secrets beyond the authorized reveal flow.

If a credential was already stored by the old flow, provide a compatible migration or preserve it safely. Do not delete existing credential records during a schema or UI migration.

### 6. Data model and API behavior

Inspect the current schema and follow existing naming conventions. Do not duplicate the credential store or create parallel models without need. Each saved variable should be an independent record (or an independent encrypted item inside a documented encrypted collection) so it can be independently managed.

Each entry should represent, at minimum:

- Stable ID
- Owner/user ID
- Variable key/name
- Encrypted value and required encryption metadata (never plaintext at rest)
- Optional environment/group ID or label
- Created and updated timestamps
- Optional safe metadata describing origin/import batch, provided this does not leak secret content

Implement or adapt authenticated endpoints for:

- List keys/metadata (values remain masked or encrypted; do not return plaintext by default)
- Bulk import/commit
- Create one entry
- Reveal/decrypt one authorized entry only when the existing security model permits it
- Update one entry
- Delete one entry
- Search/filter safe metadata

Validate payloads on both client and server. Enforce ownership and collision rules on the server; do not trust only client-side validation. Use atomic or otherwise safely handled updates when resolving import conflicts. Keep API responses minimal and consistent with the existing backend conventions.

### 7. UI states and accessibility

Implement and test all of the following states:

- Empty state with a clear **Paste `.env`** action and secondary **Add variable** action.
- Import panel before pasting.
- Parsed preview with valid entries.
- Validation errors with line numbers.
- Duplicate-key and existing-key conflict resolution.
- Saving/progress state to prevent duplicate submissions.
- Successful import confirmation with count of saved/updated/skipped items.
- Failed import with a safe, user-friendly message that does not include secret values.
- Search results and no-results state.
- Per-item reveal/hide, copy, edit, save/cancel, and delete confirmation.
- Network error, expired session and unauthorized-state handling.
- Desktop and mobile layouts based on the supplied Stitch designs.

Accessibility:

- Every icon-only button must have an accessible name/ARIA label and keyboard focus state.
- Use semantic labels and inputs, visible focus indicators, adequate contrast and keyboard navigation.
- The eye control must have state-aware accessible text such as “Reveal value” / “Hide value”.
- Do not rely on green/red color alone to communicate success/error.
- Make the paste editor and the item list usable on phone screens without horizontal overflow.

### 8. Environment variable scope

The application deployment `.env` remains separate from the user's saved environment-variable records. Keep the server deployment configuration limited to the variables already required by the project:

```dotenv
MONGODB_URI=your-mongodb-connection-string
PORT=3000
JWT_SECRET=your-long-random-secret
```

Use placeholders only in documentation. Do not add provider API keys or unrelated configuration variables to the application's deployment `.env` unless a documented technical requirement truly demands them. Do not put the database URI or JWT signing secret in frontend environment variables.

### 9. Required tests

Add and run automated tests that prove at minimum:

**Parser/unit tests**
- All parser cases listed in section 3.
- Duplicate and collision handling is deterministic and never silently destructive.
- Empty value behavior is deliberate and validated.
- Values with additional equals signs and URL characters remain intact.

**API/integration tests**
- Authenticated user can import and manage their own variables.
- Unauthenticated requests are rejected.
- User A cannot list, reveal, edit or delete User B's records by changing IDs.
- Invalid keys and invalid payloads are rejected server-side.
- A failed bulk import does not leave an unintended partial save unless partial behavior is explicitly designed and documented.
- Existing entries are preserved when import validation fails or the user cancels.
- Plaintext secret material is not returned by list endpoints and is not written to logs.

**Browser E2E tests**
1. Sign in with a test account.
2. Open the Environment page.
3. Paste at least three synthetic `.env` variables in one action.
4. Preview and resolve validation/conflict states if present.
5. Save and verify three separate list items are created.
6. Confirm values are masked initially.
7. Reveal one entry and verify only that entry is revealed.
8. Copy its value and verify the copied text in an isolated test clipboard where supported.
9. Edit the key and value, save, reload, and verify the update persists.
10. Cancel an edit and verify it did not persist.
11. Delete one entry, confirm it disappears, and verify the remaining entries are unchanged.
12. Search by key name and verify matching entries appear without exposing values.
13. Verify duplicate keys and existing-key collisions require explicit resolution.
14. Repeat key flows at desktop and mobile viewports.
15. Verify the browser console and application logs contain no secret values.

Run the repository's unit tests, integration tests, E2E tests, type checks, lint, and production build. Fix failures instead of merely documenting them. If a test requires services or credentials that are unavailable, report it as **not run** and do not represent it as passing. Use isolated test databases and synthetic credentials; never use production secrets.

### 10. Implementation rules

- First inspect the current code and determine why the old dropdown/single-item modal was implemented.
- Read `PRD.md` and follow its architecture and security requirements. The PRD is the source of truth for the rest of EnvBook.
- Use the existing Next.js App Router, TypeScript, Express backend, MongoDB/Mongoose and project conventions. Do not switch frameworks or rewrite unrelated modules.
- Reuse existing UI primitives and dependencies where sensible. Keep the implementation concise, maintainable and commented where the reasoning or data flow is not obvious.
- Preserve all previously working features and user data.
- Update relevant documentation and examples using synthetic values only.
- Do not stop after generating files. Run the app and test it.
- Do not claim “production-ready” unless the required checks actually pass. Provide a final summary of changed files, behavior verified, commands/tests executed, results, known gaps and manual setup steps.

## Definition of done

The task is complete only when a user can paste a multi-line `.env` block once; safely preview parsed values; resolve malformed lines, duplicates and existing-key conflicts; encrypt and save every accepted key/value as an independently manageable entry; then reveal, copy, edit or delete each entry individually. Values must remain masked by default, all CRUD operations must enforce ownership, and automated tests must verify the full workflow on desktop and mobile without exposing secrets in logs or API list responses.
