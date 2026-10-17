'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  X,
  Lock,
  Loader2,
  AlertCircle,
  Database,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiGetEntryById,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedEnvironmentPayload } from '@envbook/shared';
import { parseDotenv, deduplicateVariables, generateDotenv, ParseEnvResult } from '@/lib/dotenv';
import { downloadFile } from '@/lib/exportUtils';

interface EnvironmentItem {
  record: EntryRecord;
  payload: DecryptedEnvironmentPayload;
  title: string;
}

export default function EnvironmentsPage() {
  const searchParams = useSearchParams();
  const pageIdParam = searchParams.get('id');

  const vault = useVault();
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(pageIdParam);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'variables' | 'diff'>('variables');

  useEffect(() => {
    document.title = 'Environment Variables & Bulk .env Manager — EnvBook';
  }, []);

  // 15-second auto-remasking for environment variables
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const remaskTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedValueKey, setCopiedValueKey] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [deletingVarKey, setDeletingVarKey] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<{ originalKey: string; key: string; value: string; comment?: string } | null>(null);

  // Single variable form state
  const [varKey, setVarKey] = useState('');
  const [varValue, setVarValue] = useState('');
  const [varComment, setVarComment] = useState('');
  const [showVarValue, setShowVarValue] = useState(false);
  const [varFormError, setVarFormError] = useState<string | null>(null);

  // Bulk .env Import state
  const [importText, setImportText] = useState('');
  const [parseResult, setParseResult] = useState<ParseEnvResult | null>(null);
  const [dupPolicy, setDupPolicy] = useState<'keep_last' | 'keep_first'>('keep_last');
  const [collisionPolicy, setCollisionPolicy] = useState<'overwrite' | 'skip'>('overwrite');
  const [isImportSaving, setIsImportSaving] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [previewRevealed, setPreviewRevealed] = useState<Record<number, boolean>>({});

  // Export state
  const [exportFilename, setExportFilename] = useState('.env');

  const loadEnvironments = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ isDeleted: false });
      // Match environment_page and legacy environment
      const envRecords = res.entries.filter(
        (e) => e.type === 'environment_page' || e.type === 'environment'
      );

      const decryptedList: EnvironmentItem[] = [];

      for (const rec of envRecords) {
        try {
          const payload = await vault.decrypt<any>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );
          decryptedList.push({
            record: rec,
            payload: {
              name: payload?.name || 'production',
              variables: payload?.variables || [],
              updatedAt: payload?.updatedAt,
            },
            title: payload?.title || (payload?.name ? `${payload.name.toUpperCase()} Environment` : 'Environment Variables'),
          });
        } catch (err) {
          console.error('[Environments] Decrypt failure:', rec.entryId, err);
          decryptedList.push({
            record: rec,
            payload: { name: 'production', variables: [] },
            title: 'Encrypted Environment',
          });
        }
      }

      setEnvironments(decryptedList);

      // Select active environment
      if (pageIdParam) {
        setActiveEnvId(pageIdParam);
      } else if (decryptedList.length > 0 && !activeEnvId) {
        setActiveEnvId(decryptedList[0].record.entryId);
      }
    } catch (err) {
      console.error('[Environments] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [vault, pageIdParam, activeEnvId]);

  useEffect(() => {
    loadEnvironments();
    return () => {
      Object.values(remaskTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, [loadEnvironments]);

  // Current active environment record
  const currentEnv =
    environments.find((e) => e.record.entryId === activeEnvId) ||
    environments[0] ||
    null;

  const currentVariables = currentEnv?.payload.variables || [];
  const existingKeySet = new Set(currentVariables.map((v) => v.key));

  // Toggle reveal for a saved variable with 15s timer
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

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValueKey(key);
    setTimeout(() => setCopiedValueKey(null), 2000);
  };

  // Run parser on import text
  const runParser = (text: string) => {
    setImportText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseDotenv(text, existingKeySet);
    setParseResult(result);
  };

  // Commit bulk imported variables
  const handleSaveBulkImport = async () => {
    if (!parseResult || parseResult.validCount === 0 || !vault.isUnlocked) return;

    try {
      setIsImportSaving(true);

      // Deduplicate parsed variables
      const deduped = deduplicateVariables(parseResult.variables, dupPolicy);

      // Merge with existing variables according to collision policy
      let mergedVars = [...currentVariables];
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const item of deduped) {
        const existingIdx = mergedVars.findIndex((v) => v.key === item.key);
        if (existingIdx >= 0) {
          if (collisionPolicy === 'overwrite') {
            mergedVars[existingIdx] = { key: item.key, value: item.value };
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          mergedVars.push({ key: item.key, value: item.value });
          createdCount++;
        }
      }

      // Encrypt updated environment payload with zero-knowledge AES-256-GCM
      const updatedPayload: DecryptedEnvironmentPayload = {
        name: currentEnv?.payload.name || 'production',
        variables: mergedVars,
        updatedAt: new Date().toISOString(),
      };

      if (currentEnv) {
        const { ciphertext, nonce, aad } = await vault.encrypt(updatedPayload, currentEnv.record.entryId);
        await apiUpdateEntry(currentEnv.record.entryId, {
          encryptedPayload: ciphertext,
          nonce,
          aad,
        });
      } else {
        const newEntryId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        const { ciphertext, nonce, aad } = await vault.encrypt(
          { ...updatedPayload, title: 'Environment Variables' },
          newEntryId
        );
        const res = await apiCreateEntry({
          entryId: newEntryId,
          type: 'environment_page',
          encryptedPayload: ciphertext,
          nonce,
          aad,
        });
        setActiveEnvId(res.entry.entryId);
      }

      // Clear sensitive temporary input from memory
      setImportText('');
      setParseResult(null);
      setIsImportModalOpen(false);
      setImportFeedback(`Saved: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`);
      setTimeout(() => setImportFeedback(null), 5000);

      await loadEnvironments();
    } catch (err: any) {
      console.error('Bulk import error:', err);
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImportSaving(false);
    }
  };

  // Save single variable (add or edit)
  const handleSaveSingleVariable = async () => {
    setVarFormError(null);
    const key = varKey.trim();
    if (!key) {
      setVarFormError('Variable key is required.');
      return;
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      setVarFormError('Key name must start with a letter or underscore and contain only alphanumeric characters and underscores (^[A-Za-z_][A-Za-z0-9_]*$).');
      return;
    }

    // Check collision if key was renamed or added
    if (editingVar && editingVar.originalKey !== key && existingKeySet.has(key)) {
      setVarFormError(`Variable key "${key}" already exists in this environment. To update its value, use the Edit action on the existing entry or choose a unique key name.`);
      return;
    } else if (!editingVar && existingKeySet.has(key)) {
      setVarFormError(`Variable key "${key}" already exists in this environment. To update its value, cancel this form and use the Edit action on the existing entry or choose a unique key name.`);
      return;
    }

    try {
      let updatedVars = [...currentVariables];
      if (editingVar) {
        updatedVars = updatedVars.map((v) =>
          v.key === editingVar.originalKey ? { key, value: varValue, comment: varComment.trim() || undefined } : v
        );
      } else {
        updatedVars.push({ key, value: varValue, comment: varComment.trim() || undefined });
      }

      const updatedPayload: DecryptedEnvironmentPayload = {
        name: currentEnv?.payload.name || 'production',
        variables: updatedVars,
        updatedAt: new Date().toISOString(),
      };

      if (currentEnv) {
        const { ciphertext, nonce, aad } = await vault.encrypt(updatedPayload, currentEnv.record.entryId);
        await apiUpdateEntry(currentEnv.record.entryId, {
          encryptedPayload: ciphertext,
          nonce,
          aad,
        });
      } else {
        const newEntryId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        const { ciphertext, nonce, aad } = await vault.encrypt(
          { ...updatedPayload, title: 'Environment Variables' },
          newEntryId
        );
        const res = await apiCreateEntry({
          entryId: newEntryId,
          type: 'environment_page',
          encryptedPayload: ciphertext,
          nonce,
          aad,
        });
        setActiveEnvId(res.entry.entryId);
      }

      setIsAddModalOpen(false);
      setEditingVar(null);
      setVarKey('');
      setVarValue('');
      setVarComment('');
      setShowVarValue(false);
      setImportFeedback(editingVar ? `Updated variable ${key}` : `Added variable ${key}`);
      setTimeout(() => setImportFeedback(null), 4000);
      await loadEnvironments();
    } catch (err: any) {
      setVarFormError(err.message || 'Failed to save variable');
    }
  };

  const handleConfirmDeleteVariable = async () => {
    if (!deletingVarKey || !currentEnv || !vault.isUnlocked) return;
    const keyToDelete = deletingVarKey;
    setDeletingVarKey(null);

    try {
      const updatedVars = currentVariables.filter((v) => v.key !== keyToDelete);
      const updatedPayload: DecryptedEnvironmentPayload = {
        name: currentEnv.payload.name,
        variables: updatedVars,
        updatedAt: new Date().toISOString(),
      };

      const { ciphertext, nonce, aad } = await vault.encrypt(updatedPayload, currentEnv.record.entryId);
      await apiUpdateEntry(currentEnv.record.entryId, {
        encryptedPayload: ciphertext,
        nonce,
        aad,
      });

      setImportFeedback(`Deleted variable ${keyToDelete}`);
      setTimeout(() => setImportFeedback(null), 4000);
      await loadEnvironments();
    } catch (err: any) {
      alert(`Failed to delete variable: ${err.message}`);
    }
  };

  // Execute export download
  const handleExecuteExport = () => {
    if (!currentVariables || currentVariables.length === 0) return;

    try {
      const dotenvContent = generateDotenv(currentVariables);
      const filename = exportFilename.trim() || '.env';
      downloadFile(filename, dotenvContent, 'text/plain;charset=utf-8');
      setIsExportConfirmOpen(false);
      setImportFeedback(`Exported ${currentVariables.length} variables to ${filename}`);
      setTimeout(() => setImportFeedback(null), 5000);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message}`);
    }
  };

  // Filtered variables for search
  const filteredVariables = currentVariables.filter((v) => {
    if (!searchQuery) return true;
    return v.key.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas">
      {/* Top Header */}
      <header className="h-14 border-b border-border-subtle bg-surface-toolbar px-5 flex items-center justify-between shrink-0 z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-elevated border border-border-muted flex items-center justify-center text-primary shadow-xs">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-text-primary tracking-tight">
                Environments &amp; Secrets
              </h1>
              {environments.length > 1 && (
                <div className="relative">
                  <select
                    value={activeEnvId || ''}
                    onChange={(e) => setActiveEnvId(e.target.value)}
                    className="bg-surface-elevated border border-border-muted rounded px-2 py-0.5 text-xs text-text-primary font-mono focus:border-border-focus focus:outline-none"
                  >
                    {environments.map((env) => (
                      <option key={env.record.entryId} value={env.record.entryId}>
                        {env.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <p className="text-[11px] font-mono text-text-muted">
              Zero-knowledge encrypted environment secrets &amp; .env manager
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {importFeedback && (
            <span className="text-xs font-mono text-text-primary bg-surface-raised border border-border-muted px-2.5 py-1 rounded shadow-xs">
              {importFeedback}
            </span>
          )}

          {/* Import Button */}
          <button
            type="button"
            onClick={() => {
              setImportText('');
              setParseResult(null);
              setIsImportModalOpen(true);
            }}
            className="px-3 py-1.5 rounded bg-primary text-primary-fg hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Import or paste .env file contents"
          >
            <Upload className="w-3.5 h-3.5 text-primary-fg" />
            <span className="text-primary-fg">Import / Paste .env</span>
          </button>

          {/* Add Variable Button */}
          <button
            type="button"
            onClick={() => {
              setEditingVar(null);
              setVarKey('');
              setVarValue('');
              setVarComment('');
              setShowVarValue(false);
              setVarFormError(null);
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-xs font-medium text-text-primary flex items-center gap-1.5 transition-colors shadow-xs"
            title="Create a new encrypted environment variable"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variable</span>
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => {
              const defaultName = currentEnv?.payload.name ? `${currentEnv.payload.name}.env` : '.env';
              setExportFilename(defaultName);
              setIsExportConfirmOpen(true);
            }}
            className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-xs font-medium text-text-primary flex items-center gap-1.5 transition-colors shadow-xs"
            title="Export decrypted variables to a .env file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .env</span>
          </button>
        </div>
      </header>

      {/* Search and Filters Bar */}
      <div className="px-5 py-2.5 bg-surface-subtle border-b border-border-subtle flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search variables by key name..."
              className="w-full bg-surface-panel border border-border-muted rounded pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-muted/60 focus:border-border-focus focus:ring-1 focus:ring-border-focus"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded border border-border-muted bg-surface-panel p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('variables')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'variables' ? 'bg-primary text-surface-canvas font-semibold shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Variables
            </button>
            <button
              type="button"
              onClick={() => setViewMode('diff')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'diff' ? 'bg-primary text-surface-canvas font-semibold shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Diff View
            </button>
          </div>
        </div>

        {/* Calculated Variable Count */}
        <div className="text-xs font-mono text-text-muted flex items-center gap-2">
          <span>
            {searchQuery.trim()
              ? `Showing ${filteredVariables.length} of ${currentVariables.length} variables`
              : `${currentVariables.length} ${currentVariables.length === 1 ? 'variable' : 'variables'} stored`}
          </span>
        </div>
      </div>

      {/* Main Variables View Canvas */}
      <main className="flex-1 overflow-y-auto p-5 max-w-5xl mx-auto w-full custom-scroll">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-text-muted font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Decrypting environment variables...</span>
          </div>
        ) : viewMode === 'diff' ? (
          /* Parity Matrix Diff View */
          <div className="bg-surface-subtle border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-subtle font-semibold text-text-primary text-sm">
              <Layers className="w-4 h-4 text-primary" />
              <span>Environment Variables Parity Matrix</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted text-left">
                    <th className="py-2 px-3">Variable Key</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {filteredVariables.map((v) => (
                    <tr key={v.key} className="hover:bg-surface-panel/30">
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{v.key}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-surface-raised text-text-primary border border-border-muted font-bold text-[10px]">
                          SET
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : filteredVariables.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-4 text-center border border-dashed border-border-muted rounded-xl bg-surface-panel/40 flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-surface-raised border border-border-muted text-primary">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {searchQuery.trim() ? 'No matching variables' : 'No environment variables'}
              </h3>
              <p className="text-xs text-text-muted font-mono mt-1 max-w-md">
                {searchQuery.trim()
                  ? `No variables match your search "${searchQuery}". Clear search to view all variables.`
                  : 'Paste your complete .env block or add individual variables to securely encrypt each key/value pair.'}
              </p>
            </div>
            {!searchQuery.trim() && (
              <div className="flex items-center gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportText('');
                    setParseResult(null);
                    setIsImportModalOpen(true);
                  }}
                  className="px-4 py-2 rounded bg-primary text-surface-canvas font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Paste .env Block</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVar(null);
                    setVarKey('');
                    setVarValue('');
                    setVarComment('');
                    setShowVarValue(false);
                    setVarFormError(null);
                    setIsAddModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-xs text-text-primary flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variable</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Table of Independently Managed Variables */
          <div className="bg-surface-subtle border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-surface-panel border-b border-border-subtle font-mono text-[11px] text-text-muted uppercase tracking-wider font-semibold">
              <div className="col-span-4">Variable Key</div>
              <div className="col-span-5">Encrypted Value</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            <div className="divide-y divide-border-subtle/60">
              {filteredVariables.map((v) => {
                const isRevealed = Boolean(revealedKeys[v.key]);
                const isKeyCopied = copiedKey === v.key;
                const isValueCopied = copiedValueKey === v.key;

                return (
                  <div
                    key={v.key}
                    className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 px-4 py-3 hover:bg-surface-panel/40 transition-colors items-start sm:items-center"
                  >
                    {/* Key with Copy Key Button */}
                    <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs font-semibold text-text-primary tracking-tight truncate select-all">
                        {v.key}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyKey(v.key)}
                        title={isKeyCopied ? 'Key copied!' : 'Copy variable key name'}
                        aria-label="Copy key name"
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors shrink-0"
                      >
                        {isKeyCopied ? (
                          <Check className="w-3 h-3 text-primary" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Value */}
                    <div className="col-span-5 flex items-center gap-2 min-w-0 font-mono text-xs">
                      {isRevealed ? (
                        <div className="flex items-center gap-1.5 text-text-primary bg-surface-raised border border-border-muted px-2 py-0.5 rounded truncate select-all">
                          <span className="truncate">{v.value}</span>
                          <span className="text-[10px] text-text-muted ml-1 shrink-0 font-semibold font-mono">15s</span>
                        </div>
                      ) : (
                        <span className="text-text-muted tracking-widest font-mono select-none">
                          ••••••••••••••••
                        </span>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="col-span-3 flex items-center justify-end gap-1 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-border-subtle">
                      {/* Reveal / Hide */}
                      <button
                        type="button"
                        onClick={() => toggleReveal(v.key)}
                        title={isRevealed ? 'Hide value' : 'Reveal value'}
                        aria-label={isRevealed ? 'Hide value' : 'Reveal value'}
                        className={`p-1.5 rounded transition-colors ${
                          isRevealed
                            ? 'text-primary bg-primary/10'
                            : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
                        }`}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {/* Copy Value */}
                      <button
                        type="button"
                        onClick={() => handleCopyValue(v.key, v.value)}
                        title={isValueCopied ? 'Value copied!' : 'Copy secret value'}
                        aria-label="Copy secret value"
                        className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
                      >
                        {isValueCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVar({ originalKey: v.key, key: v.key, value: v.value, comment: v.comment });
                          setVarKey(v.key);
                          setVarValue(v.value);
                          setVarComment(v.comment || '');
                          setShowVarValue(false);
                          setVarFormError(null);
                          setIsAddModalOpen(true);
                        }}
                        title="Edit variable"
                        aria-label="Edit variable"
                        className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete - STRICTLY RED DESTRUCTIVE BUTTON */}
                      <button
                        type="button"
                        onClick={() => setDeletingVarKey(v.key)}
                        title="Delete variable"
                        aria-label="Delete variable"
                        className="p-1.5 rounded text-status-danger hover:bg-status-danger/15 border border-transparent hover:border-status-danger/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-status-danger" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* BULK .ENV IMPORT MODAL */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-env-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-3xl bg-surface-elevated border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-panel">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-surface-raised border border-border-muted text-primary">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="import-env-title" className="text-sm font-semibold text-text-primary tracking-tight">
                    Import / Paste .env Block
                  </h2>
                  <p className="text-[11px] font-mono text-text-muted">
                    Paste multiple lines in KEY=VALUE syntax. Each variable will be encrypted and stored independently.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto custom-scroll flex-1">
              {/* Multiline textarea for pasting raw .env */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-text-muted uppercase tracking-wider flex items-center justify-between">
                  <span>Paste .env File Content</span>
                  <span className="text-[10px] text-text-muted lowercase">supports comments (#), quotes, and URLs</span>
                </label>
                <textarea
                  rows={7}
                  value={importText}
                  onChange={(e) => runParser(e.target.value)}
                  placeholder={`# Paste .env contents\nMONGODB_URI=mongodb://localhost:27017/envbook_dev\nPORT=3000\nJWT_SECRET=replace-with-a-long-random-secret`}
                  className="w-full p-3 bg-surface-canvas border border-border-muted rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:border-border-focus focus:ring-1 focus:ring-border-focus custom-scroll leading-relaxed"
                />
              </div>

              {/* Parsing Diagnostics & Preview */}
              {parseResult && (
                <div className="flex flex-col gap-3 pt-2 border-t border-border-subtle">
                  {/* Summary Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-surface-raised border border-border-muted text-xs font-mono text-text-primary">
                      Valid: <strong className="text-primary">{parseResult.validCount}</strong>
                    </span>
                    {parseResult.errorCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-status-danger/15 border border-status-danger/30 text-xs font-mono text-status-danger">
                        Errors: <strong>{parseResult.errorCount}</strong>
                      </span>
                    )}
                    {parseResult.duplicateCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-status-warning/15 border border-status-warning/30 text-xs font-mono text-status-warning">
                        Duplicate Keys: <strong>{parseResult.duplicateCount}</strong>
                      </span>
                    )}
                    {parseResult.collisionCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-xs font-mono text-primary">
                        Collisions with Stored: <strong>{parseResult.collisionCount}</strong>
                      </span>
                    )}
                  </div>

                  {/* Resolution Choices */}
                  {(parseResult.duplicateCount > 0 || parseResult.collisionCount > 0) && (
                    <div className="p-3 bg-surface-panel border border-border-muted rounded-lg flex flex-col sm:flex-row gap-3 text-xs font-mono">
                      {parseResult.duplicateCount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Duplicates:</span>
                          <select
                            value={dupPolicy}
                            onChange={(e) => setDupPolicy(e.target.value as any)}
                            className="bg-surface-elevated border border-border-subtle rounded px-2 py-1 text-xs text-text-primary"
                          >
                            <option value="keep_last">Keep Last Value</option>
                            <option value="keep_first">Keep First Value</option>
                          </select>
                        </div>
                      )}

                      {parseResult.collisionCount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Conflicts:</span>
                          <select
                            value={collisionPolicy}
                            onChange={(e) => setCollisionPolicy(e.target.value as any)}
                            className="bg-surface-elevated border border-border-subtle rounded px-2 py-1 text-xs text-text-primary"
                          >
                            <option value="overwrite">Overwrite Stored</option>
                            <option value="skip">Skip / Keep Stored</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collision Warning Banner */}
                  {parseResult.collisionCount > 0 && (
                    <div className="p-2.5 bg-surface-panel border border-border-muted rounded-lg text-xs font-mono text-text-muted">
                      Conflicting keys detected: <strong className="text-text-primary">{parseResult.collisions.join(', ')}</strong>.
                      {collisionPolicy === 'overwrite'
                        ? ' These will update existing values upon save.'
                        : ' Existing values will be preserved and imported values skipped.'}
                    </div>
                  )}

                  {/* Validation Error Alerts */}
                  {parseResult.errors.length > 0 && (
                    <div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded-lg flex flex-col gap-1.5 text-xs font-mono text-status-danger">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-status-danger" />
                        <span>Validation Issues Detected:</span>
                      </div>
                      {parseResult.errors.map((err, i) => (
                        <div key={i} className="text-[11px] pl-5">
                          Line {err.lineNumber}: {err.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Parsed Variables Preview List */}
                  {parseResult.variables.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                        Parsed Variables Preview
                      </span>
                      <div className="max-h-48 overflow-y-auto custom-scroll border border-border-subtle rounded-lg bg-surface-panel divide-y divide-border-subtle">
                        {parseResult.variables.map((item, idx) => {
                          const isRevealed = Boolean(previewRevealed[idx]);
                          return (
                            <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs font-mono">
                              <div className="flex items-center gap-2 truncate flex-1 pr-3">
                                <span className="text-text-primary font-semibold truncate">{item.key}</span>
                                <span className="text-text-muted">=</span>
                                <span className="text-text-secondary truncate">
                                  {isRevealed ? item.value : '••••••••••••'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.isCollision && (
                                  <span className="text-[10px] text-text-primary bg-surface-raised border border-border-muted px-1.5 py-0.5 rounded font-semibold">
                                    Collision
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewRevealed((prev) => ({ ...prev, [idx]: !prev[idx] }))
                                  }
                                  className="p-1 rounded text-text-muted hover:text-text-primary"
                                  title={isRevealed ? 'Mask value' : 'Preview value'}
                                >
                                  {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-surface-panel">
              <span className="text-[11px] font-mono text-text-muted">
                Plaintext values are never logged or stored.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulkImport}
                  disabled={isImportSaving || !parseResult || parseResult.validCount === 0}
                  className="px-4 py-1.5 rounded bg-primary text-surface-canvas font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-xs"
                >
                  {isImportSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Encrypting &amp; Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Encrypt &amp; Save ({parseResult?.validCount || 0})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SINGLE VARIABLE ADD/EDIT MODAL */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="variable-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-surface-elevated border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-panel">
              <h3 id="variable-form-title" className="text-sm font-semibold text-text-primary">
                {editingVar ? 'Edit Variable' : 'Add Environment Variable'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setShowVarValue(false);
                  setVarFormError(null);
                }}
                className="p-1 rounded text-text-muted hover:text-text-primary"
                aria-label="Close form"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveSingleVariable();
              }}
              className="p-5 flex flex-col gap-3.5"
            >
              {varFormError && (
                <div className="p-2.5 bg-status-danger/10 border border-status-danger/30 rounded text-status-danger text-xs font-mono leading-relaxed">
                  {varFormError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="var-key-input" className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  Key Name *
                </label>
                <input
                  id="var-key-input"
                  type="text"
                  required
                  value={varKey}
                  onChange={(e) => setVarKey(e.target.value.toUpperCase())}
                  placeholder="KEY_NAME"
                  className="w-full px-3 py-1.5 bg-surface-canvas border border-border-muted rounded text-xs font-mono text-text-primary focus:border-border-focus focus:ring-1 focus:ring-border-focus"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="var-value-input" className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  Secret Value *
                </label>
                <div className="relative flex items-center">
                  <input
                    id="var-value-input"
                    type={showVarValue ? 'text' : 'password'}
                    required
                    value={varValue}
                    onChange={(e) => setVarValue(e.target.value)}
                    placeholder="Variable value..."
                    className="w-full px-3 py-1.5 pr-9 bg-surface-canvas border border-border-muted rounded text-xs font-mono text-text-primary focus:border-border-focus focus:ring-1 focus:ring-border-focus"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVarValue(!showVarValue)}
                    className="absolute right-2 p-1 text-text-muted hover:text-text-primary transition-colors"
                    title={showVarValue ? 'Mask secret' : 'Reveal secret'}
                    aria-label={showVarValue ? 'Mask secret' : 'Reveal secret'}
                  >
                    {showVarValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="var-comment-input" className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  Optional Comment / Group
                </label>
                <input
                  id="var-comment-input"
                  type="text"
                  value={varComment}
                  onChange={(e) => setVarComment(e.target.value)}
                  placeholder="e.g. Primary production cluster"
                  className="w-full px-3 py-1.5 bg-surface-canvas border border-border-muted rounded text-xs text-text-primary focus:border-border-focus focus:ring-1 focus:ring-border-focus"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setShowVarValue(false);
                    setVarFormError(null);
                  }}
                  className="px-3 py-1.5 rounded border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-primary text-surface-canvas font-semibold text-xs hover:opacity-90 shadow-xs transition-opacity"
                >
                  Save Variable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EXPORT .ENV CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {isExportConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-env-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-surface-elevated border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-panel">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-surface-raised border border-border-muted text-primary">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="export-env-title" className="text-sm font-semibold text-text-primary tracking-tight">
                    Export Decrypted .env File
                  </h2>
                  <p className="text-[11px] font-mono text-text-muted">
                    Save authorized environment variables to a local .env file
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportConfirmOpen(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-surface-panel border border-border-subtle rounded-lg flex flex-col gap-1 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Target Environment:</span>
                  <span className="font-semibold text-text-primary">{currentEnv?.title || 'Production'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Variables to Export:</span>
                  <span className="font-semibold text-primary">{currentVariables.length} entries</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="export-filename-input" className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  Download Filename
                </label>
                <input
                  id="export-filename-input"
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  placeholder=".env"
                  className="w-full px-3 py-1.5 bg-surface-canvas border border-border-muted rounded text-xs font-mono text-text-primary focus:border-border-focus focus:ring-1 focus:ring-border-focus"
                />
              </div>

              <p className="text-[11px] text-text-muted leading-relaxed">
                Values will be decrypted in-memory through your authorized vault and downloaded directly to your device. Secret values are never printed to logs or sent to external servers.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle bg-surface-panel">
              <button
                type="button"
                onClick={() => setIsExportConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={currentVariables.length === 0}
                onClick={handleExecuteExport}
                className="px-4 py-1.5 rounded bg-primary text-surface-canvas font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .env</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE VARIABLE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {deletingVarKey && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-var-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-surface-elevated border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-panel">
              <div className="flex items-center gap-2 text-status-danger">
                <Trash2 className="w-4 h-4 text-status-danger" />
                <h3 id="delete-var-title" className="text-sm font-semibold text-text-primary">
                  Delete Variable
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingVarKey(null)}
                className="p-1 rounded text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                Are you sure you want to delete <strong className="text-text-primary font-mono">{deletingVarKey}</strong>?
                This will permanently remove it from your zero-knowledge encrypted environment store.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle bg-surface-panel">
              <button
                type="button"
                onClick={() => setDeletingVarKey(null)}
                className="px-3.5 py-1.5 rounded border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVariable}
                className="px-4 py-1.5 rounded bg-status-danger text-white font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 shadow-xs transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Variable</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
