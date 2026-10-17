'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  Key,
  Database,
  Lightbulb,
  Folder,
  Code,
  Lock,
  Plus,
  Download,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import { apiGetEntries } from '@/lib/api';
import { SLASH_COMMANDS } from '@envbook/shared';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Pages' | 'Credentials' | 'Actions' | 'Slash Commands';
  icon: any;
  action: () => void;
}

export function QuickSwitcherModal({ isOpen, onClose }: QuickSwitcherProps) {
  const router = useRouter();
  const { isUnlocked, lock, decrypt } = useVault();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Load and decrypt searchable records
  useEffect(() => {
    if (!isOpen || !isUnlocked) return;

    let mounted = true;

    const loadRecords = async () => {
      const searchItems: SearchItem[] = [
        // Quick Actions
        {
          id: 'action-new-page',
          title: 'Create New Page',
          subtitle: 'Open blank document',
          category: 'Actions',
          icon: Plus,
          action: () => {
            onClose();
            router.push('/app/entries');
          },
        },
        {
          id: 'action-new-credential',
          title: 'Add New Credential',
          subtitle: 'Store AES-256 encrypted secret',
          category: 'Actions',
          icon: Key,
          action: () => {
            onClose();
            router.push('/app/credentials');
          },
        },
        {
          id: 'action-new-idea',
          title: 'Quick Capture Idea',
          subtitle: 'Jump to Ideas inbox',
          category: 'Actions',
          icon: Lightbulb,
          action: () => {
            onClose();
            router.push('/app/ideas');
          },
        },
        {
          id: 'action-lock',
          title: 'Lock Vault',
          subtitle: 'Wipe in-memory keys and lock session',
          category: 'Actions',
          icon: Lock,
          action: () => {
            onClose();
            lock();
          },
        },
        {
          id: 'action-settings',
          title: 'Vault Settings & Backup',
          subtitle: 'Manage recovery keys and backups',
          category: 'Actions',
          icon: Settings,
          action: () => {
            onClose();
            router.push('/app/settings');
          },
        },
      ];

      // Add common slash commands to quick switcher
      for (const cmd of SLASH_COMMANDS.slice(0, 15)) {
        searchItems.push({
          id: `cmd-${cmd.id}`,
          title: cmd.label,
          subtitle: `${cmd.command} — ${cmd.description}`,
          category: 'Slash Commands',
          icon: Code,
          action: () => {
            onClose();
            router.push('/app/entries');
          },
        });
      }

      // Fetch active entries and decrypt titles in-memory
      try {
        const { entries } = await apiGetEntries({ isDeleted: false, isArchived: false });
        for (const entry of entries) {
          try {
            const payload: any = await decrypt(entry.encryptedPayload, entry.nonce, entry.entryId);
            const title = payload?.title || 'Untitled';
            const icon =
              entry.type === 'credential'
                ? Key
                : entry.type === 'environment'
                ? Database
                : entry.type === 'idea'
                ? Lightbulb
                : entry.type === 'folder'
                ? Folder
                : FileText;

            const targetUrl =
              entry.type === 'credential'
                ? '/app/credentials'
                : entry.type === 'environment'
                ? '/app/environments'
                : entry.type === 'idea'
                ? '/app/ideas'
                : `/app/page/${entry.entryId}`;

            searchItems.push({
              id: entry.entryId,
              title,
              subtitle: `${entry.type.toUpperCase()} • Last updated`,
              category: entry.type === 'credential' ? 'Credentials' : 'Pages',
              icon,
              action: () => {
                onClose();
                router.push(targetUrl);
              },
            });
          } catch {
            // Ignore corrupted or un-decryptable records
          }
        }
      } catch (err) {
        console.error('Failed to load switcher entries:', err);
      }

      if (mounted) {
        setItems(searchItems);
      }
    };

    loadRecords();
    return () => {
      mounted = false;
    };
  }, [isOpen, isUnlocked, decrypt, lock, onClose, router]);

  if (!isOpen) return null;

  const filteredItems = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-xl bg-surface-elevated border border-border-muted rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-surface-subtle">
          <Search className="w-5 h-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page title, or secret key..."
            className="w-full bg-transparent border-0 text-text-primary placeholder:text-text-muted focus:ring-0 focus:outline-none text-sm font-sans"
          />
          <kbd className="font-mono text-[10px] bg-surface-raised border border-border-muted px-1.5 py-0.5 rounded text-text-muted">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto custom-scroll p-1.5 flex flex-col gap-0.5">
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-surface-raised text-text-primary border-l-2 border-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-panel'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-primary' : 'text-text-muted'
                    }`}
                  />
                  <div className="flex flex-col truncate">
                    <span className="font-medium text-text-primary truncate">{item.title}</span>
                    <span className="font-mono text-[10px] text-text-muted truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />
                )}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="py-8 text-center text-text-muted text-xs">
              No matching entries or commands found for &quot;{query}&quot;.
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-3 py-2 border-t border-border-subtle bg-surface-subtle flex items-center justify-between font-mono text-[10px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              Navigate <strong className="text-text-primary">↑↓</strong>
            </span>
            <span>
              Select <strong className="text-text-primary">Enter</strong>
            </span>
            <span>
              Close <strong className="text-text-primary">Esc</strong>
            </span>
          </div>
          <span className="text-primary font-mono">Zero-Knowledge In-Memory Index</span>
        </div>
      </div>
    </div>
  );
}
