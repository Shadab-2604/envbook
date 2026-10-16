'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Folder,
  Key,
  Terminal,
  Lightbulb,
  Code,
  Search,
  Star,
  Trash2,
  Archive,
  ArrowUpDown,
  Filter,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiDeleteEntry,
  apiArchiveEntry,
  apiUpdateEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedNotePayload } from '@envbook/shared';

interface UnifiedEntry {
  record: EntryRecord;
  title: string;
  tags: string[];
}

export default function AllEntriesPage() {
  const vault = useVault();
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadEntries = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isDeleted: false, isArchived: false });
      const decryptedList: UnifiedEntry[] = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<any>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );
          decryptedList.push({
            record: rec,
            title: payload.title || payload.name || 'Untitled',
            tags: payload.tags || [],
          });
        } catch (err) {
          decryptedList.push({
            record: rec,
            title: 'Encrypted Entry',
            tags: [],
          });
        }
      }

      setEntries(decryptedList);
    } catch (err) {
      console.error('Failed to load all entries:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleToggleFavorite = async (item: UnifiedEntry) => {
    try {
      const next = !item.record.isFavorite;
      await apiUpdateEntry(item.record.entryId, { isFavorite: next });
      setEntries((prev) =>
        prev.map((e) =>
          e.record.entryId === item.record.entryId
            ? { ...e, record: { ...e.record, isFavorite: next } }
            : e
        )
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this entry?')) return;
    try {
      await apiArchiveEntry(id);
      await loadEntries();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Move this entry to Trash?')) return;
    try {
      await apiDeleteEntry(id);
      await loadEntries();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="w-4 h-4 text-status-warning" />;
      case 'credential':
        return <Key className="w-4 h-4 text-primary" />;
      case 'environment':
        return <Terminal className="w-4 h-4 text-accent-emerald-bright" />;
      case 'idea':
        return <Lightbulb className="w-4 h-4 text-primary" />;
      case 'snippet':
        return <Code className="w-4 h-4 text-secondary" />;
      default:
        return <FileText className="w-4 h-4 text-text-primary" />;
    }
  };

  const getEntryHref = (item: UnifiedEntry) => {
    switch (item.record.type) {
      case 'folder':
        return `/app/folder/${item.record.entryId}`;
      case 'credential':
        return '/app/credentials';
      case 'environment':
        return '/app/environments';
      case 'idea':
        return '/app/ideas';
      case 'snippet':
        return '/app/snippets';
      default:
        return `/app/page/${item.record.entryId}`;
    }
  };

  const filteredEntries = entries
    .filter((item) => {
      const matchesType = typeFilter === 'ALL' || item.record.type === typeFilter;
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'title') {
        const cmp = a.title.localeCompare(b.title);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      const dateA = new Date(a.record[sortBy]).getTime();
      const dateB = new Date(b.record[sortBy]).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Top Header */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-secondary text-xs font-label-mono">Workspace</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            All Entries
          </span>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {entries.length} records
          </span>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="h-11 px-4 bg-surface-subtle border-b border-border-subtle flex items-center justify-between shrink-0 gap-3">
        {/* Type pills */}
        <div className="flex items-center gap-1 overflow-x-auto mono-scroll py-1">
          {['ALL', 'page', 'folder', 'credential', 'environment', 'idea', 'snippet'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded text-xs font-label-ui transition-colors ${
                typeFilter === t
                  ? 'bg-surface-raised text-text-primary border border-border-muted font-medium'
                  : 'bg-surface hover:bg-surface-panel text-text-muted hover:text-text-primary border border-border-subtle'
              }`}
            >
              {t === 'ALL' ? 'All' : `${t.charAt(0).toUpperCase() + t.slice(1)}s`}
            </button>
          ))}
        </div>

        {/* Sort & Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (sortBy === 'updatedAt') {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('updatedAt');
                setSortOrder('desc');
              }
            }}
            className="px-2 py-1 rounded bg-surface-panel border border-border-subtle text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span className="font-label-mono text-[11px]">Updated {sortOrder}</span>
          </button>

          <div className="relative w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all entries..."
              className="w-full bg-surface-panel border border-border-subtle rounded pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full mono-scroll">
        <div className="rounded-lg bg-surface-panel border border-border-subtle overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-xs text-text-muted font-label-mono">
              Decrypting workspace directory...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-16">
              <Layers className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs text-text-muted font-label-mono">No entries found matching filters.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs font-body-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface text-text-muted font-label-mono">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Title / Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Tags</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredEntries.map((item) => (
                  <tr key={item.record.entryId} className="hover:bg-surface-raised/40 transition-colors group">
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleFavorite(item)}
                        className={`text-text-muted hover:text-status-warning ${
                          item.record.isFavorite ? 'text-status-warning' : ''
                        }`}
                        title={item.record.isFavorite ? 'Unfavorite' : 'Favorite'}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </td>

                    <td className="p-3">
                      <Link
                        href={getEntryHref(item)}
                        className="flex items-center gap-2 font-medium text-text-primary hover:text-primary transition-colors"
                      >
                        {getTypeIcon(item.record.type)}
                        <span className="truncate max-w-sm">{item.title}</span>
                      </Link>
                    </td>

                    <td className="p-3">
                      <span className="text-[10px] font-label-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-muted">
                        {item.record.type}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-[10px] font-label-mono text-text-muted"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3 font-label-mono text-text-muted text-[11px]">
                      {new Date(item.record.updatedAt).toLocaleDateString()}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleArchive(item.record.entryId)}
                          className="p-1 text-text-muted hover:text-text-primary"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.record.entryId)}
                          className="p-1 text-text-muted hover:text-status-danger"
                          title="Delete to Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
