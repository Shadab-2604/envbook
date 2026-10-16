# Antigravity Implementation Prompt — envAi (Gemini-Powered Writing Assistant)

## Mission

Implement **envAi**, a production-quality AI writing assistant inside the existing EnvBook application. Use Google's Gemini API to help the authenticated user brainstorm, name, develop, organize, rewrite, summarize, and turn notes and ideas into useful documents directly inside EnvBook.

**Do the implementation in the existing repository. Do not create a separate demo app, stop after planning, or replace working features.** Inspect the existing source code, `PRD.md`, the existing Antigravity prompt files, and the supplied Stitch desktop/mobile UI references before changing code. Reuse existing architecture, design tokens, authentication, editor, API conventions, and component patterns. Keep the implementation lightweight and readable.

## Product and stack constraints

- Product name as displayed in the UI: **envAi**.
- Existing stack must remain: **Next.js App Router + TypeScript frontend, Express.js backend, MongoDB/Mongoose**.
- Continue using the existing authentication and JWT/session approach. Do not introduce a second authentication system.
- The `.env` file must continue to contain only the existing required application settings: `MONGODB_URI`, `PORT`, and `JWT_SECRET`. **Do not add `GEMINI_API_KEY` or other new environment variables.**
- Configure the Gemini API key through an authenticated EnvBook Settings → envAi screen and persist it encrypted in MongoDB. The browser must never call Google directly with the API key.
- Use the official `@google/genai` Node.js SDK if compatible with the current backend; otherwise use Google's documented REST API from the backend only. Do not use unofficial wrappers.
- Use a currently supported stable Gemini Flash model. Set the default model ID in one server-side constant/config module (prefer `gemini-3.8-flash` based on current official model documentation) so it can be updated without editing multiple files. Verify availability with an integration/configuration test and provide a clear configuration error if the model is unavailable; do not silently switch to an unverified model.

## Existing project requirements

1. First inspect and understand the current codebase. Identify the actual frontend, Express backend, database models, editor implementation, auth middleware, settings page, test framework, and Stitch references.
2. Read and follow `PRD.md` and relevant existing correction prompts.
3. Preserve all existing user data and functional features: dynamic workspace tree, page/folder types, inline WYSIWYG editor, slash commands, environment pages, per-variable credentials, encrypted vault behavior, login/signup, and responsive layouts.
4. Do not reintroduce hardcoded workspace categories or a separate Markdown textarea/preview. envAi must work with the current direct-editing page editor.
5. Make minimal, maintainable changes with meaningful comments where non-obvious security or data-flow logic needs explanation.
6. Do not claim production-ready status until the required tests have actually run and failures are fixed or explicitly reported.

## 1. envAi user experience

Add an envAi entry point in the existing application that matches the Stitch visual design. Keep the existing minimal dark interface and green accent; do not redesign unrelated screens.

### Required entry points

- A clearly named **envAi** button/icon in the page editor toolbar or contextual actions.
- A slash command `/envai` that opens the envAi action menu at the current cursor/selection.
- A contextual **Ask envAi** action when safe normal text is selected in a regular notes page.
- A dedicated envAi panel/drawer or compact popover consistent with existing UI. On desktop it may open alongside the editor; on mobile it must work without horizontal overflow and support a full-screen sheet if necessary.
- A Settings → envAi page for configuring, testing, replacing, and removing the Gemini API key.

### User-visible writing actions

Provide these built-in actions at minimum:

1. **Brainstorm ideas** — generate possible directions from a short topic.
2. **Generate title/name** — suggest clear, memorable titles/names for a note, section, project, or idea.
3. **Expand idea** — turn a short idea into a structured explanation with goals, features, implementation directions, and open questions.
4. **Improve writing** — improve clarity, grammar, organization, and readability while preserving meaning.
5. **Continue writing** — continue from the selected paragraph or current note context.
6. **Summarize** — produce a concise summary of selected non-sensitive text.
7. **Create an outline** — turn an idea into sections and sub-sections.
8. **Turn into PRD** — create a structured product requirements draft with problem, objective, users, scope, features, user flows, acceptance criteria, risks, and open questions.
9. **Rewrite tone** — offer concise, professional, technical, or friendly variants.
10. **Shorten / expand** — adjust length while retaining the original intent.
11. **Explain code** — only for code the user explicitly selects or provides from a normal notes/code block. Do not include environment credentials or protected configuration.
12. **Custom instruction** — allow the user to type a prompt and optionally select normal page text as context.

