'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  FileText,
  Folder,
  Key,
  Terminal,
  Lightbulb,
  Code,
  ArrowRight,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import { apiGetEntries, apiUpdateEntry } from '@/lib/api';
import { EntryRecord } from '@envbook/shared';

export default function FavoritesPage() {
  const vault = useVault();
  const [favorites, setFavorites] = useState<Array<{ record: EntryRecord; title: string }>>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isFavorite: true, isDeleted: false });
      const items: Array<{ record: EntryRecord; title: string }> = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<any>(rec.encryptedPayload, rec.nonce, rec.entryId);
          items.push({ record: rec, title: payload.title || payload.name || 'Untitled' });
        } catch (err) {
          items.push({ record: rec, title: 'Encrypted Entry' });
        }
      }

      setFavorites(items);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleRemoveFavorite = async (id: string) => {
    try {
      await apiUpdateEntry(id, { isFavorite: false });
      setFavorites((prev) => prev.filter((i) => i.record.entryId !== id));
    } catch (err) {
      console.error('Failed to unfavorite:', err);
    }
  };

  const getHref = (rec: EntryRecord) => {
    switch (rec.type) {
      case 'folder':
        return `/app/folder/${rec.entryId}`;
      case 'credential':
        return '/app/credentials';
      case 'environment':
        return '/app/environments';
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
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-status-warning fill-current" />
            Starred &amp; Favorites
          </span>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {favorites.length} items
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Loading starred favorites...
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Star className="w-8 h-8 text-status-warning/40 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">No Starred Items</h3>
            <p className="text-xs text-text-muted font-label-mono">
              Click the star icon on any document, secret, or folder to pin it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {favorites.map(({ record, title }) => (
              <div
                key={record.entryId}
                className="p-3.5 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted transition-all flex items-center justify-between group"
              >
                <Link href={getHref(record)} className="flex items-center gap-3 truncate flex-1">
                  <Star className="w-4 h-4 text-status-warning fill-current shrink-0" />
                  <span className="text-xs font-semibold text-text-primary hover:text-primary transition-colors truncate">
                    {title}
                  </span>
                  <span className="text-[10px] font-label-mono uppercase px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-text-muted shrink-0">
                    {record.type}
                  </span>
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveFavorite(record.entryId)}
                    className="text-xs text-text-muted hover:text-status-danger px-2 py-1 rounded"
                    title="Remove from favorites"
                  >
                    Unstar
                  </button>
                  <Link href={getHref(record)} className="text-text-muted hover:text-primary p-1">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
