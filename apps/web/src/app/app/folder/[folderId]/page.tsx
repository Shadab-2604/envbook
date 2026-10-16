'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Folder,
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  FolderPlus,
  FilePlus,
  MoreVertical,
  Star,
  Archive,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntryById,
  apiGetEntries,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedNotePayload } from '@envbook/shared';

export default function FolderPage() {
  const params = useParams();
  const folderId = params?.folderId as string;
  const router = useRouter();
  const vault = useVault();

  const [loading, setLoading] = useState(true);
  const [folderRecord, setFolderRecord] = useState<EntryRecord | null>(null);
  const [folderTitle, setFolderTitle] = useState('Folder');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [children, setChildren] = useState<Array<{ record: EntryRecord; title: string }>>([]);
  const [creatingType, setCreatingType] = useState<'page' | 'folder' | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

  const loadFolder = useCallback(async () => {
    if (!folderId || !vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntryById(folderId);
      setFolderRecord(res.entry);

      const decrypted = await vault.decrypt<DecryptedNotePayload>(
        res.entry.encryptedPayload,
        res.entry.nonce,
        res.entry.entryId
      );
      setFolderTitle(decrypted.title || 'Untitled Folder');
      setEditTitleValue(decrypted.title || 'Untitled Folder');

      // Load children
      const childrenRes = await apiGetEntries({ parentId: folderId, isDeleted: false });
      const decryptedChildren = await Promise.all(
        childrenRes.entries.map(async (rec) => {
          try {
            const dec = await vault.decrypt<DecryptedNotePayload>(
              rec.encryptedPayload,
              rec.nonce,
              rec.entryId
            );
            return { record: rec, title: dec.title || 'Untitled' };
          } catch (e) {
            return { record: rec, title: 'Encrypted Entry' };
          }
        })
      );
      setChildren(decryptedChildren);
    } catch (err) {
      console.error('Error loading folder:', err);
    } finally {
      setLoading(false);
    }
  }, [folderId, vault]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  const handleSaveTitle = async () => {
    if (!folderRecord || !vault.isUnlocked || !editTitleValue.trim()) return;
    try {
      const payload: DecryptedNotePayload = {
        title: editTitleValue.trim(),
        content: '',
        updatedAt: new Date().toISOString(),
      };
      const { ciphertext, nonce } = await vault.encrypt(payload, folderRecord.entryId);
      await apiUpdateEntry(folderRecord.entryId, { encryptedPayload: ciphertext, nonce });
      setFolderTitle(editTitleValue.trim());
      setIsEditingTitle(false);
    } catch (err: any) {
      alert(`Failed to rename folder: ${err.message}`);
    }
  };

  const handleCreateChild = async () => {
    if (!creatingType || !newItemTitle.trim() || !vault.isUnlocked) return;

    try {
      const entryId = crypto.randomUUID();
      const payload: DecryptedNotePayload = {
        title: newItemTitle.trim(),
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
      };
      const { ciphertext, nonce } = await vault.encrypt(payload, entryId);

      const res = await apiCreateEntry({
        entryId,
        type: creatingType === 'folder' ? 'folder' : 'page',
        parentId: folderId,
        encryptedPayload: ciphertext,
        nonce,
        sortOrder: children.length,
      });

      setNewItemTitle('');
      setCreatingType(null);

      if (creatingType === 'folder') {
        await loadFolder();
      } else {
        router.push(`/app/page/${res.entry.entryId}`);
      }
    } catch (err: any) {
      alert(`Failed to create item: ${err.message}`);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderRecord) return;
    if (confirm('Delete this folder and move its contents to trash?')) {
      await apiDeleteEntry(folderRecord.entryId);
      router.push('/app');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-surface-canvas text-text-muted font-label-mono text-xs">
        <span className="w-2 h-2 rounded-full bg-accent-emerald animate-ping mr-2" />
        Loading folder contents...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas">
      {/* Top Header */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-secondary text-xs font-label-mono">Folders</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-status-warning" />
            {folderTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreatingType('page')}
            className="px-2.5 py-1 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
            New Page
          </button>
          <button
            onClick={() => setCreatingType('folder')}
            className="px-2.5 py-1 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary text-xs flex items-center gap-1 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Subfolder
          </button>
          <button
            onClick={handleDeleteFolder}
            className="p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-status-danger transition-colors"
            title="Delete Folder"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full mono-scroll">
        {/* Folder Header */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-panel border border-border-subtle flex items-center justify-center text-status-warning">
              <Folder className="w-6 h-6" />
            </div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  className="bg-surface-panel border border-border-accent rounded px-2 py-1 text-xl font-bold text-text-primary focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1.5 rounded bg-surface-raised text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-text-primary">{folderTitle}</h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-text-muted hover:text-text-primary"
                  title="Rename folder"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <span className="text-xs font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-2 py-1 rounded">
            {children.length} {children.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Inline Creation Card */}
        {creatingType && (
          <div className="mb-6 p-4 rounded-lg bg-surface-panel border border-border-accent flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              {creatingType === 'folder' ? (
                <Folder className="w-4 h-4 text-status-warning" />
              ) : (
                <FileText className="w-4 h-4 text-primary" />
              )}
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChild();
                  if (e.key === 'Escape') setCreatingType(null);
                }}
                placeholder={`Name for new ${creatingType}...`}
                className="flex-1 bg-surface border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateChild}
                className="px-3 py-1 rounded bg-primary-container text-on-primary-container text-xs font-semibold"
              >
                Create
              </button>
              <button
                onClick={() => setCreatingType(null)}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Children Grid */}
        {children.length === 0 && !creatingType ? (
          <div className="text-center py-12 border border-dashed border-border-subtle rounded-lg">
            <Folder className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-xs text-text-muted font-label-mono mb-3">This folder is currently empty.</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCreatingType('page')}
                className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-xs text-text-secondary flex items-center gap-1.5"
              >
                <FilePlus className="w-3.5 h-3.5 text-primary" />
                Add Page
              </button>
              <button
                onClick={() => setCreatingType('folder')}
                className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-xs text-text-secondary flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5 text-status-warning" />
                Add Subfolder
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {children.map(({ record, title }) => (
              <Link
                key={record.entryId}
                href={record.type === 'folder' ? `/app/folder/${record.entryId}` : `/app/page/${record.entryId}`}
                className="p-3 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted hover:bg-surface-raised transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  {record.type === 'folder' ? (
                    <Folder className="w-4 h-4 text-status-warning shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <span className="text-xs font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                    {title}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
