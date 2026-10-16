'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Terminal,
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
  Upload,
  Download,
  FileText,
  Layers,
  GitCompare,
  X,
  Lock,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedEnvironmentPayload } from '@envbook/shared';
import { PasswordInput } from '@/components/ui/PasswordInput';

interface EnvironmentItem {
  record: EntryRecord;
  payload: DecryptedEnvironmentPayload;
}

export default function EnvironmentsPage() {
  const vault = useVault();
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'production' | 'staging' | 'development' | 'testing'>('production');
  const [viewMode, setViewMode] = useState<'variables' | 'diff'>('variables');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 15-second auto-remasking for environment variables
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const remaskTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<{ key: string; value: string; comment?: string } | null>(null);

  // Form input
  const [varKey, setVarKey] = useState('');
  const [varValue, setVarValue] = useState('');
  const [varComment, setVarComment] = useState('');

  // Import preview
  const [importText, setImportText] = useState('');
  const [parsedImport, setParsedImport] = useState<Array<{ key: string; value: string }>>([]);

  const loadEnvironments = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ type: 'environment', isDeleted: false });
      const decryptedList: EnvironmentItem[] = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<DecryptedEnvironmentPayload>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );
          decryptedList.push({ record: rec, payload });
        } catch (err) {
          console.error('[Environments] Decrypt failure:', rec.entryId, err);
        }
      }

      setEnvironments(decryptedList);
    } catch (err) {
      console.error('[Environments] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadEnvironments();
    return () => {
      Object.values(remaskTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, [loadEnvironments]);

  // Current active environment record
  const currentEnvItem = environments.find((e) => e.payload.name === activeTab);
  const currentVariables = currentEnvItem?.payload.variables || [];

  const toggleReveal = (varName: string) => {
    setRevealedKeys((prev) => {
      const isRevealed = Boolean(prev[varName]);
      if (isRevealed) {
        if (remaskTimersRef.current[varName]) {
          clearTimeout(remaskTimersRef.current[varName]);
          delete remaskTimersRef.current[varName];
        }
        return { ...prev, [varName]: false };
      }

      if (remaskTimersRef.current[varName]) {
        clearTimeout(remaskTimersRef.current[varName]);
      }

      remaskTimersRef.current[varName] = setTimeout(() => {
        setRevealedKeys((cur) => ({ ...cur, [varName]: false }));
        delete remaskTimersRef.current[varName];
      }, 15000); // 15 seconds

      return { ...prev, [varName]: true };
    });
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Save or update variable in the active environment
  const handleSaveVariable = async () => {
    if (!varKey.trim() || !vault.isUnlocked) {
      alert('Variable name is required.');
      return;
    }

    const cleanKey = varKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    let updatedVars = [...currentVariables];

    const existingIndex = updatedVars.findIndex((v) => v.key === cleanKey);
    if (existingIndex >= 0) {
      updatedVars[existingIndex] = {
        key: cleanKey,
        value: varValue,
        comment: varComment.trim() || undefined,
      };
    } else {
      updatedVars.push({
        key: cleanKey,
        value: varValue,
        comment: varComment.trim() || undefined,
      });
    }

    try {
      const updatedPayload: DecryptedEnvironmentPayload = {
        name: activeTab,
        variables: updatedVars,
        updatedAt: new Date().toISOString(),
      };

      if (currentEnvItem) {
        const { ciphertext, nonce } = await vault.encrypt(updatedPayload, currentEnvItem.record.entryId);
        await apiUpdateEntry(currentEnvItem.record.entryId, {
          encryptedPayload: ciphertext,
          nonce,
        });
      } else {
        const newEntryId = crypto.randomUUID();
        const { ciphertext, nonce } = await vault.encrypt(updatedPayload, newEntryId);
        await apiCreateEntry({
          entryId: newEntryId,
          type: 'environment',
          encryptedPayload: ciphertext,
          nonce,
        });
      }

      setVarKey('');
      setVarValue('');
      setVarComment('');
      setEditingVar(null);
      setIsAddModalOpen(false);
      await loadEnvironments();
    } catch (err: any) {
      alert(`Error saving variable: ${err.message}`);
    }
  };

  const handleDeleteVariable = async (keyToDelete: string) => {
    if (!currentEnvItem || !vault.isUnlocked) return;
    if (!confirm(`Delete variable ${keyToDelete}?`)) return;

    try {
      const updatedVars = currentVariables.filter((v) => v.key !== keyToDelete);
      const updatedPayload: DecryptedEnvironmentPayload = {
        ...currentEnvItem.payload,
        variables: updatedVars,
        updatedAt: new Date().toISOString(),
      };

      const { ciphertext, nonce } = await vault.encrypt(updatedPayload, currentEnvItem.record.entryId);
      await apiUpdateEntry(currentEnvItem.record.entryId, {
        encryptedPayload: ciphertext,
        nonce,
      });

      await loadEnvironments();
    } catch (err: any) {
      alert(`Failed to delete variable: ${err.message}`);
    }
  };

  const openEditModal = (v: { key: string; value: string; comment?: string }) => {
    setEditingVar(v);
    setVarKey(v.key);
    setVarValue(v.value);
    setVarComment(v.comment || '');
    setIsAddModalOpen(true);
  };

  // Safe client-side .env file parser
  const handleParseImport = (text: string) => {
    setImportText(text);
    const lines = text.split('\n');
    const parsed: Array<{ key: string; value: string }> = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        let key = trimmed.slice(0, equalIndex).trim();
        if (key.startsWith('export ')) key = key.replace('export ', '').trim();
        let val = trimmed.slice(equalIndex + 1).trim();

        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }

        if (key) {
          parsed.push({ key, value: val });
        }
      }
    });

    setParsedImport(parsed);
  };

  // Execute import
  const handleApplyImport = async () => {
    if (parsedImport.length === 0 || !vault.isUnlocked) return;

    try {
      const varMap = new Map<string, string>();
      // Keep existing vars
      currentVariables.forEach((v) => varMap.set(v.key, v.value));
      // Overwrite/add imported vars
      parsedImport.forEach((v) => varMap.set(v.key, v.value));

      const mergedVars = Array.from(varMap.entries()).map(([k, v]) => ({ key: k, value: v }));

      const updatedPayload: DecryptedEnvironmentPayload = {
        name: activeTab,
        variables: mergedVars,
        updatedAt: new Date().toISOString(),
      };

      if (currentEnvItem) {
        const { ciphertext, nonce } = await vault.encrypt(updatedPayload, currentEnvItem.record.entryId);
        await apiUpdateEntry(currentEnvItem.record.entryId, {
          encryptedPayload: ciphertext,
          nonce,
        });
      } else {
        const newEntryId = crypto.randomUUID();
        const { ciphertext, nonce } = await vault.encrypt(updatedPayload, newEntryId);
        await apiCreateEntry({
          entryId: newEntryId,
          type: 'environment',
          encryptedPayload: ciphertext,
          nonce,
        });
      }

      setIsImportModalOpen(false);
      setImportText('');
      setParsedImport([]);
      await loadEnvironments();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  // Explicit client-side .env export
  const handleExportDotenv = () => {
    if (currentVariables.length === 0) {
      alert('No variables in this environment to export.');
      return;
    }

    const lines = [
      `# EnvBook Safe Export: ${activeTab.toUpperCase()}`,
      `# Generated: ${new Date().toISOString()}`,
      `# WARNING: Contains decrypted secrets. Keep secure.`,
      '',
      ...currentVariables.map((v) => (v.comment ? `# ${v.comment}\n${v.key}="${v.value}"` : `${v.key}="${v.value}"`)),
    ];

    const element = document.createElement('a');
    const file = new Blob([lines.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `.env.${activeTab}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setIsExportConfirmOpen(false);
  };

  // Environment Diff calculation
  const allEnvKeys = Array.from(
    new Set(environments.flatMap((e) => e.payload.variables.map((v) => v.key)))
  ).sort();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Top Header */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-secondary text-xs font-label-mono">Configuration</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            Environments &amp; Secrets
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-2.5 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-label-ui flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import .env</span>
          </button>
          <button
            onClick={() => setIsExportConfirmOpen(true)}
            className="px-2.5 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-label-ui flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .env</span>
          </button>
          <button
            onClick={() => {
              setEditingVar(null);
              setVarKey('');
              setVarValue('');
              setVarComment('');
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Variable</span>
          </button>
        </div>
      </header>

      {/* Tabs & View Modes */}
      <div className="h-11 px-4 bg-surface-subtle border-b border-border-subtle flex items-center justify-between shrink-0 gap-3">
        {/* Environment Tabs */}
        <div className="flex items-center gap-1 bg-surface-panel p-0.5 rounded border border-border-subtle">
          {[
            { id: 'production', label: 'Production', dot: 'bg-accent-emerald' },
            { id: 'staging', label: 'Staging', dot: 'bg-status-warning' },
            { id: 'development', label: 'Local Dev', dot: 'bg-secondary' },
            { id: 'testing', label: 'Testing', dot: 'bg-primary-fixed-dim' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded text-xs font-label-ui flex items-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface-raised text-text-primary font-medium border border-border-muted shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* View mode toggle & Search */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-panel p-0.5 rounded border border-border-subtle text-xs">
            <button
              onClick={() => setViewMode('variables')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'variables'
                  ? 'bg-surface-raised text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Layers className="w-3 h-3" />
              Variables
            </button>
            <button
              onClick={() => setViewMode('diff')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'diff'
                  ? 'bg-surface-raised text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <GitCompare className="w-3 h-3" />
              Diff View
            </button>
          </div>

          <div className="relative w-48 shrink-0">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter keys..."
              className="w-full bg-surface-panel border border-border-subtle rounded pl-7 pr-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full mono-scroll">
        {viewMode === 'diff' ? (
          /* ENVIRONMENT DIFF TABLE */
          <div className="rounded-lg bg-surface-panel border border-border-subtle overflow-hidden">
            <div className="p-3 bg-surface-subtle border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Environment Variables Parity Matrix</span>
              <span className="text-[11px] font-label-mono text-text-muted">
                Compares presence across all environments without leaking secrets
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-label-mono">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface text-text-muted">
                    <th className="p-3">Variable Key</th>
                    <th className="p-3">Production</th>
                    <th className="p-3">Staging</th>
                    <th className="p-3">Development</th>
                    <th className="p-3">Testing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {allEnvKeys.map((key) => {
                    const hasProd = environments.some((e) => e.payload.name === 'production' && e.payload.variables.some((v) => v.key === key));
                    const hasStaging = environments.some((e) => e.payload.name === 'staging' && e.payload.variables.some((v) => v.key === key));
                    const hasDev = environments.some((e) => e.payload.name === 'development' && e.payload.variables.some((v) => v.key === key));
                    const hasTest = environments.some((e) => e.payload.name === 'testing' && e.payload.variables.some((v) => v.key === key));

                    return (
                      <tr key={key} className="hover:bg-surface-raised/40 transition-colors">
                        <td className="p-3 text-text-primary font-semibold">{key}</td>
                        <td className="p-3">
                          {hasProd ? (
                            <span className="text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded text-[10px]">SET</span>
                          ) : (
                            <span className="text-status-danger bg-status-danger/10 px-2 py-0.5 rounded text-[10px]">MISSING</span>
                          )}
                        </td>
                        <td className="p-3">
                          {hasStaging ? (
                            <span className="text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded text-[10px]">SET</span>
                          ) : (
                            <span className="text-status-danger bg-status-danger/10 px-2 py-0.5 rounded text-[10px]">MISSING</span>
                          )}
                        </td>
                        <td className="p-3">
                          {hasDev ? (
                            <span className="text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded text-[10px]">SET</span>
                          ) : (
                            <span className="text-status-danger bg-status-danger/10 px-2 py-0.5 rounded text-[10px]">MISSING</span>
                          )}
                        </td>
                        <td className="p-3">
                          {hasTest ? (
                            <span className="text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded text-[10px]">SET</span>
                          ) : (
                            <span className="text-status-danger bg-status-danger/10 px-2 py-0.5 rounded text-[10px]">MISSING</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* VARIABLES LIST TABLE */
          <div className="rounded-lg bg-surface-panel border border-border-subtle overflow-hidden">
            <div className="p-3 bg-surface-subtle border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary capitalize">{activeTab} Variables</span>
                <span className="text-[10px] font-label-mono text-text-muted bg-surface px-1.5 py-0.2 rounded border border-border-subtle">
                  {currentVariables.length} total
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-label-mono text-text-muted">
                <Lock className="w-3 h-3 text-primary" />
                <span>Zero-Knowledge AES-256-GCM</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xs text-text-muted font-label-mono">
                Decrypting environment variables...
              </div>
            ) : currentVariables.length === 0 ? (
              <div className="text-center py-12">
                <Terminal className="w-7 h-7 text-text-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs text-text-muted font-label-mono mb-3">
                  No variables configured for {activeTab}.
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3 py-1 rounded bg-primary-container text-on-primary-container text-xs font-semibold"
                >
                  Add Variable
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs font-label-mono">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface text-text-muted">
                    <th className="p-3">Variable Name</th>
                    <th className="p-3">Masked Value (15s reveal)</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {currentVariables
                    .filter((v) => v.key.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item) => {
                      const isRevealed = Boolean(revealedKeys[item.key]);
                      const isCopied = copiedKey === item.key;

                      return (
                        <tr key={item.key} className="hover:bg-surface-raised/40 transition-colors">
                          <td className="p-3 text-text-primary font-bold">{item.key}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs select-all">
                                {isRevealed ? (
                                  <span className="text-text-primary">{item.value}</span>
                                ) : (
                                  <span className="text-mask-glyph tracking-widest select-none">••••••••••••••••</span>
                                )}
                              </span>

                              {/* 15s Reveal Button */}
                              <button
                                onClick={() => toggleReveal(item.key)}
                                className={`p-1 rounded text-xs flex items-center gap-1 transition-colors ${
                                  isRevealed
                                    ? 'text-status-warning bg-status-warning/10'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                                title={isRevealed ? 'Hide (auto-remasks in 15s)' : 'Reveal secret'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {isRevealed && <span className="text-[10px]">15s</span>}
                              </button>

                              {/* Deliberate Copy */}
                              <button
                                onClick={() => handleCopy(item.key, item.value)}
                                className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
                                title="Copy variable value"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-accent-emerald" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-text-muted text-[11px] italic">
                            {item.comment || '—'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1 text-text-muted hover:text-text-primary"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteVariable(item.key)}
                                className="p-1 text-text-muted hover:text-status-danger"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Add / Edit Variable Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-panel border border-border-subtle rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle">
              <h3 className="text-sm font-semibold text-text-primary">
                {editingVar ? 'Edit Variable' : `Add to ${activeTab.toUpperCase()}`}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs font-body-sm">
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Variable Key (e.g. DATABASE_URL) *
                </label>
                <input
                  type="text"
                  value={varKey}
                  onChange={(e) => setVarKey(e.target.value)}
                  placeholder="KEY_NAME"
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-border-accent uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Secret Value *
                </label>
                <PasswordInput
                  value={varValue}
                  onChange={(e) => setVarValue(e.target.value)}
                  placeholder="Variable value..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Comment / Usage Note
                </label>
                <input
                  type="text"
                  value={varComment}
                  onChange={(e) => setVarComment(e.target.value)}
                  placeholder="Optional usage description..."
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-subtle flex justify-end gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVariable}
                className="px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold"
              >
                Save Variable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-panel border border-border-subtle rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Import .env to {activeTab.toUpperCase()}</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-text-muted">
                Paste the contents of your <code className="text-primary font-mono">.env</code> file below. Parsed keys will be previewed before encrypting.
              </p>

              <textarea
                value={importText}
                onChange={(e) => handleParseImport(e.target.value)}
                placeholder="DATABASE_URL=postgres://...\nREDIS_HOST=localhost\nSECRET_KEY=..."
                className="w-full h-36 bg-surface border border-border-subtle rounded p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-border-accent mono-scroll"
              />

              {parsedImport.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-text-primary">
                    Detected Variables ({parsedImport.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto bg-surface rounded border border-border-subtle p-2 space-y-1 mono-scroll">
                    {parsedImport.map((v) => (
                      <div key={v.key} className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-primary font-semibold">{v.key}</span>
                        <span className="text-text-muted">••••••••</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-subtle flex justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyImport}
                disabled={parsedImport.length === 0}
                className="px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold disabled:opacity-50"
              >
                Encrypt &amp; Import ({parsedImport.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Confirmation Modal */}
      {isExportConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-panel border border-border-subtle rounded-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-status-warning">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-semibold text-text-primary">Export Decrypted .env File</h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              You are about to export decrypted secrets for <strong className="text-text-primary uppercase">{activeTab}</strong> to your local filesystem.
              Ensure you do not commit or share this exported file publicly.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsExportConfirmOpen(false)}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleExportDotenv}
                className="px-3.5 py-1.5 rounded bg-status-warning text-on-background font-semibold text-xs hover:bg-status-warning/90"
              >
                Confirm &amp; Download .env.{activeTab}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
