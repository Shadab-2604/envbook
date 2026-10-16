# QA Report: EnvBook Block Selection, Deletion & Subpage Sync

**Feature Specification**: Notion-style Block Selection, Multi-Block Deletion & Synchronized Subpage Lifecycle  
**Date**: October 17, 2026  
**Status**: Verified & Passing

---

## 1. Overview & Objectives

This implementation delivers Notion-style block selection and deletion interactions in EnvBook without altering the Terminal Noir aesthetic or breaking existing functionality:
1. **Synchronized Subpage Deletion**: Deleting a subpage from the Workspace Tree, the parent page link block, or the Trash ensures the underlying entry and all nested subpages are deleted across the entire application with no orphaned records or stale links.
2. **Notion-Style Block Selection**: Left-gutter hover handle (`GripVertical`), single-click block selection, Shift-click range selection, mouse drag-to-select across blocks, and dark-theme emerald glow highlighting.
3. **Selected Block Deletion**: `Delete` and `Backspace` delete selected blocks without affecting normal text editing. Deleting ordinary text blocks proceeds instantly, while deleting a block representing a subpage prompts for confirmation and cascades deletion to the backend.
4. **Editor Compatibility & Data Integrity**: Full compatibility with zero-knowledge AES-256-GCM encryption, Markdown conversion, raw Markdown editing mode, autosave, undo/redo, and collaborative WebSocket broadcasts.

---

## 2. Architecture & Implementation Summary

### A. Recursive Subpage Deletion & Restoration (Backend)
- **Files Modified**:
  - `apps/api/src/controllers/entryController.ts`
  - `apps/web/src/app/api/[...path]/route.ts`
- **Logic**:
  - Implemented `getAllDescendantEntryIds(owner, rootEntryId)` helper using a breadth-first search to discover all nested subpages under a given entry.
  - Updated `deleteEntry` (both soft-delete to Trash and permanent purge) to cascade to all descendants.
  - Updated `restoreEntry` to cascade restoration down the hierarchy.
  - Maintained authorization and owner verification on all operations.

### B. Synchronized Subpage Lifecycle & Event Bus (Frontend)
- **Files Modified**:
  - `apps/web/src/components/editor/ChildPageNode.tsx`
  - `apps/web/src/components/layout/SideNavBar.tsx`
  - `apps/web/src/app/app/page/[pageId]/page.tsx`
  - `apps/web/src/app/app/trash/page.tsx`
- **Logic**:
  - **Direct Subpage Block Deletion**: Added a delete action (trash button) to `ChildPageNode` on hover. Clicking it prompts for confirmation, deletes the record via `apiDeleteEntry(pageId)`, removes the node from ProseMirror, and dispatches `envbook:subpage-deleted` and `envbook:workspace-tree-updated`.
  - **Tree & Trash Synchronization**: In `SideNavBar.tsx` and `trash/page.tsx`, deleting entries removes all descendants from local state and broadcasts `envbook:subpage-deleted`.
  - **Open Page Auto-Cleanup**: In `page.tsx`, listeners for `envbook:subpage-deleted` remove stale child page nodes in real time. If the currently open page itself is deleted, it redirects to `/app`.
  - **Proactive Stale Subpage Sanitization**: In `page.tsx` `loadEntry`, all referenced `data-page-id` blocks are checked against the database. Any deleted or missing subpages are automatically stripped from content and re-saved.

### C. Notion-Style Block Selection & Deletion (Editor)
- **Files Modified**:
  - `apps/web/src/components/editor/BlockEditor.tsx`
  - `apps/web/src/app/globals.css`
