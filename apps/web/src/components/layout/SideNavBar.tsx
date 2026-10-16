'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Terminal,
  Search,
  Home,
  FileText,
  Folder,
  Key,
  Database,
  Lightbulb,
  Code,
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
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { EntryRecord } from '@envbook/shared';
import { apiGetEntries, apiCreateEntry } from '@/lib/api';
import { randomUUID } from 'crypto';

interface SideNavBarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenQuickSwitcher?: () => void;
}

export function SideNavBar({
  mobileOpen = false,
  onCloseMobile,
  onOpenQuickSwitcher,
}: SideNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lock, isUnlocked, encrypt, decrypt } = useVault();

  const [folders, setFolders] = useState<Array<{ entry: EntryRecord; title: string }>>([]);
  const [pages, setPages] = useState<Array<{ entry: EntryRecord; title: string }>>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loadingTree, setLoadingTree] = useState(false);

  // Fetch folder and page tree when vault is unlocked
  useEffect(() => {
    if (!isUnlocked) return;

    let mounted = true;
    const fetchTree = async () => {
      try {
        setLoadingTree(true);
        const { entries } = await apiGetEntries({ isDeleted: false, isArchived: false });

        const folderItems: Array<{ entry: EntryRecord; title: string }> = [];
        const pageItems: Array<{ entry: EntryRecord; title: string }> = [];

        for (const entry of entries) {
          try {
            const decrypted: any = await decrypt(entry.encryptedPayload, entry.nonce, entry.entryId);
            const title = decrypted?.title || 'Untitled';
            if (entry.type === 'folder') {
              folderItems.push({ entry, title });
            } else if (entry.type === 'page' || entry.type === 'document') {
              pageItems.push({ entry, title });
            }
          } catch {
            if (entry.type === 'folder') folderItems.push({ entry, title: 'Encrypted Folder' });
            else if (entry.type === 'page' || entry.type === 'document') {
              pageItems.push({ entry, title: 'Encrypted Note' });
            }
          }
        }

        if (mounted) {
          setFolders(folderItems);
          setPages(pageItems);
        }
      } catch (err) {
        console.error('Failed to load navigation tree:', err);
      } finally {
        if (mounted) setLoadingTree(false);
      }
    };

    fetchTree();
    return () => {
      mounted = false;
    };
  }, [isUnlocked, decrypt]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateNewPage = async (parentId: string | null = null) => {
    if (!isUnlocked) return;
    const entryId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const { ciphertext, nonce, aad } = await encrypt(
      {
        title: 'Untitled Note',
        content: '# Untitled Note\n\nType `/` to insert formatted blocks or start writing in Markdown...',
        tags: [],
      },
      entryId
    );

    const res = await apiCreateEntry({
      entryId,
      parentId,
      type: 'page',
      encryptedPayload: ciphertext,
      nonce,
      aad,
    });

    router.push(`/app/page/${res.entry.entryId}`);
    if (onCloseMobile) onCloseMobile();
  };

  const handleCreateNewFolder = async (parentId: string | null = null) => {
    if (!isUnlocked) return;
    const entryId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const { ciphertext, nonce, aad } = await encrypt(
      {
        title: 'New Folder',
        tags: [],
      },
      entryId
    );

    await apiCreateEntry({
      entryId,
      parentId,
      type: 'folder',
      encryptedPayload: ciphertext,
      nonce,
      aad,
    });

    // Refresh tree
    const { entries } = await apiGetEntries({ isDeleted: false, isArchived: false });
    const folderItems: Array<{ entry: EntryRecord; title: string }> = [];
    for (const e of entries.filter((x) => x.type === 'folder')) {
      try {
        const d: any = await decrypt(e.encryptedPayload, e.nonce, e.entryId);
        folderItems.push({ entry: e, title: d?.title || 'Folder' });
      } catch {
        folderItems.push({ entry: e, title: 'Folder' });
      }
    }
    setFolders(folderItems);
  };

  const navItems = [
    { label: 'Home', href: '/app', icon: Home },
    { label: 'All Entries', href: '/app/entries', icon: FileText },
    { label: 'Projects', href: '/app/projects', icon: Folder },
    { label: 'Credentials Vault', href: '/app/credentials', icon: Key },
    { label: 'Environments', href: '/app/environments', icon: Database },
    { label: 'Ideas Inbox', href: '/app/ideas', icon: Lightbulb },
    { label: 'Code Library', href: '/app/snippets', icon: Code },
  ];

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

      <aside
        className={`fixed md:static inset-y-0 left-0 w-60 h-screen flex flex-col justify-between p-3 bg-surface-subtle border-r border-border-subtle shrink-0 select-none z-40 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
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
                  Encrypted Vault
                </span>
              </div>
            </Link>

            <span className="flex h-2 w-2 relative">
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

          {/* Primary Navigation Links */}
          <nav className="flex flex-col gap-0.5 mt-2">
            <div className="px-2 py-0.5 font-mono text-[10px] text-text-muted uppercase tracking-wider">
              Workspace
            </div>
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors duration-150 ${
                    active
                      ? 'text-text-primary bg-surface-raised border-l-2 border-primary font-medium'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : ''}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Folder & Notes Tree */}
          <div className="flex-1 flex flex-col min-h-0 mt-2 border-t border-border-subtle pt-2 overflow-hidden">
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                Pages & Folders
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCreateNewFolder(null)}
                  title="New Folder"
                  className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-raised rounded"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNewPage(null)}
                  title="New Page"
                  className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-raised rounded"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll pr-1 flex flex-col gap-0.5 text-xs">
              {/* Root Folders */}
              {folders
                .filter((f) => !f.entry.parentId)
                .map((folder) => {
                  const isExpanded = expandedFolders[folder.entry.entryId];
                  const childPages = pages.filter((p) => p.entry.parentId === folder.entry.entryId);

                  return (
                    <div key={folder.entry.entryId} className="flex flex-col">
                      <div className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-surface-raised text-text-muted hover:text-text-primary group">
                        <div
                          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleFolder(folder.entry.entryId)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <Folder className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                          <span className="truncate">{folder.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCreateNewPage(folder.entry.entryId)}
                          title="Add page inside folder"
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-accent-emerald transition-opacity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Nested child pages */}
                      {isExpanded && (
                        <div className="pl-4 flex flex-col gap-0.5 border-l border-border-subtle ml-3 mt-0.5">
                          {childPages.map((child) => {
                            const isPageActive = pathname === `/app/page/${child.entry.entryId}`;
                            return (
                              <Link
                                key={child.entry.entryId}
                                href={`/app/page/${child.entry.entryId}`}
                                onClick={onCloseMobile}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs truncate ${
                                  isPageActive
                                    ? 'bg-surface-raised text-primary font-medium'
                                    : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
                                }`}
                              >
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="truncate">{child.title}</span>
                              </Link>
                            );
                          })}
                          {childPages.length === 0 && (
                            <span className="px-2 py-1 text-[11px] text-text-muted/60 italic">
                              Empty folder
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Root Pages */}
              {pages
                .filter((p) => !p.entry.parentId)
                .map((page) => {
                  const isPageActive = pathname === `/app/page/${page.entry.entryId}`;
                  return (
                    <Link
                      key={page.entry.entryId}
                      href={`/app/page/${page.entry.entryId}`}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs truncate ${
                        isPageActive
                          ? 'bg-surface-raised text-primary font-medium'
                          : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{page.title}</span>
                    </Link>
                  );
                })}

              {folders.length === 0 && pages.length === 0 && (
                <div className="px-2 py-4 text-center text-text-muted text-[11px]">
                  No pages yet. Click <Plus className="inline w-3 h-3" /> to create one.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions & Lock Vault */}
        <div className="flex flex-col gap-1 border-t border-border-subtle pt-2 shrink-0">
          {bottomItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors duration-150 ${
                  active
                    ? 'text-text-primary bg-surface-raised font-medium'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-panel'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs text-text-muted hover:text-status-danger hover:bg-surface-panel transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out ({user?.username})</span>
          </button>

          {/* Lock Vault CTA Button */}
          <button
            type="button"
            onClick={lock}
            className="mt-1 flex items-center justify-between w-full px-2.5 py-1.5 bg-surface-container border border-border-muted rounded text-text-secondary hover:border-status-danger hover:text-status-danger transition-colors cursor-pointer text-left text-xs"
          >
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-medium font-sans">Lock Vault</span>
            </div>
            <kbd className="font-mono text-[10px] text-text-muted">Esc</kbd>
          </button>
        </div>
      </aside>
    </>
  );
}
