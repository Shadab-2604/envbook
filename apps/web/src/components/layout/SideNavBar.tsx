'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Terminal,
  Search,
  Home,
  FileText,
  Folder,
  Database,
  BookOpen,
  Star,
  Clock,
  Archive,
  Trash2,
  Settings,
  Lock,
  LogOut,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Edit2,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { EntryRecord, WorkspaceItemType } from '@envbook/shared';
import { apiGetEntries, apiUpdateEntry, apiDeleteEntry, apiArchiveEntry } from '@/lib/api';
import { CreateItemModal } from './CreateItemModal';

interface SideNavBarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenQuickSwitcher?: () => void;
}

interface DecryptedTreeItem {
  entry: EntryRecord;
  title: string;
}

export function SideNavBar({
  mobileOpen = false,
  onCloseMobile,
  onOpenQuickSwitcher,
}: SideNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lock, isUnlocked, decrypt, encrypt } = useVault();

  // Workspace Tree State
  const [treeItems, setTreeItems] = useState<DecryptedTreeItem[]>([]);
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({});
  const [loadingTree, setLoadingTree] = useState(false);

  // Creation Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<WorkspaceItemType>('notes_page');
  const [createModalParentId, setCreateModalParentId] = useState<string | null>(null);

  // Inline Rename Modal / Popover State
  const [renamingItem, setRenamingItem] = useState<{ id: string; currentTitle: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Fetch full tree from user's persisted records
  const loadWorkspaceTree = useCallback(async () => {
    if (!isUnlocked) return;

    try {
      setLoadingTree(true);
      const { entries } = await apiGetEntries({ isDeleted: false, isArchived: false });

      const decryptedList: DecryptedTreeItem[] = [];

      for (const entry of entries) {
        try {
          const dec: any = await decrypt(entry.encryptedPayload, entry.nonce, entry.entryId);
          const title = dec?.title || (entry.type.includes('env') ? 'Environment Variables' : 'Untitled');
          decryptedList.push({ entry, title });
        } catch {
          let fallback = 'Encrypted Item';
          if (entry.type === 'section' || entry.type === 'notes_section' || entry.type === 'folder') fallback = 'Encrypted Section';
          else if (entry.type === 'environment_page' || entry.type === 'environment') fallback = 'Encrypted Environment';
          else fallback = 'Encrypted Note';
          decryptedList.push({ entry, title: fallback });
        }
      }

      setTreeItems(decryptedList);
    } catch (err) {
      console.error('[SideNavBar] Failed to load workspace tree:', err);
    } finally {
      setLoadingTree(false);
    }
  }, [isUnlocked, decrypt]);

  useEffect(() => {
    loadWorkspaceTree();
  }, [loadWorkspaceTree]);

  const toggleContainer = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedContainers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenCreateModal = (type: WorkspaceItemType = 'notes_page', parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCreateModalType(type);
    setCreateModalParentId(parentId);
    setCreateModalOpen(true);
  };

  const handleRenameSubmit = async (item: DecryptedTreeItem) => {
    if (!renameValue.trim()) {
      setRenamingItem(null);
      return;
    }

    try {
      // Re-encrypt updated title with existing payload
      const oldDecrypted: any = await decrypt(item.entry.encryptedPayload, item.entry.nonce, item.entry.entryId);
      const newPayload = { ...oldDecrypted, title: renameValue.trim(), updatedAt: new Date().toISOString() };
      const { ciphertext, nonce } = await encrypt(newPayload, item.entry.entryId);

      await apiUpdateEntry(item.entry.entryId, { encryptedPayload: ciphertext, nonce });

      // Update local tree
      setTreeItems((prev) =>
        prev.map((i) =>
          i.entry.entryId === item.entry.entryId ? { ...i, title: renameValue.trim() } : i
        )
      );
      setRenamingItem(null);
      setActiveMenuId(null);
    } catch (err) {
      console.error('[SideNavBar] Rename failed:', err);
    }
  };

  const handleDeleteItem = async (entryId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Move this item to Trash? You can restore it later from Trash.')) return;

    try {
      await apiDeleteEntry(entryId);
      setTreeItems((prev) => prev.filter((i) => i.entry.entryId !== entryId));
      setActiveMenuId(null);
    } catch (err) {
      console.error('[SideNavBar] Delete failed:', err);
    }
  };

  const handleArchiveItem = async (entryId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await apiArchiveEntry(entryId);
      setTreeItems((prev) => prev.filter((i) => i.entry.entryId !== entryId));
      setActiveMenuId(null);
    } catch (err) {
      console.error('[SideNavBar] Archive failed:', err);
    }
  };

  // Helper to determine destination URL for an item
  const getItemHref = (item: DecryptedTreeItem): string => {
    const t = item.entry.type;
    if (t === 'section' || t === 'notes_section' || t === 'folder') {
      return `/app/folder/${item.entry.entryId}`;
    }
    if (t === 'environment_page' || t === 'environment') {
      return `/app/environments?id=${item.entry.entryId}`;
    }
    return `/app/page/${item.entry.entryId}`;
  };

  // Helper to get item icon
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'section':
      case 'folder':
        return Folder;
      case 'notes_section':
        return BookOpen;
      case 'environment_page':
      case 'environment':
        return Database;
      default:
        return FileText;
    }
  };

  // Build tree hierarchy: root items + children by parentId
  const rootItems = treeItems.filter((i) => !i.entry.parentId);
  const childrenMap = treeItems.reduce<Record<string, DecryptedTreeItem[]>>((acc, item) => {
    if (item.entry.parentId) {
      if (!acc[item.entry.parentId]) acc[item.entry.parentId] = [];
      acc[item.entry.parentId].push(item);
    }
    return acc;
  }, {});

  // Recursive tree node renderer
  const renderTreeItem = (item: DecryptedTreeItem, depth = 0) => {
    const isContainer =
      item.entry.type === 'section' ||
      item.entry.type === 'notes_section' ||
      item.entry.type === 'folder';
    const isExpanded = Boolean(expandedContainers[item.entry.entryId]);
    const children = childrenMap[item.entry.entryId] || [];
    const IconComponent = getItemIcon(item.entry.type);
    const itemHref = getItemHref(item);
    const isActive = pathname.includes(item.entry.entryId);

    return (
      <div key={item.entry.entryId} className="flex flex-col">
        <div
          className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isActive
              ? 'bg-surface-raised text-accent-emerald border border-accent-emerald/30'
              : 'text-text-secondary hover:bg-surface-panel hover:text-text-primary'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        >
          {/* Main click target */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isContainer ? (
              <button
                type="button"
                onClick={(e) => toggleContainer(item.entry.entryId, e)}
                className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised shrink-0 transition-transform"
                aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5 h-3.5 shrink-0" />
            )}

            <Link
              href={itemHref}
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex items-center gap-1.5 truncate flex-1"
            >
              <IconComponent
                className={`w-3.5 h-3.5 shrink-0 ${
                  item.entry.type === 'environment_page' || item.entry.type === 'environment'
                    ? 'text-cyan-400'
                    : item.entry.type === 'notes_section'
                    ? 'text-indigo-400'
                    : item.entry.type === 'section' || item.entry.type === 'folder'
                    ? 'text-amber-400'
                    : 'text-text-muted group-hover:text-accent-emerald'
                }`}
              />
              <span className="truncate">{item.title}</span>
            </Link>
          </div>

          {/* Quick Context Actions on Hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
            {isContainer && (
              <button
                type="button"
                title="Add inside this section"
                onClick={(e) => handleOpenCreateModal('notes_page', item.entry.entryId, e)}
                className="p-1 rounded text-text-muted hover:text-accent-emerald hover:bg-surface-raised transition-colors"
                aria-label="Add child item"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === item.entry.entryId ? null : item.entry.entryId);
                }}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
                aria-label="Item options"
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {/* Context Dropdown */}
              {activeMenuId === item.entry.entryId && (
                <div
                  className="absolute right-0 top-full mt-1 w-36 bg-surface-raised border border-border-muted rounded-md shadow-xl z-50 py-1 flex flex-col text-[11px] font-sans"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingItem({ id: item.entry.entryId, currentTitle: item.title });
                      setRenameValue(item.title);
                      setActiveMenuId(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-panel text-left"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Rename</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleArchiveItem(item.entry.entryId, e)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-panel text-left"
                  >
                    <Archive className="w-3 h-3" />
                    <span>Archive</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(item.entry.entryId, e)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 text-left border-t border-border-subtle mt-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Move to Trash</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Render nested children if expanded */}
        {isContainer && isExpanded && children.length > 0 && (
          <div className="flex flex-col">
            {children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const bottomItems = [
    { label: 'Favorites', href: '/app/favorites', icon: Star },
    { label: 'Recently Updated', href: '/app/recents', icon: Clock },
    { label: 'Archived', href: '/app/archive', icon: Archive },
    { label: 'Trash', href: '/app/trash', icon: Trash2 },
    { label: 'Settings', href: '/app/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      {/* Creation Modal for all 4 types */}
      <CreateItemModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialType={createModalType}
        initialParentId={createModalParentId}
        onItemCreated={() => {
          loadWorkspaceTree();
        }}
      />

      <aside
        className={`fixed md:static inset-y-0 left-0 w-64 h-screen flex flex-col justify-between p-3 bg-surface-subtle border-r border-border-subtle shrink-0 select-none z-40 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden flex-1">
          {/* Header & Vault Status */}
          <div className="flex items-center justify-between px-1 py-1">
            <Link href="/app" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded bg-surface-panel flex items-center justify-center border border-border-muted text-primary group-hover:border-accent-emerald transition-colors">
                <Terminal className="w-4 h-4 text-accent-emerald" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-text-primary tracking-tight leading-none">
                  EnvBook
                </span>
                <span className="font-mono text-[10px] text-text-muted mt-0.5 uppercase tracking-wider">
                  Zero-Knowledge Vault
                </span>
              </div>
            </Link>

            <span className="flex h-2 w-2 relative" title="Vault Active">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-emerald opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-emerald" />
            </span>
          </div>

          {/* Quick Switcher Trigger */}
          <div className="mt-1 px-1">
            <button
              type="button"
              onClick={onOpenQuickSwitcher}
              className="flex items-center justify-between w-full px-2.5 py-1.5 bg-surface-panel border border-border-subtle rounded text-text-muted hover:border-border-muted hover:text-text-primary transition-colors text-xs"
            >
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span className="font-sans">Quick open...</span>
              </div>
              <kbd className="font-mono text-[10px] bg-surface-raised border border-border-muted px-1 rounded text-text-muted">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Global Views: Home & All Entries */}
          <div className="flex flex-col gap-0.5 px-1 pt-1">
            <Link
              href="/app"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === '/app'
                  ? 'bg-surface-raised text-accent-emerald border border-accent-emerald/30 font-semibold'
                  : 'text-text-secondary hover:bg-surface-panel hover:text-text-primary'
              }`}
            >
              <Home className="w-4 h-4 text-accent-emerald" />
              <span>Home Dashboard</span>
            </Link>

            <Link
              href="/app/entries"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === '/app/entries'
                  ? 'bg-surface-raised text-accent-emerald border border-accent-emerald/30 font-semibold'
                  : 'text-text-secondary hover:bg-surface-panel hover:text-text-primary'
              }`}
            >
              <FileText className="w-4 h-4 text-text-muted" />
              <span>All Entries</span>
            </Link>
          </div>

          {/* Workspace Tree Header + "+ New" Action */}
          <div className="mt-2 px-1 flex items-center justify-between border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] text-text-muted uppercase tracking-wider font-semibold">
              Workspace Tree
            </span>
            <button
              type="button"
              onClick={() => handleOpenCreateModal('notes_page', null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-raised border border-border-muted text-[11px] font-mono text-accent-emerald hover:border-accent-emerald hover:bg-surface-panel transition-colors"
              title="Create new page, section, or environment"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>
          </div>

          {/* Dynamic User-Defined Tree List */}
          <div className="flex-1 overflow-y-auto custom-scroll px-1 flex flex-col gap-0.5 min-h-0">
            {loadingTree && treeItems.length === 0 ? (
              <div className="py-6 flex items-center justify-center gap-2 text-text-muted text-xs font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-emerald" />
                <span>Loading workspace...</span>
              </div>
            ) : rootItems.length === 0 ? (
              /* Empty state with clear call to action */
              <div className="py-8 px-2 text-center flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-border-muted bg-surface-panel/50 my-2">
                <div className="p-2 rounded-full bg-surface-raised text-text-muted">
                  <Folder className="w-4 h-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-text-primary">Workspace is empty</span>
                  <span className="text-[11px] text-text-muted">Create pages or sections to start organizing</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('notes_page', null)}
                  className="px-3 py-1.5 rounded bg-accent-emerald text-black text-xs font-semibold hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create first page</span>
                </button>
              </div>
            ) : (
              rootItems.map((item) => renderTreeItem(item, 0))
            )}
          </div>
        </div>

        {/* Global Utilities (Separated clearly at bottom) */}
        <div className="flex flex-col gap-0.5 border-t border-border-subtle pt-2 px-1 shrink-0 mt-2">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-panel text-accent-emerald font-semibold'
                    : 'text-text-muted hover:bg-surface-panel hover:text-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* User Vault Status & Lock / Signout */}
          <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between">
            <div className="flex flex-col truncate pr-2">
              <span className="text-xs font-medium text-text-primary truncate">{user?.name || 'Operator'}</span>
              <span className="font-mono text-[10px] text-text-muted truncate">@{user?.username || 'vault'}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={lock}
                title="Lock Vault"
                aria-label="Lock Vault"
                className="p-1.5 rounded text-text-muted hover:text-amber-400 hover:bg-surface-panel transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-surface-panel transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Inline Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface-subtle border border-border-muted rounded-lg shadow-xl p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold text-text-primary">Rename Item</span>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const it = treeItems.find((i) => i.entry.entryId === renamingItem.id);
                  if (it) handleRenameSubmit(it);
                } else if (e.key === 'Escape') {
                  setRenamingItem(null);
                }
              }}
              className="w-full px-3 py-1.5 bg-surface-panel border border-border-muted rounded text-xs text-text-primary focus:border-accent-emerald focus:ring-1 focus:ring-accent-emerald"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary rounded border border-border-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = treeItems.find((i) => i.entry.entryId === renamingItem.id);
                  if (it) handleRenameSubmit(it);
                }}
                className="px-3 py-1 text-xs font-semibold bg-accent-emerald text-black rounded hover:bg-emerald-400"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
