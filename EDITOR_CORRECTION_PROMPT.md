# EnvBook — Mandatory Editor UX Correction (Antigravity)

## Objective

Fix the current EnvBook note editor. The current implementation is incorrect because it shows a raw Markdown `<textarea>`/text input at the top and a separate rendered preview panel beneath it. **Do not keep or polish that split source-and-preview design. Replace it with a real inline, WYSIWYG block editor inspired by Notion.**

The user must write and edit directly on the page canvas. Formatting should appear in place as the user types or chooses a slash command. The normal editing experience must not require looking at raw Markdown or a separate preview panel.

## First: inspect the existing project

1. Inspect the current editor implementation, package dependencies, PRD, Stitch desktop/mobile ZIP, existing tests and project structure.
2. Identify why the current textarea-plus-preview editor was built and trace all save/load/autosave paths before changing it.
3. Reuse and refactor existing code where practical. Preserve working page title, tags, persistence, authentication and navigation.
4. Implement the fix in the existing project now; do not answer with a plan only.

## Non-negotiable UX requirements

### 1. One inline editable page canvas

- Use a maintained rich-text/block editor such as **Tiptap with ProseMirror** and compatible maintained extensions. Do not build an editor engine from scratch.
- The editor's content area must be genuinely editable in place using a `contenteditable`-based editor surface.
- Headings look like headings while editing; bullets look like bullets; checkboxes are interactive; quotes, tables and callouts render in their formatted layout; code blocks look like code blocks.
- Do not show Markdown markers such as `#`, `**`, backticks or `-` as persistent source text in the primary editor once the editor recognizes the shortcut. The raw Markdown/source mode must be optional and off by default.
- Remove the always-visible, separately rendered preview panel. There must be only one main editor surface in the default editing view.
- Do not implement the editor as a Markdown textarea with a preview below it, two synchronized textareas, or a plain textarea styled to look like an editor.
- The page title should be an inline editable title at the top. Tags/properties may appear below the title, followed by the editable content canvas.
- If a preview is retained at all, make it an explicit optional mode such as **View → Markdown source**; never show it beside/below the normal editor by default.

### 2. Notion-like slash commands at the caret

- When the user types `/` at a valid position inside the editor, open a compact command picker anchored near the current caret. It must not open as a separate page or fixed bottom panel.
- Typing additional characters filters the command menu immediately (for example `/head`, `/code`, `/cred`).
- Use arrow keys to navigate; Enter or click inserts the selected block at the current cursor position; Escape dismisses the menu; Backspace/editing works predictably.
- After insertion, place the caret in the appropriate editable location. Do not lose focus, duplicate the slash, erase neighboring text, jump the cursor to the document start, or insert the block at the end by default.
- Group commands under Text, Lists, Code & Developer, Security, Media, Layout and Advanced. Show a small icon, command name and brief description.
- Support mouse, keyboard and touch interactions. On mobile, keep the command list inside the viewport and avoid covering the active line unnecessarily.
- Keep all required aliases from `PRD.md` and `ANTIGRAVITY_MASTER_PROMPT.md` searchable and functional. Aliases may map to the same editor node/command, but none may be decorative or dead.

### 3. Markdown typing shortcuts should transform content in place

Support the documented shortcuts where practical using the editor's Markdown/keyboard extension:

- `# `, `## `, `### ` become H1, H2 and H3 blocks.
- `- ` becomes a bullet list; `1. ` becomes a numbered list.
- `> ` becomes the defined quote/toggle behavior and must be documented consistently.
- `**text**`, `*text*`, `~~text~~` and backtick-delimited text format as bold, italic, strikethrough and inline code where compatible.
- A triple-backtick fence followed by a language creates a code block; provide a language selector in the code block toolbar.
- Slash commands and Markdown shortcuts must coexist without fighting for keyboard input or producing duplicated transformations.
- Preserve literal text when a shortcut is incomplete or the user dismisses the command picker.

### 4. Blocks are real editable nodes, not rendered decoration

- **Headings and text:** actual editable paragraph/heading nodes with correct semantic structure.
- **Lists and to-do items:** real editable list items and interactive checkboxes.
- **Code:** a real code-block node with syntax highlighting, language selection, copy button, and keyboard-safe editing. The user must be able to click into and edit the code directly. Never label user content “Read-Only Snippet” unless the user explicitly selected a read-only snippet type.
- **Credential/environment blocks:** visually differentiated structured blocks. Secret values must remain masked by default and encrypted according to the existing PRD's security model; never expose decrypted values in rendered HTML attributes, console logs or analytics.
- **Tables:** editable cells and keyboard navigation.
- **Quotes, callouts, toggles, dividers, links, images and supported embeds:** render as proper blocks with usable edit controls.
- Block actions such as change type, duplicate, move, delete and copy should be accessible through a small contextual menu and keyboard alternatives when feasible.

### 5. Save a structured editor document

