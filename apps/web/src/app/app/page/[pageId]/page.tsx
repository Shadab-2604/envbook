'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star,
  Clock,
  Download,
  Trash2,
  Archive,
  ChevronRight,
  History,
  ListTree,
  FileText,
  Tag,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronLeft,
  X,
  RotateCcw,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntryById,
  apiUpdateEntry,
  apiDeleteEntry,
  apiArchiveEntry,
  apiGetHistory,
  apiRestoreHistoryVersion,
} from '@/lib/api';
import { BlockEditor } from '@/components/editor/BlockEditor';
import { CreateItemModal } from '@/components/layout/CreateItemModal';
import { EntryRecord, DecryptedNotePayload, EntryVersionSnapshot, WorkspaceItemType } from '@envbook/shared';

export default function NotePage() {
  const params = useParams();
  const pageId = params?.pageId as string;
  const router = useRouter();
  const vault = useVault();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryRecord | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isRawMarkdown, setIsRawMarkdown] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [headings, setHeadings] = useState<Array<{ level: number; text: string; id: string }>>([]);
  const [showToc, setShowToc] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<EntryVersionSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<{ id: string; title: string; content: string } | null>(null);

  // Modal triggered by slash command /page, /section, etc.
  const [editorCreateModalOpen, setEditorCreateModalOpen] = useState(false);
  const [editorCreateModalType, setEditorCreateModalType] = useState<WorkspaceItemType>('notes_page');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);

  // Load entry and decrypt payload
  const loadEntry = useCallback(async () => {
    if (!pageId || !vault.isUnlocked) return;

    try {
      setLoading(true);
      setError(null);
      const res = await apiGetEntryById(pageId);
      const rec = res.entry;
      setEntry(rec);
      setIsFavorite(Boolean(rec.isFavorite));

      // Decrypt payload
      const decrypted = await vault.decrypt<DecryptedNotePayload>(
        rec.encryptedPayload,
        rec.nonce,
        rec.entryId
      );

      setTitle(decrypted.title || 'Untitled');
      setContent(decrypted.content || '');
      setTags(decrypted.tags || []);
      isDirtyRef.current = false;
    } catch (err: any) {
      console.error('[NotePage] Error loading entry:', err);
      setError(err.message || 'Failed to decrypt and load page.');
    } finally {
      setLoading(false);
    }
  }, [pageId, vault]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  // Autosave handler with debounce
  const triggerSave = useCallback(
    async (newTitle: string, newContent: string, newTags: string[]) => {
      if (!entry || !vault.isUnlocked) return;

      try {
        setSaveStatus('saving');
        const payload: DecryptedNotePayload = {
          title: newTitle,
          content: newContent,
          tags: newTags,
          updatedAt: new Date().toISOString(),
        };

        const { ciphertext, nonce } = await vault.encrypt(payload, entry.entryId);
        const res = await apiUpdateEntry(entry.entryId, {
          encryptedPayload: ciphertext,
          nonce,
        });

        setEntry(res.entry);
        setSaveStatus('saved');
        isDirtyRef.current = false;
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err: any) {
        console.error('[NotePage] Save failed:', err);
        setSaveStatus('error');
      }
    },
    [entry, vault]
  );

  const queueSave = useCallback(
    (newTitle: string, newContent: string, newTags: string[]) => {
      isDirtyRef.current = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        triggerSave(newTitle, newContent, newTags);
      }, 1200); // 1.2s debounce
    },
    [triggerSave]
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    queueSave(val, content, tags);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    queueSave(title, val, tags);
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, '');
    if (!trimmed || tags.includes(trimmed)) return;
    const updated = [...tags, trimmed];
    setTags(updated);
    setNewTagInput('');
    queueSave(title, content, updated);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    setTags(updated);
    queueSave(title, content, updated);
  };

  const handleToggleFavorite = async () => {
    if (!entry) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await apiUpdateEntry(entry.entryId, { isFavorite: next });
    } catch (err) {
      setIsFavorite(!next);
    }
  };

  const handleArchive = async () => {
    if (!entry) return;
    if (confirm('Archive this note? It will be moved to the archive view.')) {
      await apiArchiveEntry(entry.entryId);
      router.push('/app');
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (confirm('Move this note to trash? You can restore it later from Trash.')) {
      await apiDeleteEntry(entry.entryId);
      router.push('/app');
    }
  };

  // Safe client-side Markdown export
  const handleExportMarkdown = () => {
    const element = document.createElement('a');
    const file = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'note'}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Load version history
  const handleOpenHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await apiGetHistory(pageId);
      setHistoryList(res.history || []);
    } catch (err) {
      console.error('Failed to get history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRestoreVersion = async (version: EntryVersionSnapshot) => {
    if (!entry || !vault.isUnlocked) return;
    if (!confirm(`Restore note to snapshot from ${new Date(version.createdAt).toLocaleString()}?`)) return;

    try {
      await apiRestoreHistoryVersion(entry.entryId, version.versionId);
      await loadEntry();
      setShowHistory(false);
      setPreviewVersion(null);
    } catch (err: any) {
      alert(`Failed to restore: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-surface-canvas text-text-muted font-label-mono text-xs">
        <span className="w-2 h-2 rounded-full bg-accent-emerald animate-ping mr-2" />
        Decrypting zero-knowledge payload...
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-surface-canvas p-6 text-center">
        <AlertCircle className="w-8 h-8 text-status-danger mb-3" />
        <h2 className="text-headline-sm font-semibold text-text-primary mb-1">Page Unavailable</h2>
        <p className="text-body-sm text-text-muted mb-4 max-w-md">{error || 'This page could not be found or decrypted.'}</p>
        <Link
          href="/app"
          className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-secondary text-xs font-label-ui transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Top action bar */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        {/* Breadcrumb and Status */}
        <div className="flex items-center gap-2 overflow-hidden">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono shrink-0">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-secondary text-xs font-label-mono shrink-0">Pages</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium truncate max-w-[180px] sm:max-w-xs">{title || 'Untitled'}</span>

          {/* Save Status Badge */}
          <div className="ml-2 flex items-center gap-1.5 text-[11px] font-label-mono">
            {saveStatus === 'saving' && (
              <span className="text-status-warning flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-accent-emerald flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-status-danger flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-status-danger" />
                Save Failed
              </span>
            )}
            {saveStatus === 'idle' && (
              <span className="text-text-muted flex items-center gap-1 opacity-70">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald/60" />
                Encrypted
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Table of Contents trigger */}
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-1.5 rounded border transition-colors ${
              showToc
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-surface-panel hover:bg-surface-raised border-border-subtle text-text-muted hover:text-text-primary'
            }`}
            title="Toggle Table of Contents"
          >
            <ListTree className="w-4 h-4" />
          </button>

          {/* Raw Markdown toggle */}
          <button
            onClick={() => setIsRawMarkdown(!isRawMarkdown)}
            className={`px-2 py-1 rounded border text-xs font-label-mono transition-colors ${
              isRawMarkdown
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-surface-panel hover:bg-surface-raised border-border-subtle text-text-muted hover:text-text-primary'
            }`}
            title="Toggle Markdown Source"
          >
            {isRawMarkdown ? 'Rendered' : 'Raw Markdown'}
          </button>

          {/* History / Snapshots */}
          <button
            onClick={handleOpenHistory}
            className="p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
            title="Version History"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Favorite */}
          <button
            onClick={handleToggleFavorite}
            className={`p-1.5 rounded border transition-colors ${
              isFavorite
                ? 'bg-status-warning/15 border-status-warning/40 text-status-warning'
                : 'bg-surface-panel hover:bg-surface-raised border-border-subtle text-text-muted hover:text-text-primary'
            }`}
            title={isFavorite ? 'Unfavorite' : 'Add to favorites'}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>

          {/* Export Markdown */}
          <button
            onClick={handleExportMarkdown}
            className="p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
            title="Export as Markdown (.md)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Archive */}
          <button
            onClick={handleArchive}
            className="p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
            title="Archive Note"
          >
            <Archive className="w-4 h-4" />
          </button>

          {/* Delete to Trash */}
          <button
            onClick={handleDelete}
            className="p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-status-danger transition-colors"
            title="Move to Trash"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container with optional TOC sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Main Canvas */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 mono-scroll">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {/* Note Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Document..."
              className="w-full bg-transparent border-none text-2xl sm:text-3xl font-headline-lg font-bold text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-0 p-0 tracking-tight"
            />

            {/* Tags strip */}
            <div className="flex flex-wrap items-center gap-1.5 py-1 border-b border-border-subtle/60 text-xs">
              <Tag className="w-3.5 h-3.5 text-text-muted mr-1" />
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-panel border border-border-subtle text-text-secondary font-label-mono text-[11px]"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-status-danger text-text-muted"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="+ Add tag"
                  className="bg-transparent border border-transparent hover:border-border-subtle focus:border-border-accent rounded px-1.5 py-0.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none font-label-mono w-20"
                />
              </div>
            </div>

            {/* Block Editor component */}
            <div className="min-h-[450px] pt-2">
              <BlockEditor
                content={content}
                onChange={handleContentChange}
                isRawMarkdown={isRawMarkdown}
                onHeadingsChange={setHeadings}
                onRequestCreateItem={(type) => {
                  setEditorCreateModalType(type);
                  setEditorCreateModalOpen(true);
                }}
              />
            </div>

            {/* Creation Dialog invoked via slash commands */}
            <CreateItemModal
              isOpen={editorCreateModalOpen}
              onClose={() => setEditorCreateModalOpen(false)}
              initialType={editorCreateModalType}
              initialParentId={entry?.parentId || null}
            />
          </div>
        </main>

        {/* Table of Contents Drawer */}
        {showToc && (
          <aside className="w-64 border-l border-border-subtle bg-surface-subtle p-4 shrink-0 overflow-y-auto hidden md:flex md:flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="text-label-mono text-xs uppercase tracking-wider text-text-muted font-medium">
                Table of Contents
              </span>
              <button
                onClick={() => setShowToc(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {headings.length === 0 ? (
              <p className="text-xs text-text-muted font-label-mono italic">
                No headings yet. Use /h1, /h2 or # markdown to structure.
              </p>
            ) : (
              <nav className="flex flex-col gap-1 text-xs font-body-sm">
                {headings.map((h, i) => (
                  <a
                    key={`${h.id}-${i}`}
                    href={`#${h.id}`}
                    style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                    className="text-text-secondary hover:text-primary transition-colors py-1 truncate"
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            )}
          </aside>
        )}
      </div>

      {/* Version History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-panel border border-border-subtle rounded-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Version History Snapshots</h3>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {historyLoading ? (
                <div className="text-center py-6 text-xs text-text-muted font-label-mono">
                  Loading snapshots...
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted font-label-mono">
                  No historical versions saved yet. Versions are automatically recorded on edits.
                </div>
              ) : (
                historyList.map((ver) => (
                  <div
                    key={ver.versionId}
                    className="flex items-center justify-between p-3 rounded bg-surface border border-border-subtle hover:border-border-muted transition-colors text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-text-primary">
                        {new Date(ver.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-text-muted font-label-mono">
                        Schema v{ver.schemaVersion || 1} • Nonce: {ver.nonce.slice(0, 8)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreVersion(ver)}
                        className="px-2.5 py-1 rounded bg-surface-raised hover:bg-surface-bright border border-border-subtle text-text-primary font-label-ui flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-accent-emerald" />
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-border-subtle bg-surface-subtle flex justify-end">
              <button
                onClick={() => setShowHistory(false)}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
