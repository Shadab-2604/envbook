'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Key,
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  Trash2,
  Edit2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Lock,
  ExternalLink,
  Tag,
  X,
  Server,
  Database,
  Globe,
  Terminal,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedCredentialPayload } from '@envbook/shared';
import { PasswordInput } from '@/components/ui/PasswordInput';

interface CredentialItem {
  record: EntryRecord;
  payload: DecryptedCredentialPayload;
}

export default function CredentialsPage() {
  const vault = useVault();
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Revealed secrets state with 15-second auto-remasking timers
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const remaskTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CredentialItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    type: 'api_key' as DecryptedCredentialPayload['type'],
    provider: '',
    project: '',
    purpose: '',
    rotationDays: 90,
  });

  const loadCredentials = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ type: 'credential', isDeleted: false });
      const decryptedList: CredentialItem[] = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<DecryptedCredentialPayload>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );
          decryptedList.push({ record: rec, payload });
        } catch (err) {
          console.error('[Credentials] Failed to decrypt record:', rec.entryId, err);
        }
      }

      setCredentials(decryptedList);
    } catch (err) {
      console.error('[Credentials] Failed to fetch credentials:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadCredentials();

    return () => {
      // Clear all active remask timers on unmount
      Object.values(remaskTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, [loadCredentials]);

  // Handle explicit reveal with mandatory 15-second auto-remask
  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const isCurrentlyRevealed = Boolean(prev[id]);

      // If currently revealed, unreveal and clear timer
      if (isCurrentlyRevealed) {
        if (remaskTimersRef.current[id]) {
          clearTimeout(remaskTimersRef.current[id]);
          delete remaskTimersRef.current[id];
        }
        return { ...prev, [id]: false };
      }

      // If currently hidden, reveal and start 15s timer
      if (remaskTimersRef.current[id]) {
        clearTimeout(remaskTimersRef.current[id]);
      }

      remaskTimersRef.current[id] = setTimeout(() => {
        setRevealedIds((cur) => ({ ...cur, [id]: false }));
        delete remaskTimersRef.current[id];
      }, 15000); // 15 seconds

      return { ...prev, [id]: true };
    });
  };

  // Safe deliberate copy
  const handleCopy = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      value: '',
      type: 'api_key',
      provider: '',
      project: '',
      purpose: '',
      rotationDays: 90,
    });
    setEditingItem(null);
    setIsAddModalOpen(false);
  };

  const handleSaveCredential = async () => {
    if (!formData.title.trim() || !formData.value.trim() || !vault.isUnlocked) {
      alert('Please provide both a Name and Secret Value.');
      return;
    }

    try {
      const entryId = editingItem ? editingItem.record.entryId : crypto.randomUUID();
      const payload: DecryptedCredentialPayload = {
        title: formData.title.trim(),
        value: formData.value.trim(),
        type: formData.type,
        provider: formData.provider.trim() || undefined,
        project: formData.project.trim() || undefined,
        purpose: formData.purpose.trim() || undefined,
        rotationDays: formData.rotationDays,
        updatedAt: new Date().toISOString(),
      };

      const { ciphertext, nonce } = await vault.encrypt(payload, entryId);

      if (editingItem) {
        await apiUpdateEntry(entryId, {
          encryptedPayload: ciphertext,
          nonce,
        });
      } else {
        await apiCreateEntry({
          entryId,
          type: 'credential',
          encryptedPayload: ciphertext,
          nonce,
        });
      }

      resetForm();
      await loadCredentials();
    } catch (err: any) {
      alert(`Error saving credential: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Move this credential to Trash?')) return;
    try {
      await apiDeleteEntry(id);
      await loadCredentials();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const openEditModal = (item: CredentialItem) => {
    setEditingItem(item);
    setFormData({
      title: item.payload.title,
      value: item.payload.value,
      type: item.payload.type,
      provider: item.payload.provider || '',
      project: item.payload.project || '',
      purpose: item.payload.purpose || '',
      rotationDays: item.payload.rotationDays || 90,
    });
    setIsAddModalOpen(true);
  };

  const filteredCredentials = credentials.filter((item) => {
    const matchesType = typeFilter === 'ALL' || item.payload.type === typeFilter;
    const matchesSearch =
      searchQuery === '' ||
      item.payload.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.payload.provider && item.payload.provider.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.payload.project && item.payload.project.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'database_uri':
        return <Database className="w-4 h-4 text-primary" />;
      case 'ssh_key':
        return <Terminal className="w-4 h-4 text-status-warning" />;
      case 'token':
        return <Globe className="w-4 h-4 text-accent-emerald-bright" />;
      default:
        return <Key className="w-4 h-4 text-primary" />;
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
          <span className="text-text-secondary text-xs font-label-mono">Security</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-primary" />
            Credentials Vault
          </span>
          <span className="ml-1 text-[10px] font-label-mono text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded">
            AES-256-GCM
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Secret</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="h-11 px-4 bg-surface-subtle border-b border-border-subtle flex items-center justify-between shrink-0 gap-3">
        {/* Type pills */}
        <div className="flex items-center gap-1 overflow-x-auto mono-scroll py-1">
          {['ALL', 'api_key', 'database_uri', 'password', 'token', 'ssh_key'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded text-xs font-label-ui transition-colors ${
                typeFilter === t
                  ? 'bg-surface-raised text-text-primary border border-border-muted font-medium'
                  : 'bg-surface hover:bg-surface-panel text-text-muted hover:text-text-primary border border-border-subtle'
              }`}
            >
              {t === 'ALL'
                ? 'All Secrets'
                : t === 'api_key'
                ? 'API Keys'
                : t === 'database_uri'
                ? 'Databases'
                : t === 'ssh_key'
                ? 'SSH Keys'
                : t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search credentials..."
            className="w-full bg-surface-panel border border-border-subtle rounded pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
          />
        </div>
      </div>

      {/* Main Credentials Grid */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            <span className="w-2 h-2 rounded-full bg-accent-emerald animate-ping mr-2 inline-block" />
            Loading encrypted secrets...
          </div>
        ) : filteredCredentials.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Shield className="w-8 h-8 text-primary/60 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">No credentials found</h3>
            <p className="text-xs text-text-muted font-label-mono mb-4">
              Add your API keys, database credentials, and tokens with zero-knowledge encryption.
            </p>
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 rounded bg-primary-container text-on-primary-container text-xs font-semibold"
            >
              Add First Credential
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCredentials.map(({ record, payload }) => {
              const isRevealed = Boolean(revealedIds[record.entryId]);
              const isCopied = copiedId === record.entryId;

              // Check if rotation is overdue (e.g. older than rotationDays)
              const updatedAtDate = new Date(payload.updatedAt || record.updatedAt);
              const daysOld = Math.floor((Date.now() - updatedAtDate.getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = payload.rotationDays && daysOld > payload.rotationDays;

              return (
                <div
                  key={record.entryId}
                  className="p-4 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted transition-all flex flex-col justify-between gap-3 group relative"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded bg-surface border border-border-subtle flex items-center justify-center shrink-0">
                        {getTypeIcon(payload.type)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-semibold text-text-primary truncate">{payload.title}</h4>
                          {isOverdue && (
                            <span
                              className="text-[10px] text-status-warning bg-status-warning/10 border border-status-warning/30 px-1 py-0.2 rounded font-label-mono flex items-center gap-0.5"
                              title={`Rotation overdue (${daysOld} days old)`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Rotate
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted font-label-mono">
                          {payload.provider && <span>{payload.provider}</span>}
                          {payload.provider && payload.project && <span>•</span>}
                          {payload.project && <span>{payload.project}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal({ record, payload })}
                        className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised transition-colors"
                        title="Edit secret"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.entryId)}
                        className="p-1 text-text-muted hover:text-status-danger rounded hover:bg-surface-raised transition-colors"
                        title="Delete secret"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Secret Value Monospace Box with Eye Toggle and 15s Auto-Remask */}
                  <div className="flex items-center justify-between p-2 rounded bg-surface border border-border-subtle font-secret-mask text-xs">
                    <div className="truncate font-mono tracking-wider flex-1 mr-2 select-all">
                      {isRevealed ? (
                        <span className="text-text-primary font-mono select-all">{payload.value}</span>
                      ) : (
                        <span className="text-mask-glyph tracking-widest select-none">••••••••••••••••••••</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Reveal Toggle */}
                      <button
                        onClick={() => toggleReveal(record.entryId)}
                        className={`p-1 rounded text-xs flex items-center gap-1 transition-colors ${
                          isRevealed
                            ? 'text-status-warning hover:text-status-warning/80 bg-status-warning/10'
                            : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
                        }`}
                        title={isRevealed ? 'Hide secret (auto-remasks in 15s)' : 'Reveal secret'}
                        type="button"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {isRevealed && <span className="text-[10px] font-label-mono">15s</span>}
                      </button>

                      {/* Copy Secret Button */}
                      <button
                        onClick={() => handleCopy(record.entryId, payload.value)}
                        className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised transition-colors"
                        title="Copy secret value"
                        type="button"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-accent-emerald" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Metadata & Purpose */}
                  {payload.purpose && (
                    <p className="text-[11px] text-text-secondary font-body-sm line-clamp-1 italic">
                      "{payload.purpose}"
                    </p>
                  )}

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-[10px] font-label-mono text-text-muted">
                    <span>Rotated {daysOld}d ago</span>
                    <span>Max {payload.rotationDays || 90}d</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Credential Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-panel border border-border-subtle rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingItem ? 'Edit Credential' : 'New Encrypted Credential'}
                </h3>
              </div>
              <button onClick={resetForm} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs font-body-sm overflow-y-auto max-h-[75vh]">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Secret Name / Key *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., STRIPE_SECRET_KEY or Prod DB Postgres"
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Credential Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                >
                  <option value="api_key">API Key</option>
                  <option value="database_uri">Database URI</option>
                  <option value="password">Password</option>
                  <option value="token">Token / Bearer</option>
                  <option value="ssh_key">SSH / Private Key</option>
                  <option value="smtp">SMTP Credentials</option>
                  <option value="secret">Other Secret</option>
                </select>
              </div>

              {/* Value with Universal Eye Toggle */}
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Secret Value *
                </label>
                <PasswordInput
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Paste sensitive secret value..."
                />
              </div>

              {/* Provider & Project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                    Provider
                  </label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="e.g. AWS, OpenAI"
                    className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                    Project
                  </label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    placeholder="e.g. Auth Service"
                    className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Purpose / Usage Notes
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Notes on where this key is deployed..."
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                />
              </div>

              {/* Rotation Policy */}
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Rotation Interval (Days)
                </label>
                <input
                  type="number"
                  value={formData.rotationDays}
                  onChange={(e) => setFormData({ ...formData, rotationDays: parseInt(e.target.value, 10) || 90 })}
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-subtle flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCredential}
                className="px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold"
              >
                {editingItem ? 'Save Changes' : 'Encrypt & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
