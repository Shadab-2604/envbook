# EnvBook — Dynamic Workspace, Page Types & Slash Commands Correction Prompt

## Mission

Inspect and correct the existing EnvBook implementation so that the workspace navigation is **fully user-defined and data-driven**, not a sidebar full of fixed product sections. Use the existing repository, `PRD.md`, and supplied Stitch desktop/mobile UI ZIP as the source of truth. Preserve all working functionality, the established visual system, authentication, encryption, database integration, and the direct inline WYSIWYG editor.

Implement the changes in the existing codebase. Do not return only a plan, mockup, or code snippets. Run relevant automated tests, manually verify the user flows in desktop and mobile layouts, fix discovered issues, and report exactly what passed and what remains unverified.

## The core problem to fix

The current sidebar contains hardcoded navigation such as:

- Home
- All Entries
- Projects
- Credentials Vault
- Environments
- Ideas Inbox
- Code Library
- Pages & Folders
- Favorites
- Recently Updated
- Archived
- Trash
- Settings

The user does **not** want the primary workspace categories such as Projects, Credentials Vault, Environments, Ideas Inbox, and Code Library permanently hardcoded into the UI. Users must create their own organization from the page and slash-command flows. Do not simply hide these items with CSS or rename them. Remove hardcoded content-category navigation and render user-created pages, sections, and related content from persisted data.

System utilities such as Settings, Lock Vault, Sign Out, Favorites, Recently Updated, Archived, and Trash may remain as fixed utility destinations where appropriate, but separate them clearly from the user-defined workspace tree. Home and All Entries may remain only if they are genuinely useful global views; do not use them as substitutes for the user's dynamic hierarchy. Avoid adding sample/demo categories to a real user's sidebar.

## Required creation experience

Whenever a user activates **New Page**, **New Section**, the sidebar `+` action, or types `/page` or `/section` inside the editor, open a compact creation flow that asks the user to select the type of item to create.

Use this type-selection dialog/menu:

1. **Notes Page** — a normal page for freely formatted inline notes.
2. **Section** — a container used to group child pages and sections; it is not itself a normal notes document.
3. **Environment Page** — a page dedicated to environment variables and `.env` key/value entries, with bulk paste/import and individual entry management.
4. **Notes Section** — a notes-focused container for organizing multiple notes pages, with an optional section description. It behaves as a container, not a single long note.

Display a short explanation for each type. After choosing a type, ask for a title/name. If the command was invoked within an existing section, offer to create the item inside that section by default. Allow the user to change the parent location. If there is no current parent context, create it at the workspace root. Do not create a blank item until the user confirms the type and title, unless the user intentionally chooses an explicit quick-create flow.

### Naming and behavior

- `Notes Page`: standard title + inline editor body. Support the existing Notion-style WYSIWYG editor and slash commands. It can have tags and metadata.
- `Section`: organizational node with a title, optional icon/color if already supported by the design, child sections, and child pages. It should not display the body editor by default. It can have an optional description if supported consistently.
- `Environment Page`: an item in the user-defined tree. Opening it shows a list of environment variables, each stored as its own independently manageable entry. Support multiline `.env` paste/import, parse preview, duplicate-key validation, and per-variable reveal/copy/edit/delete. Do not make credential type a required dropdown. Keep secret values encrypted according to the existing security architecture.
- `Notes Section`: a container intended for grouping notes pages. Show its child notes and nested structure. It must not be rendered as a text note. Its purpose is distinct from the general Section in the type chooser, so visually explain the difference: Section = general-purpose organizational container; Notes Section = notes collection/container optimized for note pages.

If existing data uses legacy categories such as `project`, `credential`, `environment`, `idea`, or `snippet`, preserve that data. Migrate or map it into the new dynamic model safely without deleting or exposing data. Never silently reclassify or remove existing entries. If a migration is needed, make it idempotent, documented, tested, and backed by a safe recovery strategy.

## Slash command requirements

Integrate creation commands into the existing editor slash-menu. They must be real actions, not decorative entries.

- `/page` — opens the type chooser and allows the user to create a page/container.
- `/section` — opens the same type chooser with **Section** preselected, while still allowing the user to change type.
- `/notes-page` — optionally direct-creates or opens the chooser with Notes Page selected; if there is not an established confirmation UX for direct create, use the chooser.
- `/environment` — opens the chooser with Environment Page selected.
- `/notes-section` — opens the chooser with Notes Section selected.