The exact UI labels may be adjusted to match the existing design, but every action above must be available and tested.

### Prompt and result workflow

- Show a clear input where the user types a topic/instruction and chooses an action.
- Where useful, display a small sample prompt or action description; never insert fabricated facts as if they came from the user's notes.
- Send only the user's explicit input and the minimum selected/current-page context needed for the chosen operation.
- Show a loading state, streamed output if supported by the existing backend/client architecture, a cancel/stop action, and accessible error messages.
- Let the user review and edit the generated result before applying it.
- Provide **Insert at cursor**, **Replace selected text**, **Append to page**, and **Copy result** actions where relevant. Require an explicit click for destructive replacement.
- Never overwrite the user's content automatically. Keep the normal editor undo/redo behavior intact after inserting AI text.
- Provide **Regenerate** and **Try again** when the request fails or the result is poor; don't automatically resend indefinitely.
- Show a brief notice near the input: AI suggestions may be inaccurate; review before saving.
- Show a usage/error state if envAi is not configured, the API is unavailable, quota/rate limit is reached, or the request times out.

## 2. Critical privacy rules

EnvBook stores sensitive credentials. envAi must be designed so secrets are not accidentally sent to Google Gemini.

- **Never send credential values, `.env` entries, MongoDB URIs, database passwords, JWTs, cookies, API keys, bearer tokens, OAuth secrets, SSH/private keys, recovery codes, or other secret material to Gemini.**
- Never make an AI request from an Environment Page, credentials manager, credential detail view, or a page/block marked sensitive.
- Do not send the whole workspace, sidebar tree, unrelated pages, credential list, or background database records as model context.
- For ordinary Notes Pages, send only explicitly selected text or context the user knowingly submits. If the user asks to use whole-page context, show the page title and a preview of the text being sent and require confirmation before sending.
- Never silently include previous AI chats, full documents, or unrelated data in a new request.
- Add a server-side sensitive-content screening layer as a secondary safeguard. Detect likely secret patterns (URI credentials, `KEY=value` secret-shaped lines, authorization headers, JWT-shaped strings, common private-key headers, passwords/tokens) and block the request with a message asking the user to remove secrets. This is defense in depth, not a substitute for client-side restrictions.
- The client must not be the only place enforcing these controls. The API must accept an explicit, allowlisted payload schema and reject disallowed page/resource types.
- Do not persist user prompts or generated content unless required by an explicitly requested feature. By default, do not save AI conversations to MongoDB. If conversation history is later added, make it opt-in and user-deletable.
- Do not log prompt content, note content, API keys, generated secret-like values, or provider response bodies. Log only safe metadata such as user ID, action name, timestamp, latency, status code, and token/usage metadata if supported and safe.
- Do not put Gemini prompts or results into analytics telemetry.
- Explain in the UI that requests chosen by the user are sent to Google's Gemini service for processing. Provide a privacy notice/link in Settings.

## 3. Gemini key configuration while preserving the 3-variable `.env` constraint

The user's current project constraint is to keep `.env` limited to `MONGODB_URI`, `PORT`, and `JWT_SECRET`. Do not add any other environment variables.

Implement **Settings → envAi → API key**:

