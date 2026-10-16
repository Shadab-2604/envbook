'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Archive,
  RotateCcw,
  Trash2,
  FileText,
  Folder,
  Key,
  Terminal,
  Lightbulb,
  Code,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import { apiGetEntries, apiUpdateEntry, apiDeleteEntry } from '@/lib/api';
import { EntryRecord } from '@envbook/shared';

export default function ArchivePage() {
  const vault = useVault();
  const [archived, setArchived] = useState<Array<{ record: EntryRecord; title: string }>>([]);
  const [loading, setLoading] = useState(true);

  const loadArchived = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isArchived: true, isDeleted: false });
      const items: Array<{ record: EntryRecord; title: string }> = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<any>(rec.encryptedPayload, rec.nonce, rec.entryId);
          items.push({ record: rec, title: payload.title || payload.name || 'Untitled' });
        } catch (err) {
          items.push({ record: rec, title: 'Encrypted Entry' });
        }
      }

      setArchived(items);
    } catch (err) {
      console.error('Failed to load archived entries:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  const handleUnarchive = async (id: string) => {
    try {
      await apiUpdateEntry(id, { isArchived: false });
      setArchived((prev) => prev.filter((i) => i.record.entryId !== id));
    } catch (err: any) {
      alert(`Failed to unarchive: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Move archived item to Trash?')) return;
    try {
      await apiDeleteEntry(id);
      setArchived((prev) => prev.filter((i) => i.record.entryId !== id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
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
            <Archive className="w-3.5 h-3.5 text-secondary" />
            Archive
          </span>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {archived.length} archived
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Loading archive...
          </div>
        ) : archived.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Archive className="w-8 h-8 text-secondary/40 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">Archive is Empty</h3>
            <p className="text-xs text-text-muted font-label-mono">
              Archived documents and configuration remain safely encrypted and hidden from primary views.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {archived.map(({ record, title }) => (
              <div
                key={record.entryId}
                className="p-3.5 rounded-lg bg-surface-panel border border-border-subtle flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 truncate">
                  <Archive className="w-4 h-4 text-secondary shrink-0" />
                  <span className="text-xs font-semibold text-text-primary truncate">{title}</span>
                  <span className="text-[10px] font-label-mono uppercase px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-text-muted">
                    {record.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUnarchive(record.entryId)}
                    className="px-2.5 py-1 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3 text-primary" />
                    <span>Unarchive</span>
                  </button>
                  <button
                    onClick={() => handleDelete(record.entryId)}
                    className="p-1 text-text-muted hover:text-status-danger"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
