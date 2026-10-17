'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Code,
  Terminal,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit2,
  Tag,
  X,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedSnippetPayload } from '@envbook/shared';

interface SnippetItem {
  record: EntryRecord;
  payload: DecryptedSnippetPayload;
}

export default function SnippetsPage() {
  const vault = useVault();
  const [snippets, setSnippets] = useState<SnippetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SnippetItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    language: 'bash',
    code: '',
    description: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  const loadSnippets = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ type: 'snippet', isDeleted: false });
      const decryptedList: SnippetItem[] = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<DecryptedSnippetPayload>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );
          decryptedList.push({ record: rec, payload });
        } catch (err) {
          console.error('[Snippets] Decrypt failure:', rec.entryId, err);
        }
      }

      setSnippets(decryptedList);
    } catch (err) {
      console.error('[Snippets] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    document.title = 'Code Snippets & Library — EnvBook';
  }, []);

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveSnippet = async () => {
    if (!formData.title.trim() || !formData.code.trim() || !vault.isUnlocked) {
      alert('Title and Code content are required.');
      return;
    }

    try {
      const entryId = editingItem ? editingItem.record.entryId : crypto.randomUUID();
      const payload: DecryptedSnippetPayload = {
        title: formData.title.trim(),
        language: formData.language,
        code: formData.code,
        description: formData.description.trim() || undefined,
        tags: formData.tags,
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
          type: 'snippet',
          encryptedPayload: ciphertext,
          nonce,
        });
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ title: '', language: 'bash', code: '', description: '', tags: [] });
      await loadSnippets();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Move snippet to Trash?')) return;
    try {
      await apiDeleteEntry(id);
      await loadSnippets();
    } catch (err) {
      console.error('Delete snippet failed:', err);
    }
  };

  const openEdit = (item: SnippetItem) => {
    setEditingItem(item);
    setFormData({
      title: item.payload.title,
      language: item.payload.language || 'bash',
      code: item.payload.code,
      description: item.payload.description || '',
      tags: item.payload.tags || [],
    });
    setIsModalOpen(true);
  };

  const addTag = () => {
    const clean = tagInput.trim().replace(/^#/, '');
    if (!clean || formData.tags.includes(clean)) return;
    setFormData({ ...formData, tags: [...formData.tags, clean] });
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((tag) => tag !== t) });
  };

  const languages = ['ALL', 'bash', 'typescript', 'javascript', 'python', 'sql', 'json', 'yaml', 'dockerfile'];

  const filteredSnippets = snippets.filter((item) => {
    const matchesLang = languageFilter === 'ALL' || item.payload.language === languageFilter;
    const matchesSearch =
      searchQuery === '' ||
      item.payload.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.payload.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.payload.tags && item.payload.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesLang && matchesSearch;
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
          <span className="text-text-secondary text-xs font-label-mono">Developer Tools</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <h1 className="text-text-primary text-xs font-medium flex items-center gap-1.5 inline-flex">
            <Code className="w-3.5 h-3.5 text-primary" />
            Code &amp; Terminal Library
          </h1>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {snippets.length} snippets
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({ title: '', language: 'bash', code: '', description: '', tags: [] });
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded bg-primary text-primary-fg hover:bg-primary-hover text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Snippet</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="h-11 px-4 bg-surface-subtle border-b border-border-subtle flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-1 overflow-x-auto mono-scroll py-1">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguageFilter(lang)}
              className={`px-2.5 py-1 rounded text-xs font-label-mono uppercase transition-colors ${
                languageFilter === lang
                  ? 'bg-surface-raised text-text-primary border border-border-muted font-medium'
                  : 'bg-surface hover:bg-surface-panel text-text-muted hover:text-text-primary border border-border-subtle'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className="relative w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or command..."
            className="w-full bg-surface-panel border border-border-subtle rounded pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
          />
        </div>
      </div>

      {/* Main Snippets Grid */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Decrypting code snippets...
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Terminal className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">No Snippets Found</h3>
            <p className="text-xs text-text-muted font-label-mono mb-4">
              Save reusable CLI commands, Docker configs, SQL queries, and scripts.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 rounded bg-primary text-primary-fg hover:bg-primary-hover text-xs font-semibold"
            >
              Add First Snippet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSnippets.map(({ record, payload }) => {
              const isCopied = copiedId === record.entryId;

              return (
                <div
                  key={record.entryId}
                  className="rounded-lg bg-surface-panel border border-border-subtle overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="p-3 bg-surface-subtle border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-label-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-primary font-bold">
                        {payload.language}
                      </span>
                      <h4 className="text-xs font-semibold text-text-primary truncate">{payload.title}</h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyCode(record.entryId, payload.code)}
                        className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised transition-colors"
                        title="Copy code"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit({ record, payload })}
                        className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised"
                        title="Edit snippet"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete to Trash - Explicitly Styled in Red */}
                      <button
                        onClick={() => handleDelete(record.entryId)}
                        className="p-1 rounded border border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive hover:text-white transition-colors"
                        title="Delete snippet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Code Block */}
                  <pre className="p-3 bg-surface font-mono text-xs text-text-primary overflow-x-auto mono-scroll max-h-48 whitespace-pre">
                    <code>{payload.code}</code>
                  </pre>

                  {/* Footer with Description and Tags */}
                  {(payload.description || (payload.tags && payload.tags.length > 0)) && (
                    <div className="p-2.5 bg-surface-subtle border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      {payload.description && (
                        <span className="text-text-muted italic truncate max-w-xs">{payload.description}</span>
                      )}
                      {payload.tags && payload.tags.length > 0 && (
                        <div className="flex gap-1 ml-auto">
                          {payload.tags.map((t) => (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Snippet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-panel border border-border-subtle rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingItem ? 'Edit Snippet' : 'New Code / Command Snippet'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs font-body-sm overflow-y-auto">
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Title / Command Description *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Docker Compose Postgres Setup"
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Language / Syntax
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent uppercase font-mono"
                >
                  {languages.filter((l) => l !== 'ALL').map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Code / Command Script *
                </label>
                <textarea
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  rows={8}
                  placeholder="#!/usr/bin/env bash\n..."
                  className="w-full bg-surface border border-border-subtle rounded p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-border-accent mono-scroll"
                />
              </div>

              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Tags
                </label>
                <div className="flex flex-wrap items-center gap-1 mb-1.5">
                  {formData.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-[11px] font-mono text-text-secondary"
                    >
                      #{t}
                      <button onClick={() => removeTag(t)} className="text-text-muted hover:text-status-danger">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="+ Add tag..."
                    className="flex-1 bg-surface border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                  />
                  <button
                    onClick={addTag}
                    type="button"
                    className="px-2.5 py-1 rounded bg-surface-raised border border-border-subtle text-xs text-text-primary"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-subtle flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSnippet}
                disabled={!formData.title.trim() || !formData.code.trim()}
                className="px-3.5 py-1.5 rounded bg-primary text-primary-fg hover:bg-primary-hover text-xs font-semibold disabled:opacity-50"
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
