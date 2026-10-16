'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  Zap,
  Plus,
  Search,
  Tag,
  ArrowRight,
  Trash2,
  Archive,
  CheckCircle2,
  Clock,
  Sparkles,
  Folder,
  FileText,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiCreateEntry,
  apiUpdateEntry,
  apiDeleteEntry,
  apiArchiveEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedIdeaPayload, DecryptedNotePayload, TEMPLATES } from '@envbook/shared';

interface IdeaItem {
  record: EntryRecord;
  payload: DecryptedIdeaPayload;
}

export default function IdeasInboxPage() {
  const router = useRouter();
  const vault = useVault();

  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'considering' | 'planned' | 'in_progress' | 'archived'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick capture form state
  const [quickTitle, setQuickTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['backend']);
  const [customTagInput, setCustomTagInput] = useState('');
  const [targetProject, setTargetProject] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const loadIdeas = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      const res = await apiGetEntries({ type: 'idea', isDeleted: false });
      const decryptedList: IdeaItem[] = [];

      for (const rec of res.entries) {
        try {
          const payload = await vault.decrypt<DecryptedIdeaPayload>(
            rec.encryptedPayload,
            rec.nonce,
            rec.entryId
          );
          decryptedList.push({ record: rec, payload });
        } catch (err) {
          console.error('[Ideas] Decrypt failure:', rec.entryId, err);
        }
      }

      setIdeas(decryptedList);
    } catch (err) {
      console.error('[Ideas] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const handleQuickCapture = async () => {
    if (!quickTitle.trim() || !vault.isUnlocked || isCapturing) return;

    try {
      setIsCapturing(true);
      const entryId = crypto.randomUUID();
      const payload: DecryptedIdeaPayload = {
        title: quickTitle.trim(),
        description: '',
        status: 'considering',
        votes: 1,
        tags: selectedTags,
        project: targetProject.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      const { ciphertext, nonce } = await vault.encrypt(payload, entryId);
      await apiCreateEntry({
        entryId,
        type: 'idea',
        encryptedPayload: ciphertext,
        nonce,
      });

      setQuickTitle('');
      await loadIdeas();
    } catch (err: any) {
      alert(`Capture failed: ${err.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleVote = async (item: IdeaItem) => {
    if (!vault.isUnlocked) return;
    try {
      const nextVotes = (item.payload.votes || 0) + 1;
      const updatedPayload: DecryptedIdeaPayload = {
        ...item.payload,
        votes: nextVotes,
      };

      const { ciphertext, nonce } = await vault.encrypt(updatedPayload, item.record.entryId);
      await apiUpdateEntry(item.record.entryId, {
        encryptedPayload: ciphertext,
        nonce,
      });

      setIdeas((prev) =>
        prev.map((i) => (i.record.entryId === item.record.entryId ? { ...i, payload: updatedPayload } : i))
      );
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleChangeStatus = async (item: IdeaItem, newStatus: DecryptedIdeaPayload['status']) => {
    if (!vault.isUnlocked) return;
    try {
      const updatedPayload: DecryptedIdeaPayload = {
        ...item.payload,
        status: newStatus,
      };

      const { ciphertext, nonce } = await vault.encrypt(updatedPayload, item.record.entryId);
      await apiUpdateEntry(item.record.entryId, {
        encryptedPayload: ciphertext,
        nonce,
      });

      await loadIdeas();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Convert Idea to full PRD Project Document
  const handleConvertToPRD = async (item: IdeaItem) => {
    if (!vault.isUnlocked) return;
    if (!confirm(`Convert idea "${item.payload.title}" into a technical PRD document?`)) return;

    try {
      const newPageId = crypto.randomUUID();
      const prdTemplate = TEMPLATES.find((t) => t.id === 'prd')?.content || '# PRD\n\n## Overview';

      const pagePayload: DecryptedNotePayload = {
        title: `PRD: ${item.payload.title}`,
        content: `# PRD: ${item.payload.title}\n\n**Origin Idea:** ${item.payload.title}\n\n${prdTemplate}`,
        tags: [...(item.payload.tags || []), 'prd', 'project'],
        createdAt: new Date().toISOString(),
      };

      const { ciphertext, nonce } = await vault.encrypt(pagePayload, newPageId);
      await apiCreateEntry({
        entryId: newPageId,
        type: 'page',
        encryptedPayload: ciphertext,
        nonce,
      });

      // Update idea status to planned
      await handleChangeStatus(item, 'planned');

      // Navigate to new PRD page
      router.push(`/app/page/${newPageId}`);
    } catch (err: any) {
      alert(`Conversion failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Move idea to Trash?')) return;
    try {
      await apiDeleteEntry(id);
      await loadIdeas();
    } catch (err) {
      console.error('Failed to delete idea:', err);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    const clean = customTagInput.trim().replace(/^#/, '');
    if (!clean || selectedTags.includes(clean)) return;
    setSelectedTags([...selectedTags, clean]);
    setCustomTagInput('');
  };

  const filteredIdeas = ideas.filter((item) => {
    const matchesStatus =
      statusFilter === 'ALL' || item.payload.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      item.payload.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.payload.tags && item.payload.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: DecryptedIdeaPayload['status']) => {
    switch (status) {
      case 'considering':
        return (
          <span className="flex items-center gap-1 text-[10px] text-status-warning bg-status-warning/10 border border-status-warning/20 px-1.5 py-0.5 rounded font-label-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
            Considering
          </span>
        );
      case 'planned':
        return (
          <span className="flex items-center gap-1 text-[10px] text-secondary bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 rounded font-label-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Planned
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-label-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            In Progress
          </span>
        );
      case 'archived':
        return (
          <span className="flex items-center gap-1 text-[10px] text-text-muted bg-surface border border-border-subtle px-1.5 py-0.5 rounded font-label-mono">
            Archived
          </span>
        );
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
          <span className="text-text-secondary text-xs font-label-mono">Workspace</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-primary text-xs font-medium flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            Ideas Inbox &amp; Quick Capture
          </span>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {ideas.length} items
          </span>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="h-11 px-4 bg-surface-subtle border-b border-border-subtle flex items-center justify-between shrink-0 gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto mono-scroll py-1">
          {[
            { id: 'ALL', label: 'All', count: ideas.length },
            { id: 'considering', label: 'Considering', count: ideas.filter((i) => i.payload.status === 'considering').length },
            { id: 'planned', label: 'Planned', count: ideas.filter((i) => i.payload.status === 'planned').length },
            { id: 'in_progress', label: 'In Progress', count: ideas.filter((i) => i.payload.status === 'in_progress').length },
            { id: 'archived', label: 'Archived', count: ideas.filter((i) => i.payload.status === 'archived').length },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-2.5 py-1 rounded text-xs font-label-ui flex items-center gap-1.5 transition-colors ${
                statusFilter === f.id
                  ? 'bg-surface-raised text-text-primary font-medium border border-border-muted shadow-sm'
                  : 'bg-surface hover:bg-surface-panel text-text-muted hover:text-text-primary border border-border-subtle'
              }`}
            >
              <span>{f.label}</span>
              <span className="text-[10px] font-label-mono opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-56 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by tag or text..."
            className="w-full bg-surface-panel border border-border-subtle rounded pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full mono-scroll space-y-6">
        {/* QUICK CAPTURE CARD MATCHING STITCH REFERENCE */}
        <div className="bg-surface-subtle border border-border-subtle rounded-lg p-4 shadow-lg transition-all focus-within:border-border-accent focus-within:ring-1 focus-within:ring-accent-emerald">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickCapture();
                  }
                }}
                placeholder="Capture an idea, technical note, or architecture thought..."
                className="w-full bg-transparent border-none p-0 text-sm font-medium text-text-primary placeholder:text-text-muted focus:ring-0 focus:outline-none"
              />
            </div>

            {/* Tags and Target Project strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-label-mono uppercase text-text-muted mr-1">Tags:</span>
                {['ai', 'database', 'backend', 'security', 'api'].map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-0.5 rounded text-[11px] font-label-mono border transition-colors ${
                        isSelected
                          ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                          : 'bg-surface-panel hover:bg-surface-raised border-border-subtle text-text-muted'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}

                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="+ Tag"
                    className="bg-transparent border border-transparent hover:border-border-subtle focus:border-border-accent rounded px-1.5 py-0.5 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none font-label-mono w-16"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-label-mono text-text-muted hidden sm:inline">
                  Press ↵ to save
                </span>
                <button
                  onClick={handleQuickCapture}
                  disabled={!quickTitle.trim() || isCapturing}
                  className="px-3 py-1 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  Capture
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ideas Grid */}
        {loading ? (
          <div className="text-center py-12 text-xs text-text-muted font-label-mono">
            Decrypting ideas inbox...
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border-subtle rounded-lg">
            <Lightbulb className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <p className="text-xs text-text-muted font-label-mono mb-2">No ideas matching the current filter.</p>
            <p className="text-[11px] text-text-muted">Use the quick capture box above to register new architectural ideas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIdeas.map((item) => (
              <div
                key={item.record.entryId}
                className="p-4 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted transition-all flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-text-primary leading-snug">
                      {item.payload.title}
                    </h4>
                    {getStatusBadge(item.payload.status)}
                  </div>

                  {/* Tags */}
                  {item.payload.tags && item.payload.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.payload.tags.map((t) => (
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

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVote(item)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-primary transition-colors text-[11px] font-label-mono"
                      title="Upvote idea"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{item.payload.votes || 1}</span>
                    </button>

                    <button
                      onClick={() => handleConvertToPRD(item)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-label-ui font-medium transition-colors"
                      title="Convert idea to technical PRD document"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Convert to PRD</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(item.record.entryId)}
                      className="p-1 text-text-muted hover:text-status-danger rounded"
                      title="Delete idea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
