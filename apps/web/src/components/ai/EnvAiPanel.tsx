'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Upload,
  FileText,
  FileCode,
  Image as ImageIcon,
  AlertTriangle,
  Check,
  Copy,
  RotateCcw,
  BookOpen,
  ArrowDownToLine,
  FilePlus,
  ShieldAlert,
  ChevronDown,
  Info,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import {
  ENVAI_ACTIONS,
  EnvAiAction,
  EnvAiScope,
  EnvAiTone,
  EnvAiCitation,
  EnvAiConfigStatus,
  DEFAULT_GEMINI_MODEL,
} from '@envbook/shared';
import { apiGetEnvAiStatus, apiGenerateEnvAi } from '@/lib/api';

interface EnvAiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentNoteId: string;
  currentNoteTitle: string;
  currentNoteContent: string;
  currentNoteType?: string;
  selectedText?: string;
  onApplyToNote: (
    action: 'insert' | 'append' | 'replace_selected' | 'replace_note' | 'create_new_note',
    text: string
  ) => void;
}

interface AttachedFile {
  name: string;
  type: string;
  content: string; // text content or base64 data
  isBase64?: boolean;
  size: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: EnvAiAction;
  citations?: EnvAiCitation[];
  redactedCount?: number;
  timestamp: string;
}

const ACTION_LABELS: Record<EnvAiAction, { label: string; desc: string }> = {
  brainstorm: { label: 'Brainstorm Ideas', desc: 'Generate concepts, architecture options, and angles' },
  title: { label: 'Generate Titles', desc: 'Create 5-8 descriptive and punchy note titles' },
  expand: { label: 'Expand to Proposal', desc: 'Turn brief thoughts into a structured technical draft' },
  prd: { label: 'Generate PRD', desc: 'Create full Product Requirements Document' },
  outline: { label: 'Create Outline', desc: 'Hierarchical structure with sections and checklists' },
  summarize: { label: 'Executive Summary', desc: 'Key takeaways and bullet point digest' },
  improve: { label: 'Improve Writing', desc: 'Refine clarity, precision, and technical flow' },
  continue: { label: 'Continue Writing', desc: 'Smoothly draft the next logical paragraph' },
  shorten: { label: 'Shorten & Condense', desc: 'Cut length in half while keeping essential facts' },
  expand_length: { label: 'Deep Dive', desc: 'Elaborate with technical depth and practical examples' },
  explain_code: { label: 'Explain Code', desc: 'Architecture, logic breakdown, and caveats' },
  cybersecurity: { label: 'Cyber Review', desc: 'Authorized defensive, blue/red team analysis' },
  tone: { label: 'Rewrite Tone', desc: 'Shift tone to technical, formal, or concise' },
  custom: { label: 'Custom Instruction', desc: 'Specify your own custom prompt' },
  chat: { label: 'Free Chat', desc: 'Ask questions about your notes and files' },
};

