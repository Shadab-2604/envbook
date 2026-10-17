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
  FileCode,
  FileDown,
  Globe,
  ChevronDown,
  Sparkles,
  Share2,
  Users,
  FilePlus,
  Smile,
  Eye,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntryById,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
  apiArchiveEntry,
  apiGetHistory,
  apiRestoreHistoryVersion,
} from '@/lib/api';
import { exportToMarkdown, exportToHtml, exportToPdf } from '@/lib/exportUtils';
import { BlockEditor } from '@/components/editor/BlockEditor';
import { CreateItemModal } from '@/components/layout/CreateItemModal';
import { EnvAiPanel } from '@/components/ai/EnvAiPanel';
import { ShareModal } from '@/components/share/ShareModal';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { DocumentEmojiPicker } from '@/components/ui/DocumentEmojiPicker';
import { SnapshotDiffView } from '@/components/ui/SnapshotDiffView';
import { usePageCollaboration } from '@/lib/socket';
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
  const [icon, setIcon] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isRawMarkdown, setIsRawMarkdown] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [headings, setHeadings] = useState<Array<{ level: number; text: string; id: string }>>([]);
  const [showToc, setShowToc] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<EntryVersionSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    version: EntryVersionSnapshot;
    title: string;
    content: string;
  } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  // Load auto-save setting from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('envbook:auto-save-enabled');
      if (stored !== null) {
        setAutoSaveEnabled(stored === 'true');
      }
    } catch {}
  }, []);

  // Modal triggered by slash command /page, /section, etc.
  const [editorCreateModalOpen, setEditorCreateModalOpen] = useState(false);
  const [editorCreateModalType, setEditorCreateModalType] = useState<WorkspaceItemType>('notes_page');

  // envAi Assistant state
  const [showEnvAi, setShowEnvAi] = useState(false);
  const [selectedEditorText, setSelectedEditorText] = useState('');

  // Share Modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Child Page creation prompt
  const [childPageModalOpen, setChildPageModalOpen] = useState(false);
  const [childPageTitle, setChildPageTitle] = useState('');
  const [childPageCreating, setChildPageCreating] = useState(false);
  const childPageCallbackRef = useRef<((child: { id: string; title: string }) => void) | null>(null);

  // Real-time collaborative updates via WebSockets
  const { isConnected, collaborators, broadcastChange } = usePageCollaboration(pageId, {
    onRemoteUpdate: (data) => {
      if (data.content && data.content !== content) {
        setContent(data.content);
        if (data.title && data.title !== title) {
          setTitle(data.title);
        }
      }
    },
  });

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

      let initialContent = decrypted.content || '';
      if (initialContent.includes('data-page-id=')) {
        try {
          const parser = new DOMParser();
          const parsedDoc = parser.parseFromString(initialContent, 'text/html');
          const childPageEls = Array.from(parsedDoc.querySelectorAll('[data-page-id]'));
          let hasStaleChild = false;

          for (const el of childPageEls) {
            const childId = el.getAttribute('data-page-id');
            if (childId) {
              try {
                const childRes = await apiGetEntryById(childId);
                if (!childRes?.entry || childRes.entry.isDeleted) {
                  el.remove();
                  hasStaleChild = true;
                }
              } catch {
                el.remove();
                hasStaleChild = true;
              }
            }
          }

          if (hasStaleChild) {
            initialContent = parsedDoc.body.innerHTML;
            const cleanPayload = {
              title: decrypted.title || 'Untitled',
              content: initialContent,
              tags: decrypted.tags || [],
              icon: decrypted.icon || rec.icon || undefined,
              updatedAt: new Date().toISOString(),
            };
            const { ciphertext, nonce } = await vault.encrypt(cleanPayload, rec.entryId);
            await apiUpdateEntry(rec.entryId, { encryptedPayload: ciphertext, nonce, icon: cleanPayload.icon });
            window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
          }
        } catch (cleanErr) {
          console.error('[NotePage] Error checking subpages:', cleanErr);
        }
      }

      setTitle(decrypted.title || 'Untitled');
      setContent(initialContent);
      setTags(decrypted.tags || []);
      setIcon(decrypted.icon || rec.icon || null);
      isDirtyRef.current = false;
      setIsDirty(false);
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

  useEffect(() => {
    document.title = title ? `${title} — EnvBook` : 'Page Editor — EnvBook';
  }, [title]);

  // Autosave handler with debounce
  const triggerSave = useCallback(
    async (
      newTitle: string,
      newContent: string,
      newTags: string[],
      newIcon: string | null = icon
    ) => {
      if (!entry || !vault.isUnlocked) return;

      try {
        setSaveStatus('saving');
        const payload: DecryptedNotePayload = {
          title: newTitle,
          content: newContent,
          tags: newTags,
          icon: newIcon || undefined,
          updatedAt: new Date().toISOString(),
        };

        const { ciphertext, nonce } = await vault.encrypt(payload, entry.entryId);
        const res = await apiUpdateEntry(entry.entryId, {
          encryptedPayload: ciphertext,
          nonce,
          icon: newIcon,
        });

        setEntry(res.entry);
        setSaveStatus('saved');
        isDirtyRef.current = false;
        setIsDirty(false);
        window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err: any) {
        console.error('[NotePage] Save failed:', err);
        setSaveStatus('error');
      }
    },
    [entry, vault, icon]
  );

  // Synchronized subpage deletion listener
  useEffect(() => {
    const handleSubpageDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ pageId: string }>;
      const deletedPageId = customEvent.detail?.pageId;
      if (!deletedPageId) return;

      // If the current page itself was deleted, navigate back to workspace
      if (deletedPageId === pageId) {
        router.push('/app');
        return;
      }

      // If this page contains a reference to the deleted subpage, remove it and save
      setContent((currentContent) => {
        if (!currentContent || !currentContent.includes(deletedPageId)) return currentContent;
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(currentContent, 'text/html');
          const matching = doc.querySelectorAll(`[data-page-id="${deletedPageId}"]`);
          if (matching.length > 0) {
            matching.forEach((n) => n.remove());
            const cleaned = doc.body.innerHTML;
            triggerSave(title, cleaned, tags, icon);
            return cleaned;
          }
        } catch (err) {
          console.error('[NotePage] Error removing deleted subpage:', err);
        }
        return currentContent;
      });
    };

    window.addEventListener('envbook:subpage-deleted', handleSubpageDeleted);
    return () => {
      window.removeEventListener('envbook:subpage-deleted', handleSubpageDeleted);
    };
  }, [pageId, router, triggerSave, title, tags, icon]);

  const queueSave = useCallback(
    (
      newTitle: string,
      newContent: string,
      newTags: string[],
      newIcon: string | null = icon
    ) => {
      isDirtyRef.current = true;
      setIsDirty(true);
      if (!autoSaveEnabled) {
        return;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        triggerSave(newTitle, newContent, newTags, newIcon);
      }, 1200); // 1.2s debounce
    },
    [triggerSave, autoSaveEnabled, icon]
  );

  const handleSelectIcon = (selectedEmoji: string) => {
    setIcon(selectedEmoji);
    setShowEmojiPicker(false);
    triggerSave(title, content, tags, selectedEmoji);
  };

  const handleRemoveIcon = () => {
    setIcon(null);
    setShowEmojiPicker(false);
    triggerSave(title, content, tags, null);
  };

  const handleToggleAutoSave = () => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    try {
      localStorage.setItem('envbook:auto-save-enabled', String(next));
    } catch {}
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    broadcastChange(content, val);
    queueSave(val, content, tags, icon);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    broadcastChange(val, title);
    queueSave(title, val, tags, icon);
  };

  const handleRequestCreateChildPage = useCallback(
    (onCreated: (child: { id: string; title: string }) => void) => {
      childPageCallbackRef.current = onCreated;
      setChildPageTitle('');
      setChildPageModalOpen(true);
    },
    []
  );

  const handleConfirmCreateChildPage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalTitle = childPageTitle.trim() || 'Untitled Subpage';
    if (!entry || !vault.isUnlocked) return;

    try {
      setChildPageCreating(true);
      const childId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'page-' + Date.now();

      const childPayload: DecryptedNotePayload = {
        title: finalTitle,
        content: '',
        tags: [],
        updatedAt: new Date().toISOString(),
      };

      const { ciphertext, nonce } = await vault.encrypt(childPayload, childId);

      // Create entry with parentId set to CURRENT pageId
      await apiCreateEntry({
        entryId: childId,
        parentId: entry.entryId,
        type: 'notes_page',
        encryptedPayload: ciphertext,
        nonce,
        sortOrder: 0,
      });

      // Insert child page node into editor at current cursor position
      if (childPageCallbackRef.current) {
        childPageCallbackRef.current({ id: childId, title: finalTitle });
        childPageCallbackRef.current = null;
      }

      // Notify sidebar to refresh tree
      window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));

      setChildPageModalOpen(false);
      setChildPageTitle('');
    } catch (err: any) {
      console.error('[NotePage] Failed to create child page:', err);
      alert('Failed to create child page: ' + (err.message || 'Unknown error'));
    } finally {
      setChildPageCreating(false);
    }
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

  const handleApplyEnvAi = async (
    action: 'insert' | 'append' | 'replace_selected' | 'replace_note' | 'create_new_note',
    aiText: string
  ) => {
    if (action === 'create_new_note') {
      if (!vault.isUnlocked) return;
      try {
        const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'note-' + Date.now();
        const newPayload: DecryptedNotePayload = {
          title: 'AI Draft: ' + (title || 'New Note'),
          content: aiText,
          tags: ['ai-generated', ...tags],
        };
        const { ciphertext, nonce } = await vault.encrypt(newPayload, newId);
        await apiCreateEntry({
          entryId: newId,
          parentId: entry?.parentId || null,
          type: 'notes_page',
          encryptedPayload: ciphertext,
          nonce,
          sortOrder: 0,
        });
        router.push(`/app/page/${newId}`);
      } catch (err: any) {
        alert('Failed to create new note: ' + err.message);
      }
      return;
    }

    if (action === 'replace_note') {
      setContent(aiText);
      queueSave(title, aiText, tags);
      return;
    }

    if (action === 'append') {
      const updated = content ? `${content}\n\n${aiText}` : aiText;
      setContent(updated);
      queueSave(title, updated, tags);
      return;
    }

    if (action === 'insert' || action === 'replace_selected') {
      const updated = content ? `${content}\n\n${aiText}` : aiText;
      setContent(updated);
      queueSave(title, updated, tags);
      return;
    }
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
      window.dispatchEvent(new CustomEvent('envbook:subpage-deleted', { detail: { pageId: entry.entryId } }));
      window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
      router.push('/app');
    }
  };

  // Save / Export options dropdown
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  // Keyboard shortcut Ctrl+S / Cmd+S for immediate save to vault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerSave(title, content, tags, icon);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSave, title, content, tags, icon]);

  // Client-side export handlers (Markdown, PDF, HTML)
  const handleExportMarkdown = () => {
    exportToMarkdown(title, content);
  };

  const handleExportHtml = () => {
    exportToHtml(title, content, tags);
  };

  const handleExportPdf = () => {
    exportToPdf(title, content, tags);
  };

  const handleManualSave = () => {
    triggerSave(title, content, tags, icon);
  };

  // Safe client-side Markdown export fallback
  // Load version history
  const handleOpenHistory = async () => {
    setShowHistory(true);
    setPreviewSnapshot(null);
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

  const handlePreviewSnapshot = async (version: EntryVersionSnapshot) => {
    if (!entry || !vault.isUnlocked) return;
    try {
      setPreviewLoadingId(version.versionId);
      const dec = await vault.decrypt<DecryptedNotePayload>(
        version.encryptedPayload,
        version.nonce,
        entry.entryId
      );
      setPreviewSnapshot({
        version,
        title: dec?.title || 'Untitled',
        content: dec?.content || '',
      });
    } catch (err: any) {
      alert('Failed to decrypt snapshot: ' + (err.message || 'Unknown error'));
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleRestoreVersion = async (version: EntryVersionSnapshot) => {
    if (!entry || !vault.isUnlocked) return;
    if (!confirm(`Restore note to snapshot from ${new Date(version.createdAt).toLocaleString()}?`)) return;

    try {
      await apiRestoreHistoryVersion(entry.entryId, version.versionId);
      await loadEntry();
      setShowHistory(false);
      setPreviewSnapshot(null);
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
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-surface-canvas p-6 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-surface-panel border border-border-subtle flex items-center justify-center mb-4 text-text-muted shadow-sm">
          <FileText className="w-7 h-7 text-text-muted" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-label-mono bg-surface-panel border border-border-subtle text-text-muted mb-3">
          RECORD_UNAVAILABLE
        </div>
        <h2 className="text-headline-sm font-semibold text-text-primary mb-2">Page Record Not Found</h2>
        <p className="text-body-sm text-text-muted mb-6 max-w-md">
          {error || 'This record could not be found, may have been moved, deleted, or is not accessible with your current vault authorization.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="px-4 py-2 rounded-lg bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-primary text-xs font-label-ui font-medium transition-colors"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/app/trash"
            className="px-4 py-2 rounded-lg bg-transparent hover:bg-surface-panel border border-border-subtle text-text-secondary text-xs font-label-ui transition-colors inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-text-muted" />
            Check Trash
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Top action bar */}
      <header className="h-12 border-b border-border-subtle bg-surface-toolbar px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 select-none">
        {/* Left Group: Breadcrumbs & Status */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono shrink-0 transition-colors">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs shrink-0">/</span>
          <span className="text-text-muted text-xs font-label-mono shrink-0 hidden sm:inline">Pages</span>
          <span className="text-mask-glyph font-label-mono text-xs shrink-0 hidden sm:inline">/</span>
          <span className="text-text-primary text-xs font-medium truncate max-w-[120px] sm:max-w-[180px] md:max-w-xs flex items-center gap-1.5" title={title || 'Untitled'}>
            {icon && <span className="shrink-0 text-sm">{icon}</span>}
            <span className="truncate">{title || 'Untitled'}</span>
          </span>

          {/* Save Status Badge */}
          <div className="ml-1 sm:ml-2 flex items-center gap-1.5 text-[11px] font-label-mono shrink-0">
            {saveStatus === 'saving' && (
              <span className="text-status-warning flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />
                <span className="hidden sm:inline">Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-primary flex items-center gap-1 font-semibold" title="Saved to encrypted vault">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-status-danger flex items-center gap-1 font-semibold" title="Save Failed">
                <AlertCircle className="w-3.5 h-3.5 text-status-danger" />
                <span className="hidden sm:inline">Save Failed</span>
              </span>
            )}
            {saveStatus === 'idle' && (
              <span className="text-text-muted flex items-center gap-1 opacity-70" title="Encrypted session active">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span className="hidden lg:inline">Encrypted</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Groups: Controls & Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Group 1: Document View & Sync */}
          <div className="flex items-center gap-1">
            {/* Auto-save Switch */}
            <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-surface border border-border-subtle text-xs font-label-mono">
              <button
                type="button"
                onClick={handleToggleAutoSave}
                className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
                title={autoSaveEnabled ? 'Auto-save is ON (click to disable)' : 'Auto-save is OFF (click to enable)'}
                aria-label={autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled'}
              >
                <span
                  className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                    autoSaveEnabled ? 'bg-primary' : 'bg-surface-raised border border-border-muted'
                  }`}
                >
                  <span
                    className={`bg-surface-canvas w-2.5 h-2.5 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                      autoSaveEnabled ? 'translate-x-2.5' : 'translate-x-0'
                    }`}
                  />
                </span>
                <span className="text-[10px] font-medium hidden xl:inline text-text-muted group-hover:text-text-primary">
                  {autoSaveEnabled ? 'Auto-save' : 'Manual'}
                </span>
              </button>

              {(!autoSaveEnabled || isDirty) && (
                <button
                  type="button"
                  onClick={() => triggerSave(title, content, tags, icon)}
                  className={`ml-0.5 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                    isDirty
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'bg-surface-raised text-text-muted hover:text-text-primary'
                  }`}
                  title="Save note to encrypted vault (Ctrl+S)"
                >
                  <Save className="w-3 h-3" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              )}
            </div>

            {/* View Mode: Raw Markdown toggle */}
            <button
              type="button"
              onClick={() => setIsRawMarkdown(!isRawMarkdown)}
              className={`px-2 py-1 rounded border text-xs font-label-mono transition-colors flex items-center gap-1 ${
                isRawMarkdown
                  ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                  : 'bg-surface hover:bg-surface-hover border-border-subtle text-text-muted hover:text-text-primary'
              }`}
              title={isRawMarkdown ? 'Switch to WYSIWYG editor' : 'View raw Markdown source'}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isRawMarkdown ? 'Rendered' : 'Raw'}</span>
            </button>

            {/* Table of Contents trigger */}
            <button
              type="button"
              onClick={() => setShowToc(!showToc)}
              className={`p-1.5 rounded border transition-colors ${
                showToc
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-surface hover:bg-surface-hover border-border-subtle text-text-muted hover:text-text-primary'
              }`}
              title="Table of Contents"
              aria-label="Table of Contents"
            >
              <ListTree className="w-3.5 h-3.5" />
            </button>

            {/* History / Snapshots */}
            <button
              type="button"
              onClick={handleOpenHistory}
              className="p-1.5 rounded bg-surface hover:bg-surface-hover border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
              title="Version History & Snapshots"
              aria-label="Version History"
            >
              <History className="w-3.5 h-3.5" />
            </button>

            {/* Favorite */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`p-1.5 rounded border transition-colors ${
                isFavorite
                  ? 'bg-surface-raised border-border-muted text-text-primary'
                  : 'bg-surface hover:bg-surface-hover border-border-subtle text-text-muted hover:text-text-primary'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label="Favorite"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          <div className="h-4 w-px bg-border-subtle mx-0.5 hidden sm:block" />

          {/* Group 2: Intelligence & Collaboration */}
          <div className="flex items-center gap-1">
            {/* Save / Export Options Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded bg-surface hover:bg-surface-hover border border-border-subtle text-text-primary text-xs font-label-ui transition-colors shadow-xs"
                title="Save & Export Options (Markdown, PDF, HTML)"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline font-medium">Export</span>
                <ChevronDown className="w-3 h-3 text-text-muted" />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-surface-elevated border border-border-muted rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 border-b border-border-subtle/80 flex items-center justify-between text-[10px] font-label-mono text-text-muted uppercase tracking-wider">
                    <span>Save / Export</span>
                    <span className="text-primary font-semibold">3 Formats</span>
                  </div>

                  {/* Option 1: Markdown (.md) */}
                  <button
                    onClick={() => {
                      handleExportMarkdown();
                      setExportMenuOpen(false);
                    }}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded hover:bg-surface-hover transition-colors text-left group w-full"
                  >
                    <FileCode className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-primary group-hover:text-primary transition-colors">
                        Markdown (.md)
                      </span>
                      <span className="text-[10px] text-text-muted font-label-mono">
                        Clean raw Markdown text file
                      </span>
                    </div>
                  </button>

                  {/* Option 2: PDF Document (.pdf) */}
                  <button
                    onClick={() => {
                      handleExportPdf();
                      setExportMenuOpen(false);
                    }}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded hover:bg-surface-hover transition-colors text-left group w-full"
                  >
                    <FileDown className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-primary group-hover:text-primary transition-colors">
                        PDF Document (.pdf)
                      </span>
                      <span className="text-[10px] text-text-muted font-label-mono">
                        Print-ready formatted PDF document
                      </span>
                    </div>
                  </button>

                  {/* Option 3: HTML Document (.html) */}
                  <button
                    onClick={() => {
                      handleExportHtml();
                      setExportMenuOpen(false);
                    }}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded hover:bg-surface-hover transition-colors text-left group w-full"
                  >
                    <Globe className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-primary group-hover:text-primary transition-colors">
                        HTML Document (.html)
                      </span>
                      <span className="text-[10px] text-text-muted font-label-mono">
                        Standalone styled web page
                      </span>
                    </div>
                  </button>

                  <div className="my-1 border-t border-border-subtle/80" />

                  {/* Manual Save to Vault */}
                  <button
                    onClick={() => {
                      handleManualSave();
                      setExportMenuOpen(false);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary text-xs w-full"
                  >
                    <div className="flex items-center gap-2">
                      <Save className="w-3.5 h-3.5 text-text-muted" />
                      <span>Save to Vault</span>
                    </div>
                    <kbd className="font-label-mono text-[10px] bg-surface-subtle border border-border-muted px-1 rounded text-text-muted">
                      Ctrl+S
                    </kbd>
                  </button>
                </div>
              )}
            </div>

            {/* envAi Assistant Toggle */}
            <button
              type="button"
              onClick={() => setShowEnvAi(!showEnvAi)}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showEnvAi
                  ? 'bg-primary text-primary-fg border-primary shadow-xs'
                  : 'bg-surface hover:bg-surface-hover border-border-subtle text-text-primary'
              }`}
              title="Toggle envAi Assistant (/envai)"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">envAi</span>
            </button>

            {/* Real-time collaborator presence indicators */}
            {collaborators.length > 0 && (
              <div className="flex items-center -space-x-1.5 mr-1" title={`${collaborators.length} active collaborator(s)`}>
                {collaborators.slice(0, 3).map((c, i) => (
                  <div
                    key={c.userId || i}
                    className="w-6 h-6 rounded-full bg-surface-raised border-2 border-surface flex items-center justify-center text-[10px] font-bold text-primary uppercase"
                    title={c.username}
                  >
                    {c.username.slice(0, 1)}
                  </div>
                ))}
                {collaborators.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-surface-raised border-2 border-surface flex items-center justify-center text-[9px] font-mono text-text-muted">
                    +{collaborators.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Share Page Button */}
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded bg-surface hover:bg-surface-hover border border-border-subtle hover:border-border-muted text-xs font-medium text-text-primary flex items-center gap-1.5 transition-colors"
              title="Share or Publish this note"
            >
              <Share2 className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* In-app Notification Center */}
            <NotificationCenter />
          </div>

          <div className="h-4 w-px bg-border-subtle mx-0.5" />

          {/* Group 3: Organization & Destructive */}
          <div className="flex items-center gap-1">
            {/* Archive */}
            <button
              type="button"
              onClick={handleArchive}
              className="p-1.5 rounded bg-surface hover:bg-surface-hover border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
              title="Archive Note"
              aria-label="Archive Note"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>

            {/* Delete to Trash - Explicitly Styled in Red */}
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 rounded border border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive hover:text-white transition-colors"
              title="Move to Trash"
              aria-label="Move to Trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container with optional TOC sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Main Canvas */}
        <main
          className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8 mono-scroll cursor-text"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (
              !target.closest('input') &&
              !target.closest('button') &&
              !target.closest('a') &&
              !target.closest('[role="dialog"]') &&
              !target.closest('.document-emoji-picker') &&
              !target.closest('.ProseMirror')
            ) {
              const proseMirror = document.querySelector('.ProseMirror') as HTMLElement | null;
              if (proseMirror) {
                proseMirror.focus();
              }
            }
          }}
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-3 min-h-full pb-32">
            {/* Semantic H1 for screen readers and document outline */}
            <h1 className="sr-only">{title || 'Untitled Document'} — EnvBook</h1>

            {/* Document Emoji Icon & Add Icon on Hover */}
            <div className="relative group/title-header flex flex-col gap-1.5 pt-1">
              {icon ? (
                <div className="relative inline-block self-start">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-4xl sm:text-5xl hover:opacity-85 transition-transform hover:scale-105 p-1 -ml-1 rounded-lg hover:bg-surface/60 cursor-pointer flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-border"
                    title="Change document icon"
                    aria-label="Change document icon"
                  >
                    {icon}
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute left-0 top-full mt-2 z-50">
                      <DocumentEmojiPicker
                        currentIcon={icon}
                        onSelect={handleSelectIcon}
                        onRemove={handleRemoveIcon}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative inline-block self-start">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="opacity-0 group-hover/title-header:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface border border-dashed border-border-subtle hover:border-border-muted cursor-pointer"
                    title="Add document icon"
                    aria-label="Add icon"
                  >
                    <Smile className="w-3.5 h-3.5 text-primary" />
                    <span>Add icon</span>
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute left-0 top-full mt-2 z-50">
                      <DocumentEmojiPicker
                        currentIcon={null}
                        onSelect={handleSelectIcon}
                        onRemove={handleRemoveIcon}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Note Title Input */}
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Document..."
                className="w-full bg-transparent border-none text-3xl sm:text-4xl font-headline-lg font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-0 p-0 tracking-tight leading-tight"
              />
            </div>

            {/* Tags strip */}
            <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs">
              <Tag className="w-3.5 h-3.5 text-text-muted mr-1" />
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-text-secondary font-label-mono text-[11px]"
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
                  className="bg-transparent border border-transparent hover:border-border-subtle focus:border-border-accent rounded px-1.5 py-0.5 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none font-label-mono w-20"
                />
              </div>
            </div>

            {/* Block Editor component without fixed height */}
            <div className="w-full flex-1 flex flex-col pt-1">
              <BlockEditor
                content={content}
                onChange={handleContentChange}
                isRawMarkdown={isRawMarkdown}
                onHeadingsChange={setHeadings}
                onRequestCreateItem={(type) => {
                  setEditorCreateModalType(type);
                  setEditorCreateModalOpen(true);
                }}
                onRequestCreateChildPage={handleRequestCreateChildPage}
                onOpenEnvAi={(sel) => {
                  setSelectedEditorText(sel || '');
                  setShowEnvAi(true);
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

            {/* Child Page Creation Dialog (Prompted on /page) */}
            {childPageModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-surface-panel border border-border-muted rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-subtle">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border-muted flex items-center justify-center text-primary">
                        <FilePlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">Create Subpage</h3>
                        <p className="text-[11px] text-text-muted">
                          Nest a new child page directly inside <span className="text-primary font-medium">"{title || 'this page'}"</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChildPageModalOpen(false);
                        childPageCallbackRef.current = null;
                      }}
                      className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-surface-raised transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleConfirmCreateChildPage} className="p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-text-secondary">
                        Subpage Title
                      </label>
                      <input
                        type="text"
                        autoFocus
                        required
                        value={childPageTitle}
                        onChange={(e) => setChildPageTitle(e.target.value)}
                        placeholder="e.g. Test 2"
                        className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-border-muted text-text-primary text-sm focus:outline-none focus:border-border-accent placeholder:text-text-muted transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle/60">
                      <button
                        type="button"
                        onClick={() => {
                          setChildPageModalOpen(false);
                          childPageCallbackRef.current = null;
                        }}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={childPageCreating || !childPageTitle.trim()}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-fg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {childPageCreating ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-primary-fg/30 border-t-primary-fg rounded-full animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <FilePlus className="w-3.5 h-3.5" />
                            <span>Create & Insert</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Sharing & Publishing Modal */}
            <ShareModal
              isOpen={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              pageId={pageId}
              pageTitle={title}
              pageContent={content}
            />
          </div>
        </main>

        {/* envAi Slide-Over Assistant Panel */}
        <EnvAiPanel
          isOpen={showEnvAi}
          onClose={() => setShowEnvAi(false)}
          currentNoteId={pageId}
          currentNoteTitle={title}
          currentNoteContent={content}
          currentNoteType={entry?.type || 'notes_page'}
          selectedText={selectedEditorText}
          onApplyToNote={handleApplyEnvAi}
        />

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
          <div
            className={`w-full ${
              previewSnapshot ? 'max-w-3xl' : 'max-w-xl'
            } bg-surface-elevated border border-border-muted rounded-xl shadow-2xl flex flex-col max-h-[85vh] h-[85vh] overflow-hidden transition-all duration-200`}
          >
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  {previewSnapshot ? 'Snapshot Preview & Changes' : 'Version History Snapshots'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowHistory(false);
                  setPreviewSnapshot(null);
                }}
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-raised transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {previewSnapshot ? (
              <div className="flex-1 overflow-hidden">
                <SnapshotDiffView
                  snapshotDate={previewSnapshot.version.createdAt}
                  snapshotTitle={previewSnapshot.title}
                  snapshotContent={previewSnapshot.content}
                  currentContent={content}
                  onRestore={() => handleRestoreVersion(previewSnapshot.version)}
                  onBack={() => setPreviewSnapshot(null)}
                />
              </div>
            ) : (
              <>
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
                        type="button"
                        onClick={() => handlePreviewSnapshot(ver)}
                        disabled={previewLoadingId === ver.versionId}
                        className="px-2.5 py-1 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary font-label-ui flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="Preview changes in this snapshot"
                      >
                        {previewLoadingId === ver.versionId ? (
                          <span className="w-3.5 h-3.5 border-2 border-accent-emerald/40 border-t-accent-emerald rounded-full animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
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

            <div className="p-3 border-t border-border-subtle bg-surface-subtle flex justify-end shrink-0">
              <button
                onClick={() => {
                  setShowHistory(false);
                  setPreviewSnapshot(null);
                }}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
          </>
        )}
          </div>
        </div>
      )}
    </div>
  );
}