- **Logic**:
  - **Left Gutter & Handle**: Added `pl-10` padding to `.ProseMirror` canvas to create a dedicated gutter. A floating `GripVertical` handle appears dynamically on hover aligned with the top of the hovered top-level block.
  - **Block Selection State**: Tracks `selectedBlockIndices: Set<number>` and `anchorBlockIndex: number | null`.
  - **Selection Highlighting**: Applies `[data-block-selected="true"]` to selected DOM elements with `rgba(16, 185, 129, 0.12)` background, `2px solid rgba(16, 185, 129, 0.5)` outline, and rounded borders.
  - **Selection Interactions**:
    - *Click handle*: Selects single block.
    - *Shift-click handle*: Selects range from anchor to clicked block.
    - *Drag handle / gutter*: Sets dragging mode and selects all blocks traversed by the cursor.
    - *Click inside text*: Clears block selection, places normal text cursor, and allows immediate editing.
    - *Shift+ArrowDown / Shift+ArrowUp*: Extends selection up or down.
    - *Escape*: Deselects all blocks.
  - **Safe Block Deletion**:
    - When `selectedBlockIndices` has items, `Delete` or `Backspace` triggers `deleteSelectedBlocks`.
    - If any selected block is a subpage (`childPage`), prompts confirmation and calls `apiDeleteEntry`.
    - Ordinary text blocks delete immediately with no prompt.
    - ProseMirror deletions are performed in reverse index order (`b.from - a.from`) to prevent offset shifting.
    - If the entire document is deleted, it resets to `<p></p>` to avoid an invalid ProseMirror state.
  - **Floating Action Pill**: Displays when blocks are selected with count, a one-click Delete button, and Deselect button.

---

## 3. Verification & Test Matrix

| # | Test Scenario | Expected Outcome | Result |
|---|---|---|---|
| 1 | Single-block handle click | Block is highlighted with emerald glow outline and background; handle becomes active | PASS |
| 2 | Shift-click block handle | Range of blocks between anchor and clicked block are selected and highlighted | PASS |
| 3 | Click & drag in gutter / handle | Traversed blocks are dynamically added to selection without native text selection conflicts | PASS |
| 4 | Click inside text block | Block selection clears instantly; text cursor is placed; text can be edited and typed | PASS |
| 5 | Ordinary block deletion (`Delete`/`Backspace`) | Selected blocks are deleted immediately with no confirmation dialog; selection clears | PASS |
| 6 | Subpage block deletion | Prompts confirmation dialog; upon confirm, deletes subpage from DB and removes block | PASS |
| 7 | Multi-block deletion with mixed blocks | Prompts confirmation for subpage; upon confirm, deletes subpage and text blocks together | PASS |
| 8 | Whole document deletion | Document cleanly resets to empty `<p></p>` paragraph without crash or schema errors | PASS |
| 9 | Subpage deletion from Workspace Tree | Subpage and all nested descendants are deleted; tree updates; open parent page cleans link | PASS |
| 10 | Stale subpage on page reload | Parent page checks child page IDs on load and removes references to deleted subpages | PASS |
| 11 | Recursive soft-delete & restore | Soft-deleting parent moves children and grandchildren to Trash; restoring restores all | PASS |
| 12 | Recursive permanent delete | Permanently purging parent deletes all descendants from DB without leaving orphans | PASS |
| 13 | Undo / Redo (`Ctrl+Z` / `Ctrl+Y`) | Deleted text blocks are restored via ProseMirror transaction history | PASS |
| 14 | Raw Markdown mode toggle | Raw markdown source view remains fully intact and editable | PASS |
| 15 | Cross-user authorization | User B cannot delete or access User A's subpages or parent entries (404/403) | PASS |

---

## 4. Automated Test Results

### Backend API Vitest Suite
```
 RUN  v3.2.7 C:/D-drive/code/envbook/apps/api

 ✓ test/share_collaboration.test.ts (5 tests)
 ✓ test/auth.test.ts (6 tests)
 ✓ test/entries.test.ts (5 tests)
   ✓ enforces strict cross-user ownership isolation
   ✓ handles trash soft-delete and restore cycles
   ✓ tracks version history on payload update and restores past snapshot
   ✓ persists, updates, and removes document emoji icons
   ✓ recursively cascades subpage deletion and permanent deletion without leaving orphans
 ✓ test/backup.test.ts (1 test)
 ✓ test/vault.test.ts (1 test)
 ✓ test/envai.test.ts (8 tests)

 Test Files  6 passed (6)
      Tests  26 passed (26)
   Duration  4.73s
```

### Web Application Production Build
```
> web@1.0.0 build
> next build

   ▲ Next.js 15.5.28
   Creating an optimized production build ...
 ✓ Compiled successfully in 3.7s
   Linting and checking validity of types ...
 ✓ Generating static pages (25/25)
   Finalizing page optimization ...

Route (app)                                 Size  First Load JS
├ ƒ /api/[...path]                         151 B         103 kB
├ ƒ /app/page/[pageId]                    191 kB         449 kB
...
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
Exit code: 0
```
