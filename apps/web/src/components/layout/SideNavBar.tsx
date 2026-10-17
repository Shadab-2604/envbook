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
  Smile,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { useTheme } from '@/contexts/ThemeContext';
import { EntryRecord, WorkspaceItemType } from '@envbook/shared';
import { apiGetEntries, apiUpdateEntry, apiDeleteEntry, apiArchiveEntry } from '@/lib/api';
import { useRealTimeEvents } from '@/lib/socket';
import { CreateItemModal } from './CreateItemModal';
import { DocumentEmojiPicker } from '@/components/ui/DocumentEmojiPicker';

interface SideNavBarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenQuickSwitcher?: () => void;
}

interface DecryptedTreeItem {
  entry: EntryRecord;
  title: string;
  icon?: string | null;
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
  const { theme, setTheme } = useTheme();

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

  // Emoji Picker State
  const [emojiPickerItem, setEmojiPickerItem] = useState<DecryptedTreeItem | null>(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ top: number; left: number } | null>(null);

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
          const icon = dec?.icon || entry.icon || null;
          decryptedList.push({ entry, title, icon });
        } catch {
          let fallback = 'Encrypted Item';
          if (entry.type === 'section' || entry.type === 'notes_section' || entry.type === 'folder') fallback = 'Encrypted Section';
          else if (entry.type === 'environment_page' || entry.type === 'environment') fallback = 'Encrypted Environment';
          else fallback = 'Encrypted Note';
          decryptedList.push({ entry, title: fallback, icon: entry.icon || null });
        }
      }

      setTreeItems(decryptedList);
    } catch (err) {
      console.error('[SideNavBar] Failed to load workspace tree:', err);
    } finally {
      setLoadingTree(false);
    }
  }, [isUnlocked, decrypt]);

  const handleUpdateTreeItemIcon = async (item: DecryptedTreeItem, newIcon: string | null) => {
    try {
      const oldDecrypted: any = await decrypt(item.entry.encryptedPayload, item.entry.nonce, item.entry.entryId);
      const newPayload = { ...oldDecrypted, icon: newIcon || undefined, updatedAt: new Date().toISOString() };
      const { ciphertext, nonce } = await encrypt(newPayload, item.entry.entryId);

      await apiUpdateEntry(item.entry.entryId, { encryptedPayload: ciphertext, nonce, icon: newIcon });

      // Update local tree immediately
      setTreeItems((prev) =>
        prev.map((i) =>
          i.entry.entryId === item.entry.entryId
            ? { ...i, icon: newIcon, entry: { ...i.entry, icon: newIcon } }
            : i
        )
      );

      window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
    } catch (err) {
      console.error('[SideNavBar] Failed to update icon:', err);
    }
  };

  useEffect(() => {
    loadWorkspaceTree();
  }, [loadWorkspaceTree]);

  useEffect(() => {
    const handleTreeUpdated = () => {
      loadWorkspaceTree();
    };
    window.addEventListener('envbook:workspace-tree-updated', handleTreeUpdated);
    return () => {
      window.removeEventListener('envbook:workspace-tree-updated', handleTreeUpdated);
    };
  }, [loadWorkspaceTree]);

  // Real-time tree update via WebSockets
  useRealTimeEvents({
    onTreeUpdate: () => {
      loadWorkspaceTree();
    },
  });

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
      setTreeItems((prev) => {
        const toRemove = new Set<string>([entryId]);
        let added = true;
        while (added) {
          added = false;
          for (const item of prev) {
            if (item.entry.parentId && toRemove.has(item.entry.parentId) && !toRemove.has(item.entry.entryId)) {
              toRemove.add(item.entry.entryId);
              added = true;
            }
          }
        }
        return prev.filter((i) => !toRemove.has(i.entry.entryId));
      });
      setActiveMenuId(null);
      window.dispatchEvent(new CustomEvent('envbook:subpage-deleted', { detail: { pageId: entryId } }));
      window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
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
    const children = childrenMap[item.entry.entryId] || [];
    const isContainer =
      item.entry.type === 'section' ||
      item.entry.type === 'notes_section' ||
      item.entry.type === 'folder' ||
      children.length > 0;
    const isExpanded = expandedContainers[item.entry.entryId] ?? true;
    const IconComponent = getItemIcon(item.entry.type);
    const itemHref = getItemHref(item);
    const isActive = pathname.includes(item.entry.entryId);

    return (
      <div key={item.entry.entryId} className="flex flex-col">
        <div
          className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
            isActive
              ? 'bg-surface-elevated text-text-primary border border-border-subtle font-semibold shadow-xs'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary font-normal'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 12 + 8)}px` }}
        >
            {/* Main click target */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {isContainer ? (
                <button
                  type="button"
                  onClick={(e) => toggleContainer(item.entry.entryId, e)}
                  className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover shrink-0 transition-transform"
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

              {/* Document Icon (Clickable Emoji or Default Type Icon) */}
              {item.icon ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setEmojiPickerPosition({
                      top: Math.min(rect.bottom + 4, window.innerHeight - 440),
                      left: Math.max(10, Math.min(rect.left, window.innerWidth - 340)),
                    });
                    setEmojiPickerItem(item);
                  }}
                  className="w-4 h-4 text-xs flex items-center justify-center shrink-0 hover:scale-125 transition-transform cursor-pointer"
                  title="Change document icon"
                  aria-label={`Change icon for ${item.title}`}
                >
                  {item.icon}
                </button>
              ) : (
                <IconComponent className="w-3.5 h-3.5 shrink-0 text-text-muted group-hover:text-primary transition-colors" />
              )}

              <Link
                href={itemHref}
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                }}
                className="truncate flex-1 min-w-0"
                title={item.title}
              >
                {item.title}
              </Link>
            </div>

            {/* Quick Context Actions on Hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
              {isContainer && (
                <button
                  type="button"
                  title="Add inside this section"
                  onClick={(e) => handleOpenCreateModal('notes_page', item.entry.entryId, e)}
                  className="p-1 rounded text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
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
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                  aria-label="Item options"
                >
                  <MoreVertical className="w-3 h-3" />
                </button>

                {/* Context Dropdown */}
                {activeMenuId === item.entry.entryId && (
                  <div
                    className="absolute right-0 top-full mt-1 w-36 bg-surface-panel border border-border-muted rounded-md shadow-xl z-50 py-1 flex flex-col text-[11px] font-sans"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setEmojiPickerPosition({
                          top: Math.min(rect.bottom + 4, window.innerHeight - 440),
                          left: Math.max(10, Math.min(rect.left - 180, window.innerWidth - 340)),
                        });
                        setEmojiPickerItem(item);
                        setActiveMenuId(null);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised text-left"
                    >
                      <Smile className="w-3 h-3 text-primary" />
                      <span>{item.icon ? 'Change Icon' : 'Add Icon'}</span>
                    </button>
                    {item.icon && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateTreeItemIcon(item, null);
                          setActiveMenuId(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-status-danger hover:bg-status-danger/10 text-left"
                      >
                        <Trash2 className="w-3 h-3 text-status-danger" />
                        <span>Remove Icon</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingItem({ id: item.entry.entryId, currentTitle: item.title });
                        setRenameValue(item.title);
                        setActiveMenuId(null);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised text-left border-t border-border-subtle/60"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Rename</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleArchiveItem(item.entry.entryId, e)}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised text-left"
                    >
                      <Archive className="w-3 h-3" />
                      <span>Archive</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(item.entry.entryId, e)}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-status-danger hover:text-destructive hover:bg-status-danger/10 text-left border-t border-border-subtle mt-0.5 font-medium"
                    >
                      <Trash2 className="w-3 h-3 text-status-danger" />
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
        className={`fixed md:static inset-y-0 left-0 w-64 h-screen flex flex-col justify-between p-3 bg-surface-sidebar border-r border-border-subtle shrink-0 select-none z-40 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden flex-1">
          {/* Header & Vault Status & Mobile Close */}
          <div className="flex items-center justify-between px-1 py-1">
            <Link href="/app" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded bg-surface-elevated flex items-center justify-center border border-border-subtle text-primary group-hover:border-primary transition-colors shadow-xs">
                <Terminal className="w-4 h-4 text-primary" />
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

            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative" title="Vault Active">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              {mobileOpen && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="md:hidden p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover ml-1"
                  aria-label="Close navigation drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Switcher Trigger */}
          <div className="mt-1 px-1">
            <button
              type="button"
              onClick={onOpenQuickSwitcher}
              className="flex items-center justify-between w-full px-2.5 py-1.5 bg-surface-elevated border border-border-subtle rounded-md text-text-muted hover:border-border-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-xs shadow-xs"
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
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                pathname === '/app'
                  ? 'bg-surface-elevated text-text-primary border border-border-subtle font-semibold shadow-xs'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary font-normal'
              }`}
            >
              <Home className="w-4 h-4 text-primary" />
              <span>Home Dashboard</span>
            </Link>

            <Link
              href="/app/entries"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                pathname === '/app/entries'
                  ? 'bg-surface-elevated text-text-primary border border-border-subtle font-semibold shadow-xs'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary font-normal'
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
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-panel border border-border-subtle text-[11px] font-mono text-primary hover:bg-surface-raised transition-colors"
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
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
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
                  className="px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm mt-1"
                >
                  <Plus className="w-3.5 h-3.5 text-primary-fg" />
                  <span className="text-primary-fg">Create first page</span>
                </button>
              </div>
            ) : (
              rootItems.map((item) => renderTreeItem(item, 0))
            )}
          </div>
        </div>

        {/* Global Utilities + Theme Toggle + User Status */}
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
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-surface-elevated text-text-primary font-semibold border border-border-subtle shadow-xs'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-primary font-normal'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Theme Mode Segmented Toggle */}
          <div className="mt-2 pt-2 border-t border-border-subtle px-1">
            <div className="flex items-center justify-between bg-surface-panel p-1 rounded border border-border-subtle text-xs">
              <span className="text-[10px] font-mono text-text-muted px-1 uppercase tracking-wider">Theme</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  title="Light Mode"
                  className={`p-1 rounded transition-colors ${
                    theme === 'light'
                      ? 'bg-primary text-surface-canvas font-semibold shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  aria-label="Light mode"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  title="Dark Mode"
                  className={`p-1 rounded transition-colors ${
                    theme === 'dark'
                      ? 'bg-primary text-surface-canvas font-semibold shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  aria-label="Dark mode"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  title="System Preference"
                  className={`p-1 rounded transition-colors ${
                    theme === 'system'
                      ? 'bg-primary text-surface-canvas font-semibold shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  aria-label="System preference"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

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
                className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-surface-panel transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-1.5 rounded text-text-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors"
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
              className="w-full px-3 py-1.5 bg-surface-panel border border-border-muted rounded text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary"
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
                className="px-3 py-1 text-xs font-semibold bg-primary text-surface-canvas rounded hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Tree Emoji Picker Popover */}
      {emojiPickerItem && emojiPickerPosition && (
        <div
          className="fixed z-[100]"
          style={{
            top: `${emojiPickerPosition.top}px`,
            left: `${emojiPickerPosition.left}px`,
          }}
        >
          <DocumentEmojiPicker
            currentIcon={emojiPickerItem.icon}
            onSelect={(emoji) => {
              handleUpdateTreeItemIcon(emojiPickerItem, emoji);
              setEmojiPickerItem(null);
            }}
            onRemove={() => {
              handleUpdateTreeItemIcon(emojiPickerItem, null);
              setEmojiPickerItem(null);
            }}
            onClose={() => {
              setEmojiPickerItem(null);
            }}
          />
        </div>
      )}
    </>
  );
}
