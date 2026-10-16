'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Folder,
  Key,
  Terminal,
  Lightbulb,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiRestoreEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord } from '@envbook/shared';

export default function TrashPage() {
  const vault = useVault();
  const [trashed, setTrashed] = useState<Array<{ record: EntryRecord; title: string }>>([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isDeleted: true });
      const items: Array<{ record: EntryRecord; title: string }> = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<any>(rec.encryptedPayload, rec.nonce, rec.entryId);
          items.push({ record: rec, title: payload.title || payload.name || 'Untitled' });
        } catch (err) {
          items.push({ record: rec, title: 'Encrypted Entry' });
        }
      }

      setTrashed(items);
    } catch (err) {
      console.error('Failed to load trash:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = async (id: string) => {
    try {
      await apiRestoreEntry(id);
      setTrashed((prev) => prev.filter((i) => i.record.entryId !== id));
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (
      !confirm(
        'PERMANENT DELETION: This action cannot be undone. Are you sure you want to permanently delete this item from the database?'
      )
    ) {
      return;
    }

    try {
      await apiDeleteEntry(id, true); // permanent = true
      setTrashed((prev) => prev.filter((i) => i.record.entryId !== id));
    } catch (err: any) {
      alert(`Permanent delete failed: ${err.message}`);
    }
  };

  const handleEmptyTrash = async () => {
    if (trashed.length === 0) return;
    if (
      !confirm(
        `PERMANENTLY DELETE ALL ${trashed.length} ITEMS? This will erase all soft-deleted records from MongoDB permanently.`
      )
    ) {
      return;
    }

    try {
      for (const item of trashed) {
        await apiDeleteEntry(item.record.entryId, true);
      }
      setTrashed([]);
    } catch (err: any) {
      alert(`Failed to empty trash: ${err.message}`);
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
            <Trash2 className="w-3.5 h-3.5 text-status-danger" />
            Trash
          </span>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {trashed.length} items
          </span>
        </div>

        {trashed.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="px-2.5 py-1 rounded bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 text-status-danger text-xs font-label-ui transition-colors flex items-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Empty Trash</span>
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Loading trash...
          </div>
        ) : trashed.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Trash2 className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">Trash is Empty</h3>
            <p className="text-xs text-text-muted font-label-mono">
              Deleted documents, secrets, and environments appear here before permanent erasure.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {trashed.map(({ record, title }) => (
              <div
                key={record.entryId}
                className="p-3.5 rounded-lg bg-surface-panel border border-border-subtle flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 truncate">
                  <Trash2 className="w-4 h-4 text-status-danger/70 shrink-0" />
                  <span className="text-xs font-semibold text-text-primary truncate">{title}</span>
                  <span className="text-[10px] font-label-mono uppercase px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-text-muted">
                    {record.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(record.entryId)}
                    className="px-2.5 py-1 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-xs text-text-primary hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 text-primary" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(record.entryId)}
                    className="px-2.5 py-1 rounded bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 text-xs text-status-danger transition-colors"
                    title="Permanent Delete"
                  >
                    Erase
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