- Input type is password by default; include a show/hide eye icon with accessible label.
- Accept a Google Gemini API key entered by the authenticated user.
- The browser sends it only to a protected backend configuration endpoint over HTTPS in production.
- Test key validity server-side with a minimal non-sensitive test request and return only pass/fail plus a safe message; never return or echo the key.
- Store the key encrypted in MongoDB using authenticated encryption (AES-256-GCM or equivalent), unique nonce/IV per encryption, and key version metadata.
- Because this version is constrained to exactly three environment variables, derive a dedicated encryption subkey from the existing high-entropy `JWT_SECRET` using HKDF-SHA-256 with an application-specific, versioned context string such as `envbook:envai-provider-key:v1`. **Do not use `JWT_SECRET` directly as the AES key.** Keep the derived key isolated to the encryption module and use distinct contexts for distinct purposes.
- Document this as a security trade-off: rotating `JWT_SECRET` requires a controlled re-encryption/migration of the stored provider key before the old secret is discarded. Build a safe migration/rotation procedure and test it. Do not rotate or modify JWT secrets automatically.
- Never return encrypted or decrypted provider keys to the frontend after configuration. Return only metadata such as `configured: true`, last test status/time, and safe model status.
- Never store the key in `localStorage`, `sessionStorage`, client-readable cookies, frontend configuration, compiled bundles, source code, error messages, or logs.
- Support replace/update and delete/disable of the saved key. When deleting, remove the encrypted value and confirm the user understands envAi will stop working until configured again.
- Restrict configuration endpoints to the authenticated owner/user. If the project already supports multiple accounts, enforce per-user ownership and never use one user's key for another user's requests.
- Rate limit key-test and AI-generation endpoints. Validate input lengths and request/action enums server-side.
- If the existing database/vault has a well-designed, tested secret-encryption service that safely supports server-side use, assess reuse instead of adding a duplicate encryption mechanism, but do not weaken its security model to do so.

**Production security note:** A separate server-side encryption key/API-key environment variable or managed secret store would be stronger, but the implementation must honor the current no-extra-env-var requirement and explicitly document the trade-off. Do not embed the key in frontend code under any circumstances.

## 4. Backend implementation

Integrate with the existing Express backend, not Next.js frontend-only route handlers. Keep Gemini provider calls server-side.

### Suggested API surface

Adapt route names to existing conventions, but provide equivalent functionality:

- `GET /api/envai/status` — return whether envAi is configured and safe provider/model status; never return key material.
- `PUT /api/envai/config` — save or replace the API key after validation and encryption.
- `POST /api/envai/test` — test the stored key/model without returning secrets.
- `DELETE /api/envai/config` — delete the saved key after authorization and confirmation.
- `POST /api/envai/generate` — validate action, instruction, and allowed user-provided text; call Gemini and return generated text or stream it safely.

For all endpoints:

- Reuse existing auth middleware and enforce ownership/authorization.
- Validate with the project's existing validation library or a typed schema (e.g., Zod) at the API boundary.
- Reject oversized input and unknown properties. Apply per-user and IP rate limits, sensible timeout/abort behavior, and a maximum output-token budget.
- Map provider errors to stable, non-sensitive client responses: invalid key, quota/rate limit, unavailable model, timeout, blocked content, or temporary provider failure.
- Do not expose stack traces, request headers, provider request bodies, API keys, or database details.
- Do not retry unsafe/expensive requests indefinitely. Use at most a small bounded retry for transient failures and only if safe.
- Implement streaming only if it fits the existing stack safely; if streaming is used, handle disconnect/cancel and avoid buffering/logging the entire content unnecessarily. A normal response is acceptable if streaming introduces instability.
- Keep provider logic behind a small service module with typed inputs/outputs, not embedded inside UI components or route controllers.
- Use the official SDK's typed response API where practical. Check for an empty/blocked response and handle it gracefully.
- Store no AI output or chat history automatically.

## 5. Input/output quality and content handling

