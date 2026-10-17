'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Folder,
  Database,
  BookOpen,
  X,
  Check,
  AlertCircle,
  FolderPlus,
  Loader2,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import { apiCreateEntry, apiGetEntries } from '@/lib/api';
import { EntryRecord, WorkspaceItemType } from '@envbook/shared';

export interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: WorkspaceItemType;
  initialParentId?: string | null;
  onItemCreated?: (newEntry: EntryRecord) => void;
}

interface ItemTypeOption {
  type: WorkspaceItemType;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const ITEM_TYPES: ItemTypeOption[] = [
  {
    type: 'notes_page',
    title: 'Notes Page',
    badge: 'Page',
    description: 'A standard document for freely formatted inline notes with rich text and slash commands.',
    icon: FileText,
    accentColor: 'text-primary border-border-subtle bg-surface-raised',
  },
  {
    type: 'section',
    title: 'Section',
    badge: 'Container',
    description: 'A structural container used to group and organize child pages and nested sections.',
    icon: Folder,
    accentColor: 'text-primary border-border-subtle bg-surface-raised',
  },
  {
    type: 'environment_page',
    title: 'Environment Page',
    badge: 'Vault',
    description: 'Dedicated page for bulk pasting, managing, and securely encrypting .env variables.',
    icon: Database,
    accentColor: 'text-primary border-border-subtle bg-surface-raised',
  },
  {
    type: 'notes_section',
    title: 'Notes Section',
    badge: 'Collection',
    description: 'A notes-focused container specifically optimized for organizing collections of note pages.',
    icon: BookOpen,
    accentColor: 'text-primary border-border-subtle bg-surface-raised',
  },
];

export function CreateItemModal({
  isOpen,
  onClose,
  initialType = 'notes_page',
  initialParentId = null,
  onItemCreated,
}: CreateItemModalProps) {
  const router = useRouter();
  const vault = useVault();

  const [selectedType, setSelectedType] = useState<WorkspaceItemType>(initialType);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [containers, setContainers] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync initial type / parentId when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType);
      setParentId(initialParentId);
      setTitle('');
      setError(null);
      setIsSubmitting(false);

      // Focus title input on open
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialType, initialParentId]);

  // Load available container destinations (sections & notes sections)
  useEffect(() => {
    if (!isOpen || !vault.isUnlocked) return;

    let mounted = true;
    const fetchContainers = async () => {
      try {
        setLoadingContainers(true);
        const { entries } = await apiGetEntries({ isDeleted: false, isArchived: false });

        // Filter only container types (section, notes_section, or legacy folder)
        const containerEntries = entries.filter(
          (e) => e.type === 'section' || e.type === 'notes_section' || e.type === 'folder'
        );

        const list: Array<{ id: string; title: string; type: string }> = [];
        for (const entry of containerEntries) {
          try {
            const dec: any = await vault.decrypt(entry.encryptedPayload, entry.nonce, entry.entryId);
            list.push({
              id: entry.entryId,
              title: dec?.title || 'Untitled Section',
              type: entry.type,
            });
          } catch {
            list.push({
              id: entry.entryId,
              title: 'Encrypted Section',
              type: entry.type,
            });
          }
        }

        if (mounted) {
          setContainers(list);
        }
      } catch (err) {
        console.error('Failed to load container hierarchy:', err);
      } finally {
        if (mounted) setLoadingContainers(false);
      }
    };

    fetchContainers();
    return () => {
      mounted = false;
    };
  }, [isOpen, vault]);

  // Handle escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title cannot be empty. Please enter an item name.');
      titleInputRef.current?.focus();
      return;
    }

    if (trimmedTitle.length > 120) {
      setError('Title cannot exceed 120 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const entryId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

      // Construct type-specific initial encrypted payload
      let initialPayload: any;
      if (selectedType === 'notes_page') {
        initialPayload = {
          title: trimmedTitle,
          content: `# ${trimmedTitle}\n\nStart writing or type \`/\` for commands...`,
          tags: [],
          updatedAt: new Date().toISOString(),
        };
      } else if (selectedType === 'environment_page') {
        initialPayload = {
          title: trimmedTitle,
          name: 'production',
          variables: [],
          updatedAt: new Date().toISOString(),
        };
      } else {
        // section or notes_section
        initialPayload = {
          title: trimmedTitle,
          tags: [],
          description: selectedType === 'notes_section' ? 'Notes Collection' : 'Workspace Section',
          updatedAt: new Date().toISOString(),
        };
      }

      // Zero-knowledge encryption before transmission
      const { ciphertext, nonce, aad } = await vault.encrypt(initialPayload, entryId);

      const res = await apiCreateEntry({
        entryId,
        parentId: parentId || null,
        type: selectedType,
        encryptedPayload: ciphertext,
        nonce,
        aad,
      });

      if (onItemCreated) {
        onItemCreated(res.entry);
      }

      onClose();

      // Navigate to destination
      if (selectedType === 'notes_page') {
        router.push(`/app/page/${res.entry.entryId}`);
      } else if (selectedType === 'environment_page') {
        router.push(`/app/environments?id=${res.entry.entryId}`);
      } else {
        // container section
        router.push(`/app/folder/${res.entry.entryId}`);
      }
    } catch (err: any) {
      console.error('Failed to create workspace item:', err);
      setError(err?.message || 'Failed to create workspace item. Please check vault unlock status.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-item-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg bg-surface-elevated border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-panel">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-surface-raised border border-border-muted text-primary">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 id="create-item-title" className="text-sm font-semibold text-text-primary tracking-tight">
                Create New Workspace Item
              </h2>
              <p className="text-[11px] font-mono text-text-muted">
                Select item type, name, and hierarchy location
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded flex items-start gap-2 text-status-danger text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-status-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Item Type Selection Grid */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-text-muted uppercase tracking-wider">
              1. Select Item Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ITEM_TYPES.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedType(item.type)}
                    className={`flex flex-col p-3 rounded-lg border text-left transition-all relative ${
                      isSelected
                        ? 'border-primary bg-surface-raised ring-1 ring-primary'
                        : 'border-border-subtle bg-surface-panel hover:border-border-muted hover:bg-surface-raised/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded border ${item.accentColor}`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-text-primary">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-muted">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Title / Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-item-name" className="text-xs font-mono text-text-muted uppercase tracking-wider">
              2. Title / Name
            </label>
            <input
              id="create-item-name"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                selectedType === 'notes_page'
                  ? 'e.g., API Authentication Design'
                  : selectedType === 'environment_page'
                  ? 'e.g., Production Environment (.env)'
                  : selectedType === 'notes_section'
                  ? 'e.g., Architecture Specifications'
                  : 'e.g., Backend Infrastructure'
              }
              maxLength={120}
              className="w-full px-3 py-2 bg-surface-panel border border-border-muted rounded text-sm text-text-primary placeholder:text-text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* 3. Parent Container Location */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-item-parent" className="text-xs font-mono text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>3. Location in Workspace</span>
              {loadingContainers && (
                <span className="text-[10px] text-primary animate-pulse">Loading containers...</span>
              )}
            </label>
            <select
              id="create-item-parent"
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3 py-2 bg-surface-panel border border-border-muted rounded text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-mono"
            >
              <option value="">📁 Workspace Root (Top Level)</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  ↳ {c.type === 'notes_section' ? '📚' : '📂'} {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary rounded border border-border-subtle hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 text-xs font-medium text-surface-canvas bg-primary hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none rounded transition-opacity flex items-center gap-1.5 shadow-xs font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating & Encrypting...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Item</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