export function EnvAiPanel({
  isOpen,
  onClose,
  currentNoteId,
  currentNoteTitle,
  currentNoteContent,
  currentNoteType = 'notes_page',
  selectedText = '',
  onApplyToNote,
}: EnvAiPanelProps) {
  const [configStatus, setConfigStatus] = useState<EnvAiConfigStatus | null>(null);
  const [scope, setScope] = useState<EnvAiScope>(selectedText ? 'selection' : 'current_note');
  const [selectedAction, setSelectedAction] = useState<EnvAiAction>('brainstorm');
  const [promptInput, setPromptInput] = useState('');
  const [tone, setTone] = useState<EnvAiTone>('technical');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestResponse, setLatestResponse] = useState<ChatMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Apply confirmation state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [pendingApplyAction, setPendingApplyAction] = useState<
    'insert' | 'append' | 'replace_selected' | 'replace_note' | 'create_new_note' | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-switch scope to selection if new text selected
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 0) {
      setScope('selection');
    }
  }, [selectedText]);

  // Load provider status on mount or open
  useEffect(() => {
    if (isOpen) {
      apiGetEnvAiStatus()
        .then((res) => setConfigStatus(res))
        .catch(() => setConfigStatus(null));
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  // File Upload Handler with Audio/Video rejection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setFileError(null);

    Array.from(files).forEach((file) => {
      // 1. Audio and Video Rejection
      if (
        file.type.startsWith('audio/') ||
        file.type.startsWith('video/') ||
        /\.(mp3|wav|ogg|m4a|flac|mp4|webm|mov|avi|mkv)$/i.test(file.name)
      ) {
        setFileError(`Audio and video files (${file.name}) are not supported by envAi. Please upload text, documents, code, or images.`);
        return;
      }

      // Max file size 10MB
      if (file.size > 10 * 1024 * 1024) {
        setFileError(`File ${file.name} exceeds the 10MB limit.`);
        return;
      }

      const reader = new FileReader();

      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.onload = () => {
          const resultStr = reader.result as string;
          // Extract base64 part
          const base64Data = resultStr.split(',')[1] || resultStr;
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
              content: base64Data,
              isBase64: true,
              size: file.size,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        // Text / Code files
        reader.onload = () => {
          const textContent = reader.result as string;
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || 'text/plain',
              content: textContent,
              isBase64: false,
              size: file.size,
            },
          ]);
        };
        reader.readAsText(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Run Generation
  const handleGenerate = async (overrideAction?: EnvAiAction) => {
    const actionToRun = overrideAction || selectedAction;
    setError(null);

    if (!configStatus?.isConfigured) {
      setError('Google Gemini is not configured. Please add your API key in Settings → envAi first.');
      return;
    }

    // Determine context text based on scope
    let contextText = '';
    if (scope === 'selection') {
      contextText = selectedText || currentNoteContent;
    } else if (scope === 'current_note') {
      contextText = currentNoteContent;
    }

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: promptInput || ACTION_LABELS[actionToRun].label,
      action: actionToRun,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await apiGenerateEnvAi({
        action: actionToRun,
        prompt: promptInput || ACTION_LABELS[actionToRun].label,
        scope,
        contextText,
        tone: actionToRun === 'tone' ? tone : undefined,
        currentNoteType,
        files: attachedFiles.map((f) => ({
          name: f.name,
          type: f.type,
          content: f.content,
          isBase64: f.isBase64,
        })),
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: res.text,
        action: actionToRun,
        citations: res.citations,
        redactedCount: res.redactedCount,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLatestResponse(assistantMessage);
      setPromptInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate response. Please check your network and Gemini API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyClick = (
    action: 'insert' | 'append' | 'replace_selected' | 'replace_note' | 'create_new_note'
  ) => {
    if (action === 'replace_note') {
      setPendingApplyAction(action);
      setApplyModalOpen(true);
    } else {
      if (latestResponse?.content) {
        onApplyToNote(action, latestResponse.content);
      }
    }
  };

  const confirmReplaceNote = () => {
    if (pendingApplyAction && latestResponse?.content) {
      onApplyToNote(pendingApplyAction, latestResponse.content);
    }
    setApplyModalOpen(false);
    setPendingApplyAction(null);
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[440px] bg-surface-panel border-l border-border-subtle shadow-2xl flex flex-col transition-transform duration-200 ease-in-out font-body-sm"
      aria-label="envAi Assistant Panel"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-border-subtle flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary text-xs tracking-tight">envAi</span>
              <span className="text-[10px] font-label-mono px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle text-text-muted">
                {configStatus?.model || DEFAULT_GEMINI_MODEL}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {configStatus?.isConfigured ? (
            <span className="flex items-center gap-1 text-[10px] font-label-mono text-accent-emerald bg-accent-emerald/10 border border-accent-emerald/30 px-1.5 py-0.5 rounded" title="Gemini API Connected">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              <span>Ready</span>
            </span>
          ) : (
            <Link
              href="/app/settings#envai"
              className="text-[10px] font-label-mono text-status-warning hover:underline flex items-center gap-1 bg-status-warning/10 border border-status-warning/30 px-1.5 py-0.5 rounded"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Configure Key</span>
            </Link>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-raised text-text-muted hover:text-text-primary transition-colors"
            title="Close envAi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scope & Action Controls */}
      <div className="p-3 border-b border-border-subtle bg-surface-subtle shrink-0 space-y-2 text-xs">
        {/* Context Scope Picker */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-label-mono uppercase text-text-muted">Context Scope</span>
          <div className="flex items-center gap-1 bg-surface-panel p-0.5 rounded border border-border-subtle text-[11px] font-label-mono">
            <button
              onClick={() => setScope('current_note')}
              className={`px-2 py-0.5 rounded transition-colors ${
                scope === 'current_note'
                  ? 'bg-primary text-surface-canvas font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Current Note
            </button>
            <button
              onClick={() => setScope('selection')}
              className={`px-2 py-0.5 rounded transition-colors ${
                scope === 'selection'
                  ? 'bg-primary text-surface-canvas font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Selection {selectedText ? `(${selectedText.slice(0, 15)}...)` : ''}
            </button>
            <button
              onClick={() => setScope('my_notes')}
              className={`px-2 py-0.5 rounded transition-colors ${
                scope === 'my_notes'
                  ? 'bg-primary text-surface-canvas font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Workspace Notes
            </button>
          </div>
        </div>

        {/* Action Quick Selector */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-label-mono uppercase text-text-muted">Writing Action</span>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value as EnvAiAction)}
            className="bg-surface-raised border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none max-w-[240px]"
          >
            {ENVAI_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {ACTION_LABELS[act].label}
              </option>
            ))}
          </select>
        </div>

        {selectedAction === 'tone' && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-label-mono uppercase text-text-muted">Target Tone</span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as EnvAiTone)}
              className="bg-surface-raised border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="technical">Technical &amp; Precise</option>
              <option value="concise">Concise &amp; Direct</option>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly &amp; Accessible</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Conversation & Output View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 mono-scroll">
        {messages.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-surface-raised border border-border-subtle text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-text-primary">What would you like to write?</h4>
              <p className="text-xs text-text-muted max-w-xs mx-auto">
                Use one-click actions, upload source documents, or type specific prompts. Raw credentials are never leaked.
              </p>
            </div>

            {/* Quick Action Pills */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-left">
              <button
                onClick={() => handleGenerate('brainstorm')}
                className="p-2.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-xs transition-colors group"
              >
                <div className="font-semibold text-text-primary group-hover:text-primary">Brainstorm Ideas</div>
                <div className="text-[10px] text-text-muted">Angles &amp; options</div>
              </button>
              <button
                onClick={() => handleGenerate('outline')}
                className="p-2.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-xs transition-colors group"
              >
                <div className="font-semibold text-text-primary group-hover:text-primary">Create Outline</div>
                <div className="text-[10px] text-text-muted">Structured sections</div>
              </button>
              <button
                onClick={() => handleGenerate('prd')}
                className="p-2.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-xs transition-colors group"
              >
                <div className="font-semibold text-text-primary group-hover:text-primary">Draft PRD</div>
                <div className="text-[10px] text-text-muted">Requirements doc</div>
              </button>
              <button
                onClick={() => handleGenerate('explain_code')}
                className="p-2.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-xs transition-colors group"
              >
                <div className="font-semibold text-text-primary group-hover:text-primary">Explain Code</div>
                <div className="text-[10px] text-text-muted">Architecture &amp; caveats</div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`space-y-2 ${
                msg.role === 'user' ? 'bg-surface-raised/40 p-3 rounded-lg border border-border-subtle' : ''
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-label-mono">
                <span className={msg.role === 'user' ? 'text-text-muted' : 'text-primary font-semibold'}>
                  {msg.role === 'user' ? 'You' : 'envAi'}
                </span>
                <span className="text-[10px] text-text-muted">{msg.timestamp}</span>
              </div>

              {/* Redacted Banner if any */}
              {msg.redactedCount && msg.redactedCount > 0 ? (
                <div className="p-2 rounded bg-status-warning/10 border border-status-warning/30 text-status-warning text-[11px] flex items-center gap-2 font-label-mono">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Notice: {msg.redactedCount} credential pattern(s) were redacted for privacy.</span>
                </div>
              ) : null}

              {/* Message Content */}
              <div className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {/* Citations if any */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2 border-t border-border-subtle/50 text-[11px] space-y-1">
                  <span className="text-[10px] font-label-mono text-text-muted uppercase">Sources Cited:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-secondary font-label-mono text-[10px]"
                      >
                        <BookOpen className="w-2.5 h-2.5 text-primary" />
                        <span>{c.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions for Assistant Response */}
              {msg.role === 'assistant' && (
                <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center gap-2">
                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className="px-2 py-1 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-muted hover:text-text-primary text-[11px] font-label-mono flex items-center gap-1 transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-accent-emerald" />
                        <span className="text-accent-emerald">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Apply to Note Dropdown / Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleApplyClick('insert')}
                      className="px-2 py-1 rounded bg-primary text-surface-canvas hover:opacity-90 text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-sm"
                      title="Insert at current editor cursor"
                    >
                      <ArrowDownToLine className="w-3 h-3" />
                      <span>Insert</span>
                    </button>

                    <button
                      onClick={() => handleApplyClick('append')}
                      className="px-2 py-1 rounded bg-surface-raised hover:bg-surface-bright border border-border-muted text-text-primary text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Append to the bottom of the note"
                    >
                      <span>Append</span>
                    </button>

                    {selectedText && (
                      <button
                        onClick={() => handleApplyClick('replace_selected')}
                        className="px-2 py-1 rounded bg-surface-raised hover:bg-surface-bright border border-border-muted text-text-primary text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        title="Replace selected text in editor"
                      >
                        <span>Replace Sel</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleApplyClick('replace_note')}
                      className="px-2 py-1 rounded bg-destructive/15 hover:bg-destructive/25 border border-destructive/30 text-destructive text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Replace the entire note with this content"
                    >
                      <span>Replace Note</span>
                    </button>

                    <button
                      onClick={() => handleApplyClick('create_new_note')}
                      className="px-2 py-1 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-secondary text-[11px] font-label-mono flex items-center gap-1 transition-colors"
                      title="Create a new note with this draft"
                    >
                      <FilePlus className="w-3 h-3 text-primary" />
                      <span>New Note</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 p-3 rounded bg-surface border border-border-subtle text-xs text-text-muted">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="font-label-mono">envAi is thinking and analyzing context...</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Generation Error</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Attachments Strip */}
      {attachedFiles.length > 0 && (
        <div className="p-2 border-t border-border-subtle bg-surface-subtle flex flex-wrap gap-1.5 shrink-0 max-h-24 overflow-y-auto">
          {attachedFiles.map((file, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-raised border border-border-subtle text-[11px] text-text-primary font-label-mono"
            >
              {file.type.startsWith('image/') ? (
                <ImageIcon className="w-3 h-3 text-primary" />
              ) : (
                <FileCode className="w-3 h-3 text-text-muted" />
              )}
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button onClick={() => removeFile(idx)} className="text-text-muted hover:text-status-danger">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {fileError && (
        <div className="px-3 py-1.5 bg-status-danger/10 border-t border-status-danger/30 text-status-danger text-[11px] font-label-mono flex items-center justify-between shrink-0">
          <span>{fileError}</span>
          <button onClick={() => setFileError(null)}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Prompt Input Form */}
      <div className="p-3 border-t border-border-subtle bg-surface shrink-0 space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              rows={2}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={`Ask envAi or specify instructions... (Ctrl+Enter)`}
              className="w-full bg-surface-raised border border-border-subtle focus:border-primary focus:outline-none rounded-lg p-2.5 text-xs text-text-primary resize-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            {/* Attachment Button */}
            <label
              className="p-2 rounded-lg bg-surface-raised hover:bg-surface-bright border border-border-subtle text-text-muted hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
              title="Attach source file or image (Audio/Video disallowed)"
            >
              <Upload className="w-4 h-4" />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.json,.csv,.pdf,.ts,.tsx,.js,.py,.go,.rs,.html,.css,image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Run Button */}
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !configStatus?.isConfigured}
              className="p-2 rounded-lg bg-primary text-surface-canvas hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center shadow-sm"
              title="Generate"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Replace Note */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-muted rounded-lg max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-status-warning">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-text-primary">Confirm Replace Note</h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              This action will completely replace the current note content with the output generated by envAi.
              (Your version history will record a snapshot before modification).
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setApplyModalOpen(false)}
                className="px-3 py-1.5 rounded bg-surface hover:bg-surface-raised border border-border-muted text-text-primary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmReplaceNote}
                className="btn-destructive px-3 py-1.5 rounded text-xs font-semibold shadow-sm"
              >
                Confirm Replace Note
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
