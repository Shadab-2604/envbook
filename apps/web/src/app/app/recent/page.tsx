'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  FileText,
  Folder,
  Key,
  Terminal,
  Lightbulb,
  Code,
  ArrowRight,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import { apiGetEntries } from '@/lib/api';
import { EntryRecord } from '@envbook/shared';

export default function RecentItemsPage() {
  const vault = useVault();
  const [recents, setRecents] = useState<Array<{ record: EntryRecord; title: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Recently Updated — EnvBook';
  }, []);

  const loadRecents = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isDeleted: false });
      const items: Array<{ record: EntryRecord; title: string }> = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<any>(rec.encryptedPayload, rec.nonce, rec.entryId);
          items.push({ record: rec, title: payload.title || payload.name || 'Untitled' });
        } catch (err) {
          items.push({ record: rec, title: 'Encrypted Entry' });
        }
      }

      // Sort by updatedAt desc
      items.sort((a, b) => new Date(b.record.updatedAt).getTime() - new Date(a.record.updatedAt).getTime());

      setRecents(items);
    } catch (err) {
      console.error('Failed to load recent items:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadRecents();
  }, [loadRecents]);

  const getHref = (rec: EntryRecord) => {
    switch (rec.type) {
      case 'folder':
      case 'section':
      case 'notes_section':
        return `/app/folder/${rec.entryId}`;
      case 'credential':
        return '/app/credentials';
      case 'environment':
      case 'environment_page':
        return `/app/environments?id=${rec.entryId}`;
      case 'idea':
        return '/app/ideas';
      case 'snippet':
        return '/app/snippets';
      default:
        return `/app/page/${rec.entryId}`;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <h1 className="text-text-primary text-xs font-medium flex items-center gap-1.5 inline-flex">
            <Clock className="w-3.5 h-3.5 text-primary" />
            Recently Updated
          </h1>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {recents.length} items
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Loading recent activity...
          </div>
        ) : recents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Clock className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">No Recent Activity</h3>
            <p className="text-xs text-text-muted font-label-mono">
              Edited documents and configuration updates will be timestamped here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recents.map(({ record, title }) => (
              <Link
                key={record.entryId}
                href={getHref(record)}
                className="p-3.5 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted transition-all flex items-center justify-between group block"
              >
                <div className="flex items-center gap-3 truncate flex-1">
                  <div className="w-8 h-8 rounded bg-surface border border-border-subtle flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors truncate block">
                      {title}
                    </span>
                    <span className="text-[10px] font-label-mono uppercase text-text-muted">
                      {record.type} • Updated {new Date(record.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
