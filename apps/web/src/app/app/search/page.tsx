'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  FileText,
  Folder,
  Key,
  Terminal,
  Lightbulb,
  Code,
  Tag,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import { apiGetEntries } from '@/lib/api';
import { EntryRecord } from '@envbook/shared';

interface SearchResultItem {
  record: EntryRecord;
  title: string;
  snippet?: string;
  tags: string[];
  type: string;
}

export default function GlobalSearchPage() {
  const vault = useVault();
  const [query, setQuery] = useState('');
  const [allDecrypted, setAllDecrypted] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  const loadAndDecryptAll = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isDeleted: false });
      const items: SearchResultItem[] = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<any>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );

          let snippet = '';
          if (payload.content) snippet = payload.content.slice(0, 200);
          else if (payload.value) snippet = '•'.repeat(16);
          else if (payload.description) snippet = payload.description;

          items.push({
            record: rec,
            title: payload.title || payload.name || 'Untitled',
            snippet,
            tags: payload.tags || [],
            type: rec.type,
          });
        } catch (err) {
          // Skip records that cannot be decrypted
        }
      }

      setAllDecrypted(items);
    } catch (err) {
      console.error('Search decryption failed:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadAndDecryptAll();
  }, [loadAndDecryptAll]);

  const searchResults = allDecrypted.filter((item) => {
    const matchesType = filterType === 'ALL' || item.type === filterType;
    if (!query.trim()) return matchesType;

    const q = query.toLowerCase();
    const matchesTitle = item.title.toLowerCase().includes(q);
    const matchesSnippet = item.snippet && item.snippet.toLowerCase().includes(q);
    const matchesTag = item.tags.some((t) => t.toLowerCase().includes(q));

    return matchesType && (matchesTitle || matchesSnippet || matchesTag);
  });

  const getHref = (item: SearchResultItem) => {
    switch (item.type) {
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

  const getIcon = (type: string) => {
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Top Header */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-primary" />
            Zero-Knowledge Global Search
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-label-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
          <Shield className="w-3.5 h-3.5" />
          <span>In-Memory Client Index</span>
        </div>
      </header>

      {/* Search Input Bar */}
      <div className="p-6 pb-2 max-w-4xl mx-auto w-full">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all notes, commands, tags, titles, and snippets in memory..."
            className="w-full bg-surface-panel border border-border-subtle focus:border-border-accent rounded-lg pl-11 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none shadow-lg font-body-md"
            autoFocus
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto mono-scroll py-1">
          {['ALL', 'page', 'folder', 'credential', 'environment', 'idea', 'snippet'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded text-xs font-label-ui transition-colors ${
                filterType === t
                  ? 'bg-surface-raised text-text-primary border border-border-muted font-medium'
                  : 'bg-surface hover:bg-surface-panel text-text-muted hover:text-text-primary border border-border-subtle'
              }`}
            >
              {t === 'ALL' ? 'All Types' : `${t.charAt(0).toUpperCase() + t.slice(1)}s`}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-label-mono text-text-muted">
            {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
      </div>

      {/* Results View */}
      <main className="flex-1 overflow-y-auto px-6 py-4 max-w-4xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Indexing decrypted in-memory workspace...
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Search className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-xs text-text-muted font-label-mono">
              {query ? `No items found matching "${query}".` : 'Enter a search term above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {searchResults.map((item) => (
              <Link
                key={item.record.entryId}
                href={getHref(item)}
                className="p-3.5 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted hover:bg-surface-raised/50 transition-all flex items-start justify-between gap-3 group block"
              >
                <div className="flex items-start gap-3 truncate flex-1">
                  <div className="w-8 h-8 rounded bg-surface border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-label-mono uppercase px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-text-muted shrink-0">
                        {item.type}
                      </span>
                    </div>

                    {item.snippet && (
                      <p className="text-[11px] text-text-muted line-clamp-1 font-mono">
                        {item.snippet}
                      </p>
                    )}

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-[10px] font-label-mono text-text-secondary"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