After creation, link the new item in the correct place and navigate to it or insert an appropriate page link/reference at the editor cursor, whichever matches the existing architecture and established UX. Do not insert meaningless plain text like `New Page` into the editor and claim that a page was created. The action must persist a real database item and update the sidebar/tree immediately without requiring a manual refresh.

Slash menu behavior must remain keyboard-accessible:

- Open at the current editor cursor when the user types `/`.
- Filter when the user types a command name.
- Arrow keys navigate, Enter selects, Escape closes.
- Maintain the editor selection/cursor across the dialog/action.
- Do not steal or lose user-entered text when cancelling creation.
- Show short descriptions and a clear visual indication of the preselected type.
- Work on desktop and mobile touch interfaces.

## Dynamic sidebar and workspace tree

Create the sidebar from the authenticated user's persisted workspace records, not from a hardcoded array of category links.

Required behavior:

- A **Pages & Folders** (or better concise user-defined tree label) region showing the user's created root-level items.
- Each item displays an icon based on its type, a title, and a contextual menu.
- Expand/collapse nested Sections and Notes Sections.
- Create child items inside a selected container.
- Drag-and-drop reordering if the app already supports it; otherwise implement it only if it can be done accessibly and reliably, and add tests.
- Context actions: Open, Rename, Move, Duplicate where valid, Archive, Delete/Move to Trash, and Restore from Trash where applicable.
- Breadcrumbs reflect the actual parent hierarchy.
- Empty state with an actionable **Create your first page** control; do not populate the workspace with fake sample folders.
- Update the tree optimistically only where safe; roll back and show a useful error if persistence fails.
- Keep expanded/collapsed state stable through navigation. It may be persisted as non-sensitive UI preference data if this matches existing architecture.
- Sorting should be deterministic and preserve manual order if ordering/reordering exists.
- When a parent is moved, renamed, archived, or deleted, descendants and breadcrumbs must update consistently.
- Prevent cycles: an item cannot be moved inside itself or any of its descendants.
- Do not allow an Environment Page to contain child sections/pages unless the product model intentionally supports this; by default treat it as a leaf containing environment variables.
- Sections and Notes Sections may contain children. Notes Pages and Environment Pages are leaf records by default.

### Global utilities vs user content

Keep global utilities in a visually separated bottom area or utility menu, not mixed into the dynamic content tree. Existing global utilities may include:

- Favorites
- Recently Updated
- Archived
- Trash
- Settings
- Lock Vault
- Sign Out

These must work as global filters/actions, not as hardcoded examples of content categories. Favorites and Recently Updated should query the current user's records. Archived and Trash should use real persisted states. Lock Vault must perform the existing lock behavior. Sign Out must end the authenticated session.

The sidebar must not list Credentials Vault, Environments, Ideas Inbox, Code Library, or Projects as permanent root links just because they were in the first UI draft. An Environment Page only appears in the tree after the user creates one.

## UI and design requirements

Use the attached Stitch references, the current EnvBook visual design, and the existing responsive layout. Keep the dark, minimal, low-clutter developer-vault appearance with the current restrained green accent. Do not redesign unrelated screens or change the tech stack.

The create-type selector should:

- Be a small dialog/popover consistent with the existing UI.
- Use four clear selectable options with icon, name, and one-line description.
- Indicate which type is selected.
- Include Title/Name, parent location (root or a compatible container), Cancel, and Create controls.
- Validate title is not blank and apply consistent length constraints.
- Disable incompatible parent destinations, especially Environment Pages and Notes Pages.
- Be fully accessible: labels, focus management, focus restoration, keyboard navigation, Escape to close, visible focus states, and screen-reader labels.
- Avoid a giant full-screen workflow on desktop. On narrow screens, use a responsive sheet/modal with usable touch targets.

Each page-type icon/color treatment must be consistent across sidebar, breadcrumbs, search results, recent items, and the page header. Do not use color alone to communicate type.

## Data model and backend requirements

Inspect the current data model before editing. Extend the existing model where appropriate rather than creating duplicate competing collections. All records must be scoped to the authenticated owner/user. The backend must enforce ownership and valid parent/child relationships; client-side filtering is not security.

At minimum, the persisted workspace item model should represent:

- Unique ID
- Owner/user ID
- Title/name
- Item type enum: `notes_page`, `section`, `environment_page`, `notes_section`
- Parent ID or null for root
- Ordered position / sort key
- Optional icon or visual metadata if supported
- Optional description for containers
- Content or editor document for Notes Pages
- Environment variable references/records for Environment Pages (secret values encrypted)
- Created timestamp and updated timestamp
- Archived/deleted state consistent with existing Trash/Archive behavior

Use the project's existing naming conventions and Mongoose patterns. Add appropriate indexes, including owner + parent + ordering and owner + type where useful. Validate supported types server-side. Never trust `ownerId`, parent IDs, or access rights supplied by the client without deriving/validating them through the authenticated session.

Backend endpoints or server actions must correctly implement list tree, list children, create item, retrieve item, rename/update metadata, move/reorder, duplicate when allowed, archive, restore, move to trash, permanently delete if confirmed, and search. Follow the existing API architecture; do not introduce unnecessary abstractions or switch frameworks.

### Authorization and integrity checks

- Reject requests for another user's item, even if the caller guesses its ID.
- Verify a proposed parent belongs to the same authenticated user.
- Reject invalid parent types and cycles.
- Verify the source item and target parent exist before moving.
- Apply transactions or a safe multi-step strategy for operations that update parent/order metadata.
- Avoid deleting descendants implicitly unless that behavior is explicit, confirmed, and tested. Prefer moving to Trash with predictable descendant behavior.
- Do not leak environment values in list-tree responses, logs, errors, search snippets, analytics, telemetry, or browser console output.
- Return typed, actionable API errors without leaking stack traces or secrets.

## Search, recent items, favorites, and breadcrumbs

- Search user-created items by title and permitted text fields; respect the current user's authorization and archived/trash state filters.
- Search results must display the item's type and actual location/path.
- Clicking a result opens the correct item type.
- Recently Updated must sort by actual updated timestamps and exclude trashed items by default.
- Favorites must persist per user and reference actual item IDs, not static links.
- Breadcrumbs must be computed from validated parent relationships and remain correct after moving items.
- Prevent loops or excessive recursion when building the tree; enforce reasonable hierarchy depth or protect traversal against malformed data.

## Environment Pages integration

Environment Pages must use the earlier EnvBook bulk environment-variable workflow rather than the old single-credential modal with a credential-type dropdown.

Required environment flow:

1. Create an Environment Page via `/page`, `/section`, or New.
2. Open the Environment Page.
3. Paste multiple lines in `KEY=VALUE` form or import a supported `.env` file.
4. Parse locally into a preview before persistence.
5. Handle comments and blank lines. Clearly report malformed lines, duplicate keys, invalid key names, and unsupported constructs without silently dropping content.
6. Show a preview with key names and masked values.
7. Confirm import, showing which entries will be created, updated, or skipped. Never overwrite existing values silently.
8. Store each variable separately using the existing encrypted-secret design.
9. Provide per-variable reveal, copy, edit, delete and safe confirmation controls.
10. Export only after explicit user action; explain that exports contain plaintext secrets.

The environment page itself must remain part of the user's custom tree; do not create a fixed “Environments” sidebar destination. A user can create multiple Environment Pages, e.g. one per project/environment. Do not expose the actual secrets in the sidebar, previews, list endpoints, logs, errors, or audit event payloads.

## Notes editor integration

Notes Pages must keep the true inline WYSIWYG editor requirement:

- The user writes directly on the page; no separate Markdown textarea plus rendered preview.
- Support the existing slash menu and agreed block types.
- Persist content without losing selection, formatting, order, or nested block structure.
- Reload and continue editing correctly.
- `/page` and `/section` must work as creation actions from the editor.
- Ensure adding a page link/mention doesn't create invalid editor JSON or corrupt existing note content.
- Notes Section is a navigable container, not a page that unexpectedly opens the WYSIWYG text body.

## Error states and edge cases

Handle and test:

- Empty workspace and no matching search results.
- Cancel a new-item dialog without creating a record.
- Blank/too-long title.
- Duplicate titles (define behavior clearly; allow same title in different parents, and either allow or clearly disambiguate same-parent duplicates).
- Network/API error during create, move, rename, archive, delete, or restore.
- Stale tree after another update; refetch/reconcile safely.
- Missing/deleted parent.
- Attempt to move to a descendant or invalid parent type.
- Deleted or archived parent with existing children.
- Orphaned/corrupt parent references.
- User tries to access another account's item by manually changing an ID in a URL/API call.
- Environment Page import with empty value, `=` inside values, whitespace, quoted values, comments, CRLF, duplicate keys, Unicode, multiline/unsupported values, and very large input.
- Mobile dialog overflow and keyboard behavior.
- A slash command that is typed and then cancelled.