- Keep generated output plain text/Markdown compatible with EnvBook's inline block editor.
- For structured actions such as “Turn into PRD” and “Create outline,” request predictable Markdown headings and lists rather than raw HTML.
- Sanitize generated output before rendering; do not trust generated HTML. Render it through the existing safe Markdown/rich-text parsing pipeline and disallow dangerous HTML/URL schemes.
- Preserve code fences and language identifiers when returning code explanations or snippets.
- Do not automatically execute, evaluate, import, or run generated code, shell commands, or configuration snippets.
- Do not write environment variables, API keys, or database secrets into generated output. If asked to create an `.env` template, use placeholders such as `YOUR_API_KEY` and never populate it from vault records.
- Keep action prompts concise and versioned in source so behavior is repeatable and testable. Treat user input as untrusted data; prompt injection in user notes must not override application privacy rules.

## 6. Editor integration

- `/envai` opens the action picker without inserting literal text unless the user chooses to keep it.
- It should work in the actual inline WYSIWYG editor, not a separate textarea with a preview beneath it.
- Capture the current selection/cursor reliably, but do not automatically send the selection until the user submits the action.
- After generation, Insert/Replace/Append must preserve formatting where feasible and use existing editor transactions/undo mechanisms.
- If selection is empty, prompt for an instruction/topic rather than sending the entire page automatically.
- For sensitive page types, hide/disable the AI action entry points and enforce the same restriction on the server.
- Do not break existing slash commands, Markdown shortcuts, focus behavior, autosave, keyboard navigation, or mobile editor experience.

## 7. Settings and UX states

Create a compact Settings → envAi screen with:

- State: Not configured / Configured / Connection test failed.
- Masked API key input, reveal toggle, Save, Test connection, Replace key, and Delete key.
- Clear success/error feedback with no secret echo.
- Last successful test timestamp and configured model name, if available.
- A privacy explanation stating that submitted text is sent to Google Gemini and that secret/Environment pages are not supported as context.
- Loading/disabled states that prevent duplicate submissions.
- Accessible labels and keyboard navigation for all controls.
- Mobile-friendly layout consistent with the existing Stitch reference.

Create envAi action picker/panel with:

- Action list and custom instruction input.
- Optional selected-text preview.
- Submit, Cancel, Stop generation (if streaming), Regenerate, Copy, Insert, Replace, Append.
- Empty, configured, unconfigured, loading, success, rate-limit, quota, network failure and provider failure states.
- No misleading “saved” toast unless content actually gets inserted and persisted through the existing editor save path.

## 8. Data model

Fit the current Mongoose patterns. Avoid creating unnecessary collections.

- Add an AI provider settings record (per user if multi-user; otherwise owner-scoped) that contains only the encrypted Gemini API key, encryption algorithm/version metadata, nonce/IV, authentication tag, key version, configured model ID, and safe health-check metadata.
- Never store raw provider API keys.
- Do not store prompts, note content, or generated content by default.
- Add database schema validation and indexes consistent with existing conventions.
- Ensure ordinary application queries do not accidentally return encrypted provider fields to regular UI endpoints.
- Ensure deletion removes the encrypted credential and related provider settings. Consider normal database backup/retention behavior in the documentation.

## 9. Testing — required before delivery

Add and run tests using the repository's existing test framework. Mock Gemini responses for deterministic unit/integration tests; keep a separate optional live smoke test that requires a configured API key. Never put a real API key in committed tests.

### Unit tests

- Each built-in action builds a valid, constrained request.
- Empty prompt, whitespace-only input, too-long input and unknown actions are rejected.
- Secret-pattern detection blocks obvious `.env` lines, MongoDB URI credentials, JWT-shaped strings, bearer tokens and private key headers.
- Provider key encrypt/decrypt round-trip succeeds; tampered ciphertext/tag fails closed.
- A unique nonce/IV is generated for each encryption.
- Key settings API serializer never returns raw/decrypted/encrypted key material.
- Provider responses with no text, blocked output or unexpected structure are handled safely.

### API integration tests

- Unauthenticated calls are rejected.
- User A cannot read, replace, test, or delete User B's provider configuration or use their key.
- A configured key is encrypted in MongoDB and is never returned by any API response.
- Invalid keys, quota/rate limits, timeouts and provider errors map to safe responses.
- Rate limiting works and request limits are enforced.
- Environment pages and sensitive resources are rejected as AI context.
- Secret-shaped user input is blocked and is not sent to the mocked Gemini provider.
- Key deletion disables envAi; reconfiguration enables it again.
- No prompt, response, provider key or secret appears in captured application logs.