- Persist a versioned structured document representation, preferably Tiptap/ProseMirror JSON, as the authoritative rich-text document format.
- Preserve page title, tags, metadata and document content separately in their intended fields.
- Keep Markdown import/export as conversion features. Do not make a Markdown string in a textarea the only authoritative editor document.
- Add safe migrations/versioning for stored editor documents. Handle existing Markdown notes by importing/converting them without silently deleting or corrupting user data.
- Autosave after a short debounce and on appropriate blur/navigation events. Show real `Saving…`, `Saved`, and `Save failed` states based on backend results. Never display “Saved” before the server confirms persistence.
- Preserve selection and undo/redo during editing. Avoid re-mounting the editor on each keystroke or resetting content during a save response.
- Debounce writes and handle concurrent/late responses so an older save cannot overwrite newer content.
- Enforce authentication/ownership and the current backend API architecture; do not bypass Express/MongoDB with browser-only fake persistence.

### 6. Visual target

Use the supplied Stitch desktop and mobile reference designs as the visual authority. Keep the existing EnvBook minimalist dark theme, typography, borders, spacing, accent colors and responsive layout. Match the note page roughly as follows:

1. Breadcrumb/back navigation (where present).
2. Large inline editable page title (e.g. “Untitled Note”).
3. Page metadata/tags row.
4. A single spacious content canvas, with placeholder text such as “Type '/' for commands…” when empty.
5. Inline formatting and block controls that appear contextually, not a second preview.
6. Subtle save status and word count, if already present or in scope.

The page should feel like editing a document directly, not editing Markdown source and inspecting a read-only rendered copy. Match both desktop and phone references; on phones, preserve usable typing, selection, slash menu positioning, and toolbar access.

## Suggested technical implementation

- Use Tiptap core and maintained compatible extensions for StarterKit, placeholder, link, underline/formatting as required, tables, task lists/items, code blocks plus syntax highlighting, image/media blocks where supported, slash-command suggestion plugin, and Markdown input/output integration.
- Check dependency compatibility with the repository's installed Next.js/React versions. Do not install conflicting or deprecated packages blindly.
- In Next.js App Router, the editor component will likely be a client component (`'use client'`). Avoid importing browser-only editor code into Server Components. Prevent hydration mismatch and ensure the rest of the route remains server-rendered where sensible.
- Define the slash commands in one typed registry with label, aliases, group, description, search keywords and execution callback. Test every alias against that registry.
- Use editor transactions/commands to transform the current selection and insert nodes. Avoid fragile regex replacement over the whole textarea/document.
- Sanitize and validate imported Markdown/HTML. Disallow unsafe HTML and dangerous protocols; user-supplied content must not execute scripts.
- Keep secret-bearing content encrypted as required by the main PRD. The rich-text rendering layer must not weaken the vault's encryption/key lifecycle model.

## Required acceptance tests

Do not report this complete until these tests pass in the actual application:

1. Opening a note shows one editable formatted canvas, not a Markdown textarea plus preview.
2. Clicking inside a heading and typing changes that heading directly. The caret remains in the expected place.
3. Typing `## Heading` plus the configured trigger creates an H2 in place with no lingering `##` source markers.
4. Typing `/` opens the command picker at the caret; typing `/code` filters it; selecting Code Block inserts a code block at that position and focuses the code editor.
5. Create a heading, list, task, quote, callout, table and code block; save, reload and verify all are still formatted and editable.
6. Code blocks support direct editing, language selection and copy. Copying does not copy toolbar labels or unrelated text.
7. Every required slash command alias is available and executes its mapped action. Add automated coverage for the registry.
8. Escape closes the picker without modifying nearby text. Arrow navigation, Enter, mouse selection and mobile touch work.
9. Autosave persists to MongoDB via the Express API, with genuine Saving/Saved/Save-failed states. Simulated API failure is visible and does not discard unsaved edits.
10. The editor keeps its selection and undo/redo across autosave; rapid typing does not lose characters or allow stale saves to overwrite newer changes.
11. Existing note content can be migrated or converted without data loss. Markdown export/import round-trips supported structures within documented format limits.
12. XSS/unsafe link payloads remain inert; sensitive values do not leak to browser logs or normal non-secret exports.
13. Test at desktop and phone viewports and compare screenshots to the supplied Stitch references.
14. Run formatting/lint, strict type checks, unit tests, API integration tests, Playwright E2E and production builds; fix failures and rerun them.

## Completion rules

- Implement the fix directly in the current codebase; do not stop after a proposed design.
- Remove the old textarea-plus-preview UI and its obsolete styling/state paths once the new editor is verified.
- Do not delete existing content or break title, tags, page navigation, authentication, save/load, or mobile layout.
- Inspect the final running application, not just component code. Capture and review desktop/mobile screenshots.
- Report the actual files changed, editor library/extensions used, test commands and observed pass/fail outcomes. Do not claim full production readiness if a required test could not run.