Provide user-friendly errors and never report success before the server confirms persistence.

## Automated testing requirements

Add or extend tests using the project's existing test stack. Do not install an unrelated test framework unless there is no usable framework and the choice is justified.

### Unit tests

- Type validation and compatibility matrix.
- Tree construction and sorting.
- Breadcrumb generation.
- Parent/cycle validation.
- Title normalization/validation.
- Environment `.env` parsing and duplicate detection.
- Archive/trash/restore state transitions.

### API integration tests

- Create each of the four item types.
- List root tree and nested children for the authenticated user.
- Create children within valid Sections and Notes Sections.
- Reject invalid parent combinations.
- Rename, move, reorder, archive, restore, duplicate, and delete according to implementation policy.
- Enforce owner scoping for every route.
- Reject IDOR attempts against another user's content.
- Ensure secret values are omitted or encrypted in the appropriate API/storage paths.

### Browser E2E tests

- A new account sees no fake Project, Credentials Vault, Environments, Ideas Inbox or Code Library nodes.
- Click New and choose Notes Page; enter a title, edit content, save, reload, and verify persistence.
- Type `/page`; choose Section; verify it appears in the tree.
- Type `/section`; verify Section is preselected and changing type is possible.
- Create a Notes Section and nest notes inside it.
- Create an Environment Page and bulk-import multiple key/value entries.
- Verify all entries appear independently, masked by default, and can be revealed, copied, edited, and deleted.
- Cancel type selection and confirm no item was created and no editor text was lost.
- Rename/move/archive/restore and verify sidebar, breadcrumbs, search, and recently updated views.
- Verify navigation works after reload and across desktop/mobile widths.
- Test keyboard-only operation and visible focus states.
- Verify a non-owner cannot access another user's items.
- Verify no secret values appear in browser console, API errors, ordinary tree responses, or app logs.

## Definition of Done

Do not declare complete until all applicable gates pass:

1. Hardcoded user-content categories are removed from primary navigation.
2. Sidebar contents are loaded from real authenticated user data.
3. All four item types can be created through the type chooser.
4. `/page` and `/section` are operational editor commands, not decorative text.
5. Type-specific rendering, nesting rules, and page actions work end-to-end.
6. The project builds with strict TypeScript and passes existing lint/type checks.
7. Relevant unit, API integration, and browser E2E tests pass.
8. Desktop and mobile UI have been exercised at multiple viewport sizes.
9. Existing notes, environment entries, and credential data remain intact.
10. Security review confirms user scoping, hierarchy integrity, and no secret leakage.
11. Any failed or unavailable test is disclosed explicitly; do not claim it passed.

## Execution instructions for Antigravity

1. Inspect the repository structure and read `PRD.md`, all existing implementation notes, and the Stitch ZIP contents. Identify the current sidebar, editor slash-command registry, data models, API routes, auth middleware, and environment page implementation.
2. Write a short implementation checklist based on the current code, but continue immediately to implementation—do not stop after planning or ask the user to manually complete routine steps.
3. Implement this correction with the smallest coherent set of changes. Keep code concise and avoid unnecessary abstraction. Add comments that explain important data flows and security-sensitive logic.
4. Preserve working features and backward compatibility. Do not change the chosen stack or replace working libraries without a specific technical reason.
5. Add or update migrations only if required; make migrations safe, idempotent, and tested.
6. Run format/lint, TypeScript, unit, API integration, browser E2E, production build, and relevant dependency/security checks available in this repository. Start the app and test the actual browser flows if the environment supports it.
7. Fix failures and rerun the relevant checks. Do not delete tests, weaken assertions, skip broken paths, or suppress failures merely to get a green result.
8. Inspect screenshots or browser runs at desktop and phone sizes against Stitch. Fix overflow, clipping, unreadable text, focus traps, and navigation mismatch.
9. Provide a final report listing changed files, data migration details, features delivered, exact test commands and outcomes, any test limitations, and any remaining production blockers. Never claim production-ready status without evidence.

**Important constraints:** Do not change the project technology stack. Do not add new environment variables. Do not place actual secrets in code, seeds, fixtures, screenshots, test output, or documentation. Do not remove or overwrite existing user data. Do not make the workspace's content categories hardcoded again under another label.
