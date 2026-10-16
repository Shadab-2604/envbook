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
  Database,
  BookOpen,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntryById,
  apiGetEntries,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedNotePayload, WorkspaceItemType } from '@envbook/shared';
import { CreateItemModal } from '@/components/layout/CreateItemModal';

export default function FolderPage() {
  const params = useParams();
  const folderId = params?.folderId as string;
  const router = useRouter();
  const vault = useVault();

  const [loading, setLoading] = useState(true);
  const [folderRecord, setFolderRecord] = useState<EntryRecord | null>(null);
  const [folderTitle, setFolderTitle] = useState('Section');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [children, setChildren] = useState<Array<{ record: EntryRecord; title: string }>>([]);

  // Create Item Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<WorkspaceItemType>('notes_page');

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
      setFolderTitle(decrypted.title || 'Untitled Section');
      setEditTitleValue(decrypted.title || 'Untitled Section');

      // Load children
      const childrenRes = await apiGetEntries({ parentId: folderId, isDeleted: false });
      const decryptedChildren = await Promise.all(
        childrenRes.entries.map(async (rec) => {
          try {
            const dec = await vault.decrypt<any>(
              rec.encryptedPayload,
              rec.nonce,
              rec.entryId
            );
            return { record: rec, title: dec.title || (rec.type.includes('env') ? 'Environment Variables' : 'Untitled') };
          } catch (e) {
            return { record: rec, title: 'Encrypted Entry' };
          }
        })
      );
      setChildren(decryptedChildren);
    } catch (err) {
      console.error('Error loading section:', err);
    } finally {
      setLoading(false);
    }
  }, [folderId, vault]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  useEffect(() => {
    document.title = `${folderTitle} — EnvBook`;
  }, [folderTitle]);

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
    } catch (err) {
      console.error('Failed to update section title:', err);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderRecord) return;
    if (confirm('Move this section and all contained items to Trash?')) {
      try {
        await apiDeleteEntry(folderRecord.entryId);
        router.push('/app');
      } catch (err) {
        console.error('Failed to delete section:', err);
      }
    }
  };

  const getChildHref = (rec: EntryRecord) => {
    if (rec.type === 'section' || rec.type === 'notes_section' || rec.type === 'folder') {
      return `/app/folder/${rec.entryId}`;
    }
    if (rec.type === 'environment_page' || rec.type === 'environment') {
      return `/app/environments?id=${rec.entryId}`;
    }
    return `/app/page/${rec.entryId}`;
  };

  const getChildIcon = (type: string) => {
    switch (type) {
      case 'section':
      case 'folder':
        return <Folder className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'notes_section':
        return <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'environment_page':
      case 'environment':
        return <Database className="w-4 h-4 text-cyan-400 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-accent-emerald shrink-0" />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-surface-canvas text-text-muted font-mono text-xs">
        <span className="w-2 h-2 rounded-full bg-accent-emerald animate-ping mr-2" />
        Loading section contents...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas">
      {/* Creation Modal */}
      <CreateItemModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialType={createModalType}
        initialParentId={folderId}
        onItemCreated={() => {
          loadFolder();
        }}
      />

      {/* Top Header */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-mono">
            EnvBook
          </Link>
          <span className="text-text-muted font-mono text-xs">/</span>
          <span className="text-text-secondary text-xs font-mono">Sections</span>
          <span className="text-text-muted font-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            {folderTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCreateModalType('notes_page');
              setCreateModalOpen(true);
            }}
            className="px-2.5 py-1 rounded bg-accent-emerald text-black hover:bg-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
          <button
            onClick={handleDeleteFolder}
            className="p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-red-400 transition-colors"
            title="Delete Section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full custom-scroll">
        {/* Section Header Banner */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-panel border border-border-subtle flex items-center justify-center text-amber-400">
              <Folder className="w-6 h-6" />
            </div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  className="bg-surface-panel border border-accent-emerald rounded px-2.5 py-1 text-xl font-bold text-text-primary focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1.5 rounded bg-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/30"
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
                  title="Rename section"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <span className="text-xs font-mono text-text-muted bg-surface-panel border border-border-subtle px-2 py-1 rounded">
            {children.length} {children.length === 1 ? 'child item' : 'child items'}
          </span>
        </div>

        {/* Children Grid */}
        {children.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border-subtle rounded-xl bg-surface-panel/40">
            <Folder className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-xs text-text-muted font-mono mb-4">This section has no child pages or folders yet.</p>
            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => {
                  setCreateModalType('notes_page');
                  setCreateModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded bg-accent-emerald text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Page
              </button>
              <button
                onClick={() => {
                  setCreateModalType('section');
                  setCreateModalOpen(true);
                }}
                className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-xs text-text-secondary flex items-center gap-1.5 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                Add Nested Section
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {children.map(({ record, title }) => (
              <Link
                key={record.entryId}
                href={getChildHref(record)}
                className="p-3.5 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted hover:bg-surface-raised transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-2.5 truncate">
                  {getChildIcon(record.type)}
                  <span className="text-xs font-medium text-text-primary group-hover:text-accent-emerald transition-colors truncate">
                    {title}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