### UI / end-to-end tests

- Settings → envAi can configure, test, replace, and remove the key.
- Eye button reveals/hides the API key only while editing the configuration form and does not expose it after save/reload.
- `/envai` opens the action menu in a notes page.
- Brainstorm, title generation, expand idea, improve writing, summarize, outline, PRD conversion and custom prompt work with a mocked provider.
- Generated text is not inserted until the user explicitly chooses an action.
- Insert, Replace and Append work and preserve the user's previous text/formatting/undo behavior.
- User can cancel a request; failed requests do not duplicate content.
- The envAi controls are disabled/hidden for environment pages and credential views.
- Desktop, tablet and mobile layouts pass with no overflow; keyboard and focus behavior works.
- Existing login/signup, page creation, section nesting, editor, import/export, credentials manager, autosave, lock vault, and logout regression tests still pass.

### Build and verification gates

Run the project's actual scripts and suitable commands for:

- TypeScript typecheck
- ESLint/lint
- Unit tests
- API integration tests
- Frontend/end-to-end tests
- Production build
- Dependency audit (review and report genuine findings; do not blindly apply breaking upgrades)
- Existing regression suite

Fix implementation-caused failures. If a check cannot run because of unavailable external credentials/service, report it as **not verified** and say exactly why; do not mark it passed. Never paste a real key in output or logs. Include a concise final test report with command, result, and remaining blocker for each gate.

## 10. Documentation

Add `docs/ENVAi.md` or the project's equivalent documentation covering:

- What envAi does and the privacy boundary.
- How to configure/test/replace/delete the Gemini API key in Settings.
- Which text is sent to Google and how page types are restricted.
- Model ID/configuration location.
- Rate limits, request-size/output limits, and error states.
- The encryption approach and its relationship to `JWT_SECRET` under the three-variable constraint.
- Key rotation/re-encryption procedure and backup/recovery implications.
- How to run tests and conduct the optional live smoke test.
- Known limitations and explicit production deployment requirements (HTTPS, secure cookies, strict CORS, rate limits, backups, secret rotation).

## 11. Implementation order

1. Inspect repository, PRD, design reference ZIP, existing security and test architecture.
2. Write a brief implementation checklist based on real files, then proceed without waiting for further confirmation.
3. Implement encrypted provider-key configuration in Express/MongoDB with tests first.
4. Implement Gemini provider service and typed, validated API endpoints.
5. Implement server-side privacy protections and tests before connecting the UI.
6. Add envAi settings UI.
7. Add envAi panel and `/envai` integration to the existing editor.
8. Add all action workflows and explicit result insertion controls.
9. Run unit, integration, E2E, responsive, regression, lint, typecheck and production build checks; fix issues.
10. Inspect the final diff and remove any debug output, temporary files, hardcoded sample keys, unsafe logs or unused dependencies.
11. Deliver a summary of changed files, architecture, tests actually run, results, and any unresolved production gate. Do not claim success for work not completed.

## Final acceptance criteria

The task is complete only when:

- envAi is accessible from EnvBook and visually matches the current Stitch UI design.
- It can help create and improve ideas, titles, outlines, summaries, and PRD drafts using Gemini.
- `/envai` works inside the inline editor, and generated content is inserted only on explicit user action.
- Gemini is called exclusively from the Express backend; its API key never enters frontend bundles or browser storage.
- The key is encrypted in MongoDB and can be configured without adding a fourth `.env` variable.
- Credential records, environment pages, JWTs, database secrets, and key values are not sent to Gemini.
- Authentication, per-user authorization, validation, rate limiting, safe error handling, and tests are implemented.
- Existing EnvBook functionality and user data remain intact.
- Desktop/mobile checks, regression tests, TypeScript, lint, automated tests and production build are run; any unavailable verification is accurately reported.
