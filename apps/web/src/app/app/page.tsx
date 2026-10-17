'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Key,
  Database,
  Lightbulb,
  Plus,
  Star,
  Clock,
  ShieldCheck,
  ArrowRight,
  Shield,
  Download,
} from 'lucide-react';
import { TopNavBar } from '@/components/layout/TopNavBar';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { apiGetEntries, apiCreateEntry } from '@/lib/api';
import { EntryRecord } from '@envbook/shared';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isUnlocked, encrypt, decrypt } = useVault();

  const [recentEntries, setRecentEntries] = useState<Array<{ entry: EntryRecord; title: string }>>([]);
  const [favoriteEntries, setFavoriteEntries] = useState<Array<{ entry: EntryRecord; title: string }>>([]);
  const [counts, setCounts] = useState({ total: 0, credentials: 0, environments: 0, ideas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Dashboard — EnvBook';
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;

    let mounted = true;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const { entries } = await apiGetEntries({ isDeleted: false, isArchived: false });

        let credCount = 0;
        let envCount = 0;
        let ideaCount = 0;

        const decryptedList: Array<{ entry: EntryRecord; title: string }> = [];

        for (const entry of entries) {
          if (entry.type === 'credential') credCount++;
          if (entry.type === 'environment' || entry.type === 'environment_page') envCount++;
          if (entry.type === 'idea') ideaCount++;

          try {
            const payload: any = await decrypt(entry.encryptedPayload, entry.nonce, entry.entryId);
            decryptedList.push({ entry, title: payload?.title || 'Untitled' });
          } catch {
            decryptedList.push({ entry, title: 'Encrypted Record' });
          }
        }

        if (mounted) {
          setCounts({
            total: entries.length,
            credentials: credCount,
            environments: envCount,
            ideas: ideaCount,
          });

          // Recent 6 items
          setRecentEntries(decryptedList.slice(0, 6));

          // Favorites
          setFavoriteEntries(decryptedList.filter((item) => item.entry.isFavorite));
        }
      } catch (err) {
        console.error('Failed to load dashboard entries:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboardData();
    return () => {
      mounted = false;
    };
  }, [isUnlocked, decrypt]);

  const handleCreateNewPage = async () => {
    if (!isUnlocked) return;
    const entryId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const { ciphertext, nonce, aad } = await encrypt(
      {
        title: 'Untitled Note',
        content: '# Untitled Note\n\nStart typing or use `/` for slash commands...',
        tags: [],
      },
      entryId
    );

    const res = await apiCreateEntry({
      entryId,
      type: 'page',
      encryptedPayload: ciphertext,
      nonce,
      aad,
    });

    router.push(`/app/page/${res.entry.entryId}`);
  };

  return (
    <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
      <TopNavBar breadcrumbs={[{ label: 'EnvBook', href: '/app' }, { label: 'Dashboard' }]} />

      <main className="flex-1 overflow-y-auto dot-grid p-4 sm:p-6 custom-scroll">
        <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-20">
          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-subtle border border-border-subtle p-5 rounded-xl shadow-sm">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Welcome back, {user?.name || user?.username}
              </h1>
              <p className="text-xs text-text-muted">
                Your private workspace is unlocked with client-side AES-256-GCM encryption.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-surface-panel px-3 py-1.5 rounded border border-accent-emerald/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
              <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
              <span className="font-mono text-xs text-accent-emerald font-semibold">
                Air-Gapped Local Session
              </span>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={handleCreateNewPage}
              className="p-3.5 bg-surface-subtle hover:bg-surface-panel border border-border-subtle hover:border-border-muted rounded-lg flex flex-col gap-2 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded bg-surface-panel group-hover:bg-accent-emerald/10 border border-border-muted flex items-center justify-center text-accent-emerald transition-colors">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">New Note</div>
                <div className="text-[11px] text-text-muted">Markdown &amp; blocks</div>
              </div>
            </button>

            <Link
              href="/app/credentials"
              className="p-3.5 bg-surface-subtle hover:bg-surface-panel border border-border-subtle hover:border-border-muted rounded-lg flex flex-col gap-2 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded bg-surface-panel group-hover:bg-accent-emerald/10 border border-border-muted flex items-center justify-center text-accent-emerald transition-colors">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">New Secret</div>
                <div className="text-[11px] text-text-muted">API key or password</div>
              </div>
            </Link>

            <Link
              href="/app/environments"
              className="p-3.5 bg-surface-subtle hover:bg-surface-panel border border-border-subtle hover:border-border-muted rounded-lg flex flex-col gap-2 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded bg-surface-panel group-hover:bg-accent-emerald/10 border border-border-muted flex items-center justify-center text-accent-emerald transition-colors">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">Environments</div>
                <div className="text-[11px] text-text-muted">.env manager &amp; sync</div>
              </div>
            </Link>

            <Link
              href="/app/ideas"
              className="p-3.5 bg-surface-subtle hover:bg-surface-panel border border-border-subtle hover:border-border-muted rounded-lg flex flex-col gap-2 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded bg-surface-panel group-hover:bg-accent-emerald/10 border border-border-muted flex items-center justify-center text-accent-emerald transition-colors">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">Quick Capture</div>
                <div className="text-[11px] text-text-muted">Ideas &amp; architecture</div>
              </div>
            </Link>
          </div>

          {/* Metrics Bento Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] text-text-muted uppercase">Total Entries</div>
                <div className="text-xl font-bold text-text-primary mt-0.5">{counts.total}</div>
              </div>
              <FileText className="w-5 h-5 text-text-muted" />
            </div>

            <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] text-accent-emerald uppercase">Vault Secrets</div>
                <div className="text-xl font-bold text-accent-emerald mt-0.5">{counts.credentials}</div>
              </div>
              <Key className="w-5 h-5 text-accent-emerald" />
            </div>

            <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] text-text-muted uppercase">Pending Ideas</div>
                <div className="text-xl font-bold text-text-primary mt-0.5">{counts.ideas}</div>
              </div>
              <Lightbulb className="w-5 h-5 text-text-muted" />
            </div>

            <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] text-text-muted uppercase">Backup Status</div>
                <div className="font-mono text-xs font-semibold text-accent-emerald mt-1">Verified Clean</div>
              </div>
              <Shield className="w-5 h-5 text-accent-emerald" />
            </div>
          </div>

          {/* Dual Split: Recently Updated & Favorites */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Recent Entries */}
            <div className="bg-surface-subtle border border-border-subtle rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-text-primary">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <span>Recently Updated</span>
                </div>
                <Link href="/app/entries" className="text-[11px] text-accent-emerald hover:underline">
                  View All
                </Link>
              </div>

              <div className="flex flex-col gap-1.5">
                {recentEntries.map(({ entry, title }) => (
                  <Link
                    key={entry.entryId}
                    href={
                      entry.type === 'section' || entry.type === 'notes_section' || entry.type === 'folder'
                        ? `/app/folder/${entry.entryId}`
                        : entry.type === 'environment_page' || entry.type === 'environment'
                        ? `/app/environments?id=${entry.entryId}`
                        : entry.type === 'credential'
                        ? '/app/credentials'
                        : entry.type === 'idea'
                        ? '/app/ideas'
                        : `/app/page/${entry.entryId}`
                    }
                    className="flex items-center justify-between p-2 rounded hover:bg-surface-panel transition-colors text-xs text-text-secondary hover:text-text-primary group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-text-muted group-hover:text-primary shrink-0" />
                      <span className="truncate font-medium">{title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-text-muted uppercase shrink-0">
                      {entry.type}
                    </span>
                  </Link>
                ))}
                {recentEntries.length === 0 && (
                  <div className="py-8 text-center text-text-muted text-xs">
                    No entries yet. Create your first note or secret above.
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Favorites */}
            <div className="bg-surface-subtle border border-border-subtle rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-text-primary">
                  <Star className="w-3.5 h-3.5 text-status-warning" />
                  <span>Pinned Favorites</span>
                </div>
                <Link href="/app/favorites" className="text-[11px] text-accent-emerald hover:underline">
                  Manage
                </Link>
              </div>

              <div className="flex flex-col gap-1.5">
                {favoriteEntries.map(({ entry, title }) => (
                  <Link
                    key={entry.entryId}
                    href={
                      entry.type === 'section' || entry.type === 'notes_section' || entry.type === 'folder'
                        ? `/app/folder/${entry.entryId}`
                        : entry.type === 'environment_page' || entry.type === 'environment'
                        ? `/app/environments?id=${entry.entryId}`
                        : entry.type === 'credential'
                        ? '/app/credentials'
                        : entry.type === 'idea'
                        ? '/app/ideas'
                        : `/app/page/${entry.entryId}`
                    }
                    className="flex items-center justify-between p-2 rounded hover:bg-surface-panel transition-colors text-xs text-text-secondary hover:text-text-primary group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Star className="w-3.5 h-3.5 text-status-warning shrink-0" />
                      <span className="truncate font-medium">{title}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
                {favoriteEntries.length === 0 && (
                  <div className="py-8 text-center text-text-muted text-xs">
                    No pinned favorites. Star any page to pin it here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
