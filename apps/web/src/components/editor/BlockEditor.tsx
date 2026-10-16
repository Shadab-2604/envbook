'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  Code,
  Terminal,
  Key,
  ShieldAlert,
  Copy,
  Check,
  ChevronRight,
  List,
  CheckSquare,
  AlertTriangle,
  Send,
  Table,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { SLASH_COMMANDS, SlashCommandItem } from '@envbook/shared';

interface BlockEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  isRawMarkdown?: boolean;
  onHeadingsChange?: (headings: Array<{ level: number; text: string; id: string }>) => void;
}

export function BlockEditor({
  content,
  onChange,
  isRawMarkdown = false,
  onHeadingsChange,
}: BlockEditorProps) {
  const [editorText, setEditorText] = useState(content || '');
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // Sync external content changes
  useEffect(() => {
    setEditorText(content || '');
  }, [content]);

  // Extract headings for Table of Contents
  useEffect(() => {
    if (!onHeadingsChange) return;

    const lines = editorText.split('\n');
    const extracted: Array<{ level: number; text: string; id: string }> = [];

    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        extracted.push({ level, text, id });
      }
    });

    onHeadingsChange(extracted);
  }, [editorText, onHeadingsChange]);

  const updateText = useCallback(
    (newText: string) => {
      setEditorText(newText);
      onChange(newText);
    },
    [onChange]
  );

  // Handle typing & Markdown shortcuts
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPosition(pos);

    // Detect slash trigger
    const textBeforeCursor = val.slice(0, pos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

    if (
      lastSlashIndex !== -1 &&
      (lastSlashIndex === 0 || textBeforeCursor[lastSlashIndex - 1] === '\n' || textBeforeCursor[lastSlashIndex - 1] === ' ')
    ) {
      const filter = textBeforeCursor.slice(lastSlashIndex + 1);
      if (!filter.includes('\n') && filter.length <= 15) {
        setSlashFilter(filter);
        setSlashMenuOpen(true);
        setSlashIndex(0);
        updateText(val);
        return;
      }
    }

    setSlashMenuOpen(false);
    updateText(val);
  };

  const filteredCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!slashFilter) return true;
    const f = slashFilter.toLowerCase();
    return (
      cmd.command.toLowerCase().includes(f) ||
      cmd.label.toLowerCase().includes(f) ||
      cmd.aliases.some((a) => a.toLowerCase().includes(f)) ||
      cmd.category.toLowerCase().includes(f)
    );
  });

  const insertCommand = (cmd: SlashCommandItem) => {
    const text = editorText;
    const textBefore = text.slice(0, cursorPosition);
    const lastSlashIndex = textBefore.lastIndexOf('/');

    let snippet = '';

    switch (cmd.id) {
      case 'h1':
        snippet = '# Heading 1\n';
        break;
      case 'h2':
        snippet = '## Heading 2\n';
        break;
      case 'h3':
        snippet = '### Heading 3\n';
        break;
      case 'bulleted-list':
        snippet = '- Bullet item\n';
        break;
      case 'numbered-list':
        snippet = '1. Numbered item\n';
        break;
      case 'todo':
        snippet = '- [ ] Task item to complete\n';
        break;
      case 'quote':
        snippet = '> Quoted block content\n';
        break;
      case 'callout':
        snippet = '> [!NOTE]\n> High-security boundary callout\n';
        break;
      case 'divider':
        snippet = '\n---\n';
        break;
      case 'code':
        snippet = '```typescript\n// Code snippet\nconst key = "example";\n```\n';
        break;
      case 'terminal':
        snippet = '```bash\n$ curl -H "Authorization: Bearer <TOKEN>" https://127.0.0.1:5000/api/v1/health\n```\n';
        break;
      case 'env':
        snippet = '```env\nPORT=5000\nDATABASE_URL=postgresql://app_usr:••••••••@db.internal:5432/db\nAPI_KEY=••••••••••••••••\n```\n';
        break;
      case 'credential':
        snippet = '```credential\nprovider: AWS Secrets Manager\nkey: AWS_SECRET_ACCESS_KEY\nvalue: ••••••••••••••••••••••••\n```\n';
        break;
      case 'warning':
        snippet = '> [!WARNING]\n> Sensitive cryptographic key material must never leave local memory!\n';
        break;
      case 'api':
        snippet = '### API: /api/v1/resource\n- **Method:** POST\n- **Auth:** Bearer Token\n- **Payload:** `{"status": "active"}`\n';
        break;
      case 'table':
        snippet = '| Field | Type | Encryption |\n| --- | --- | --- |\n| id | UUID | Plaintext |\n| secret | String | AES-256-GCM |\n';
        break;
      case 'toggle':
        snippet = '<details>\n<summary>Expandable Details</summary>\n\nHidden details content.\n</details>\n';
        break;
      case 'button':
        snippet = '[🔒 Action: Lock Vault](#lock)\n';
        break;
      default:
        snippet = `${cmd.command} `;
    }

    const beforeSlash = text.slice(0, lastSlashIndex);
    const afterCursor = text.slice(cursorPosition);
    const result = beforeSlash + snippet + afterCursor;

    updateText(result);
    setSlashMenuOpen(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const nextPos = beforeSlash.length + snippet.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[slashIndex]) {
          insertCommand(filteredCommands[slashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    // Markdown typing shortcut: Tab for indenting
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newText = editorText.substring(0, start) + '  ' + editorText.substring(end);
      updateText(newText);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleCopyCode = (snippetId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(snippetId);
    setTimeout(() => setCopiedSnippetId(null), 1500);
  };

  const toggleRevealSecret = (id: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

    // Auto-remask after 15 seconds matching Stitch specification!
    setTimeout(() => {
      setRevealedSecrets((prev) => ({
        ...prev,
        [id]: false,
      }));
    }, 15000);
  };

  // Safe HTML parser for live rendered view
  const renderFormattedBlocks = () => {
    const rawLines = editorText.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];
    let codeBlockIndex = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // Code block start / end
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.replace('```', '').trim() || 'text';
          codeLines = [];
          codeBlockIndex++;
          continue;
        } else {
          // Render code block
          inCodeBlock = false;
          const codeString = codeLines.join('\n');
          const snippetId = `snippet-${codeBlockIndex}`;
          const isCopied = copiedSnippetId === snippetId;
          const isSecretBlock = codeLanguage === 'credential' || codeLanguage === 'env';
          const isRevealed = revealedSecrets[snippetId];

          elements.push(
            <div
              key={`code-${i}`}
              className="my-3 rounded border border-border-subtle bg-surface-panel overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-subtle border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-border-muted inline-block" />
                  <span className="font-mono text-primary text-xs font-medium">
                    {isSecretBlock ? 'Encrypted Environment Payload' : codeLanguage}
                  </span>
                  <span className="font-mono text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded border border-border-muted">
                    {isSecretBlock ? 'AES-256 GCM' : 'Read-Only Snippet'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isSecretBlock && (
                    <button
                      type="button"
                      onClick={() => toggleRevealSecret(snippetId)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-raised text-text-secondary hover:text-text-primary text-[11px] font-mono border border-border-muted transition-colors"
                    >
                      {isRevealed ? (
                        <>
                          <EyeOff className="w-3 h-3 text-status-warning" />
                          <span>Mask</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-accent-emerald" />
                          <span>Reveal (15s)</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyCode(snippetId, codeString)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-raised hover:bg-surface-variant border border-border-muted text-text-secondary hover:text-text-primary transition-colors text-[11px] font-mono"
                  >
                    {isCopied ? (
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
                </div>
              </div>
              {/* Content */}
              <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed bg-[#0b0e14] text-text-secondary">
                <code>
                  {isSecretBlock && !isRevealed
                    ? codeString.replace(/(=|:\s*)([^\n]+)/g, '$1 ••••••••••••••••')
                    : codeString}
                </code>
              </pre>
            </div>
          );
          continue;
        }
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        elements.push(
          <h1
            key={`h1-${i}`}
            id={line.replace('# ', '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            className="text-2xl font-bold text-text-primary mt-6 mb-2 tracking-tight"
          >
            {line.replace('# ', '')}
          </h1>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            id={line.replace('## ', '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            className="text-xl font-semibold text-text-primary mt-5 mb-2 tracking-tight"
          >
            {line.replace('## ', '')}
          </h2>
        );
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            id={line.replace('### ', '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            className="text-lg font-semibold text-text-primary mt-4 mb-1.5"
          >
            {line.replace('### ', '')}
          </h3>
        );
        continue;
      }

      // Checkbox task
      if (line.match(/^-\s+\[([ xX])\]\s+(.+)$/)) {
        const checked = line.includes('[x]') || line.includes('[X]');
        const taskText = line.replace(/^-\s+\[([ xX])\]\s+/, '');
        elements.push(
          <div key={`task-${i}`} className="flex items-center gap-2 my-1 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="rounded-sm bg-surface-panel border-border-subtle text-primary focus:ring-0"
            />
            <span className={checked ? 'line-through text-text-muted' : ''}>{taskText}</span>
          </div>
        );
        continue;
      }

      // Bullet list
      if (line.startsWith('- ')) {
        elements.push(
          <li key={`bullet-${i}`} className="ml-5 list-disc text-sm text-text-secondary my-0.5">
            {line.replace('- ', '')}
          </li>
        );
        continue;
      }

      // Numbered list
      if (line.match(/^\d+\.\s+(.+)$/)) {
        elements.push(
          <li key={`num-${i}`} className="ml-5 list-decimal text-sm text-text-secondary my-0.5">
            {line.replace(/^\d+\.\s+/, '')}
          </li>
        );
        continue;
      }

      // Callout Alert
      if (line.startsWith('> [!WARNING]')) {
        elements.push(
          <div
            key={`warn-${i}`}
            className="my-3 p-3 rounded bg-surface-panel/70 border-l-[3px] border-status-warning border-y border-r border-border-subtle flex items-start gap-2.5 text-xs text-text-primary"
          >
            <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-status-warning font-bold uppercase text-[10px]">
                High Security Warning
              </span>
              <span>{rawLines[i + 1]?.replace('> ', '') || ''}</span>
            </div>
          </div>
        );
        i++; // skip next line
        continue;
      }

      if (line.startsWith('> [!NOTE]') || line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`quote-${i}`}
            className="my-3 p-3 rounded bg-surface-panel/70 border-l-[3px] border-accent-emerald border-y border-r border-border-subtle text-sm text-text-primary"
          >
            {line.replace(/^>\s*(\[!NOTE\])?/, '')}
          </blockquote>
        );
        continue;
      }

      // Horizontal divider
      if (line.trim() === '---' || line.trim() === '***') {
        elements.push(<hr key={`hr-${i}`} className="my-6 border-border-subtle" />);
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
        continue;
      }

      // Regular Paragraph with sanitized HTML
      const cleanLine = DOMPurify.sanitize(line);
      elements.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-text-secondary my-1">
          {cleanLine}
        </p>
      );
    }

    return elements;
  };

  return (
    <div className="relative w-full max-w-[840px] mx-auto flex flex-col gap-4">
      {/* Floating Slash Command Picker */}
      {slashMenuOpen && (
        <div
          ref={slashMenuRef}
          className="absolute left-4 top-16 w-80 bg-surface-panel border border-border-muted rounded shadow-[0_8px_24px_rgba(0,0,0,0.65)] z-40 overflow-hidden flex flex-col animate-in fade-in duration-150"
        >
          <div className="px-3 py-2 border-b border-border-subtle bg-surface-subtle flex items-center justify-between">
            <span className="font-mono text-text-muted text-[10px] uppercase tracking-wider">
              Slash Commands
            </span>
            <span className="font-mono text-accent-emerald text-[10px]">
              {slashFilter ? `"${slashFilter}"` : 'Type to filter'}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto custom-scroll p-1 flex flex-col gap-0.5">
            {filteredCommands.map((cmd, idx) => {
              const isSelected = idx === slashIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => insertCommand(cmd)}
                  onMouseEnter={() => setSlashIndex(idx)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-surface-raised border-l-2 border-accent-emerald text-text-primary'
                      : 'text-text-secondary hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-accent-emerald font-bold text-xs shrink-0">
                      /
                    </span>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {cmd.label}
                      </span>
                      <span className="font-mono text-[10px] text-text-muted truncate">
                        {cmd.description}
                      </span>
                    </div>
                  </div>
                  <kbd className="font-mono text-[10px] bg-surface-subtle border border-border-muted px-1 rounded text-text-muted shrink-0 ml-2">
                    ↵
                  </kbd>
                </div>
              );
            })}

            {filteredCommands.length === 0 && (
              <div className="py-4 text-center text-text-muted font-mono text-xs">
                No commands matching &quot;{slashFilter}&quot;
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-border-subtle bg-surface-subtle flex items-center justify-between font-mono text-text-muted text-[10px]">
            <span>
              Navigate <strong className="text-text-primary">↑↓</strong>
            </span>
            <span>
              Select <strong className="text-text-primary">Enter</strong>
            </span>
            <span>
              Dismiss <strong className="text-text-primary">Esc</strong>
            </span>
          </div>
        </div>
      )}

      {/* Raw Markdown Editor Mode vs Rendered Editor Mode */}
      {isRawMarkdown ? (
        <div className="w-full flex flex-col gap-2">
          <div className="font-mono text-xs text-text-muted px-2 py-1 bg-surface-panel rounded border border-border-subtle flex items-center justify-between">
            <span>Raw Markdown Source</span>
            <span className="text-accent-emerald font-bold">Source Editing Active</span>
          </div>
          <textarea
            ref={textareaRef}
            value={editorText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Write in Markdown or type / for slash commands..."
            rows={22}
            className="w-full p-4 bg-[#0b0e14] border border-border-subtle rounded font-mono text-xs text-text-primary placeholder:text-text-muted/60 focus:border-accent-emerald focus:ring-1 focus:ring-accent-emerald leading-relaxed custom-scroll"
          />
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4">
          {/* Quick Input Bar at the top of rendered editor to continue writing */}
          <div className="relative glow-emerald-focus rounded border border-border-muted bg-surface-subtle p-3 flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={editorText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type / for slash commands (headings, code blocks, secrets, callouts, tables)..."
              rows={4}
              className="w-full bg-transparent border-0 p-0 text-sm text-text-primary placeholder:text-text-muted focus:ring-0 focus:outline-none resize-y font-sans"
            />
            <div className="flex items-center justify-between pt-2 border-t border-border-subtle font-mono text-[11px] text-text-muted">
              <span>
                Markdown supported: <strong className="text-text-secondary">#</strong> Heading,{' '}
                <strong className="text-text-secondary">-</strong> List,{' '}
                <strong className="text-text-secondary">```</strong> Code,{' '}
                <strong className="text-accent-emerald">/</strong> Slash menu
              </span>
              <span>{editorText.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          {/* Rendered View Canvas */}
          <article className="w-full p-6 bg-surface-subtle border border-border-subtle rounded-lg shadow-sm min-h-[400px]">
            {renderFormattedBlocks()}
          </article>
        </div>
      )}
    </div>
  );
}
