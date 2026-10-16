'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
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
  Table as TableIcon,
  Eye,
  EyeOff,
  Sparkles,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  FileText,
  Folder,
  Database,
  BookOpen,
} from 'lucide-react';
import { SLASH_COMMANDS, SlashCommandItem, WorkspaceItemType } from '@envbook/shared';

interface BlockEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  isRawMarkdown?: boolean;
  onHeadingsChange?: (headings: Array<{ level: number; text: string; id: string }>) => void;
  onRequestCreateItem?: (type: WorkspaceItemType) => void;
  onOpenEnvAi?: (selectedText?: string) => void;
}

/**
 * Converts initial markdown content to formatted HTML for Tiptap
 */
function markdownToHtml(md: string): string {
  if (!md) return '<p></p>';
  if (md.startsWith('<') && md.endsWith('>')) return DOMPurify.sanitize(md);

  const lines = md.split('\n');
  const htmlParts: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.replace('```', '').trim();
        codeBuffer = [];
      } else {
        inCode = false;
        htmlParts.push(
          `<pre><code class="language-${codeLang || 'text'}">${DOMPurify.sanitize(
            codeBuffer.join('\n')
          )}</code></pre>`
        );
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      htmlParts.push(`<h1>${DOMPurify.sanitize(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      htmlParts.push(`<h2>${DOMPurify.sanitize(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      htmlParts.push(`<h3>${DOMPurify.sanitize(line.slice(4))}</h3>`);
    } else if (line.startsWith('- [ ] ')) {
      htmlParts.push(
        `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>${DOMPurify.sanitize(
          line.slice(6)
        )}</p></li></ul>`
      );
    } else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      htmlParts.push(
        `<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>${DOMPurify.sanitize(
          line.slice(6)
        )}</p></li></ul>`
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      htmlParts.push(`<ul><li><p>${DOMPurify.sanitize(line.slice(2))}</p></li></ul>`);
    } else if (/^\d+\.\s/.test(line)) {
      htmlParts.push(`<ol><li><p>${DOMPurify.sanitize(line.replace(/^\d+\.\s/, ''))}</p></li></ol>`);
    } else if (line.startsWith('> ')) {
      htmlParts.push(`<blockquote><p>${DOMPurify.sanitize(line.slice(2))}</p></blockquote>`);
    } else if (line === '---' || line === '***') {
      htmlParts.push('<hr>');
    } else if (line.trim().length > 0) {
      htmlParts.push(`<p>${DOMPurify.sanitize(line)}</p>`);
    } else {
      htmlParts.push('<p></p>');
    }
  }

  return htmlParts.join('');
}

function getFilteredCommands(filter: string): SlashCommandItem[] {
  if (!filter) return SLASH_COMMANDS;
  const f = filter.toLowerCase().trim();
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(f) ||
      cmd.label.toLowerCase().includes(f) ||
      cmd.aliases.some((a) => a.toLowerCase().includes(f)) ||
      cmd.category.toLowerCase().includes(f)
  );
}

export function BlockEditor({
  content,
  onChange,
  isRawMarkdown = false,
  onHeadingsChange,
  onRequestCreateItem,
  onOpenEnvAi,
}: BlockEditorProps) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [slashRange, setSlashRange] = useState<{ from: number; to: number } | null>(null);

  // Raw Markdown textarea fallback (for explicit View -> Raw Markdown)
  const [rawText, setRawText] = useState(content || '');

  const slashMenuRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Synchronized refs to avoid stale closures in ProseMirror handleKeyDown
  const slashMenuOpenRef = useRef(false);
  const filteredCommandsRef = useRef<SlashCommandItem[]>(SLASH_COMMANDS);
  const slashIndexRef = useRef(0);
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);
  const executeCommandRef = useRef<(cmd: SlashCommandItem) => void>(() => {});

  const filteredCommands = getFilteredCommands(slashFilter);

  // Sync refs on every render
  slashMenuOpenRef.current = slashMenuOpen;
  filteredCommandsRef.current = filteredCommands;
  slashIndexRef.current = slashIndex;
  slashRangeRef.current = slashRange;

  // Slash command detector (called on document edit and selection change)
  const detectSlashCommand = useCallback((ed: any) => {
    if (!ed || ed.isDestroyed) return;
    const { selection } = ed.state;
    const { $from } = selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
    const lastSlash = textBefore.lastIndexOf('/');

    if (lastSlash !== -1 && (lastSlash === 0 || textBefore[lastSlash - 1] === ' ')) {
      const query = textBefore.slice(lastSlash + 1);
      if (!query.startsWith(' ') && query.length <= 25) {
        try {
          const coords = ed.view.coordsAtPos($from.pos);
          const containerRect = editorContainerRef.current?.getBoundingClientRect();

          if (containerRect) {
            const menuHeight = 280;
            const spaceBelow = window.innerHeight - coords.bottom;
            const showAbove = spaceBelow < menuHeight && coords.top > menuHeight;

            setSlashPosition({
              top: showAbove
                ? Math.max(10, coords.top - containerRect.top - menuHeight)
                : Math.max(10, coords.bottom - containerRect.top + 8),
              left: Math.max(10, Math.min(coords.left - containerRect.left, containerRect.width - 330)),
            });
          }

          const from = $from.pos - query.length - 1;
          const to = $from.pos;
          const matching = getFilteredCommands(query);

          setSlashRange({ from, to });
          slashRangeRef.current = { from, to };
          setSlashFilter(query);
          filteredCommandsRef.current = matching;
          setSlashIndex(0);
          slashIndexRef.current = 0;
          setSlashMenuOpen(true);
          slashMenuOpenRef.current = true;
          return;
        } catch {
          // ignore coords calculation error
        }
      }
    }

    if (slashMenuOpenRef.current) {
      setSlashMenuOpen(false);
      slashMenuOpenRef.current = false;
    }
  }, []);

  // Initialize Tiptap WYSIWYG Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands or start writing in Markdown...",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: markdownToHtml(content),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[480px] p-6 text-sm text-text-primary leading-relaxed',
      },
      handleKeyDown: (_view, event) => {
        // Intercept keys directly in ProseMirror before default splitBlock / newlines occur
        if (slashMenuOpenRef.current) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            const list = filteredCommandsRef.current;
            if (list.length > 0) {
              const nextIdx = (slashIndexRef.current + 1) % list.length;
              slashIndexRef.current = nextIdx;
              setSlashIndex(nextIdx);
            }
            return true;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            const list = filteredCommandsRef.current;
            if (list.length > 0) {
              const prevIdx = (slashIndexRef.current - 1 + list.length) % list.length;
              slashIndexRef.current = prevIdx;
              setSlashIndex(prevIdx);
            }
            return true;
          }

          if (event.key === 'Enter' || event.key === 'Tab') {
            const list = filteredCommandsRef.current;
            const cmd = list[slashIndexRef.current];
            if (cmd) {
              event.preventDefault();
              executeCommandRef.current(cmd);
              return true;
            } else {
              setSlashMenuOpen(false);
              slashMenuOpenRef.current = false;
            }
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setSlashMenuOpen(false);
            slashMenuOpenRef.current = false;
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html);

      // Extract headings for Table of Contents
      if (onHeadingsChange) {
        const extracted: Array<{ level: number; text: string; id: string }> = [];
        ed.state.doc.descendants((node) => {
          if (node.type.name === 'heading') {
            const level = node.attrs.level || 1;
            const text = node.textContent;
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            extracted.push({ level, text, id });
          }
        });
        onHeadingsChange(extracted);
      }

      detectSlashCommand(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      detectSlashCommand(ed);
    },
  });

  // Execute selected slash command
  const executeCommand = useCallback(
    (cmd: SlashCommandItem) => {
      if (!editor) return;

      const range = slashRangeRef.current;
      setSlashMenuOpen(false);
      slashMenuOpenRef.current = false;

      // 1. Workspace Item Creation Commands
      if (['page', 'section', 'notes-page', 'environment', 'notes-section'].includes(cmd.id)) {
        if (range && range.from >= 0 && range.to <= editor.state.doc.content.size && range.from <= range.to) {
          editor.chain().focus().deleteRange(range).run();
        }
        if (onRequestCreateItem) {
          if (cmd.id === 'page' || cmd.id === 'notes-page') onRequestCreateItem('notes_page');
          else if (cmd.id === 'section') onRequestCreateItem('section');
          else if (cmd.id === 'environment') onRequestCreateItem('environment_page');
          else if (cmd.id === 'notes-section') onRequestCreateItem('notes_section');
        }
        return;
      }

      // 2. Editor Formatting & Block Commands
      let chain = editor.chain().focus();
      if (range && range.from >= 0 && range.to <= editor.state.doc.content.size && range.from <= range.to) {
        chain = chain.deleteRange(range);
      }

      switch (cmd.id) {
        case 'h1':
          chain.setHeading({ level: 1 }).run();
          break;
        case 'h2':
          chain.setHeading({ level: 2 }).run();
          break;
        case 'h3':
          chain.setHeading({ level: 3 }).run();
          break;
        case 'bulleted-list':
          chain.toggleBulletList().run();
          break;
        case 'numbered-list':
          chain.toggleOrderedList().run();
          break;
        case 'todo':
          chain.toggleTaskList().run();
          break;
        case 'code':
        case 'terminal':
        case 'env':
        case 'credential':
          chain.toggleCodeBlock().run();
          break;
        case 'quote':
        case 'callout':
          chain.toggleBlockquote().run();
          break;
        case 'divider':
          chain.setHorizontalRule().run();
          break;
        case 'table':
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        case 'bold':
          chain.toggleBold().run();
          break;
        case 'italic':
          chain.toggleItalic().run();
          break;
        case 'inline-code':
          chain.toggleCode().run();
          break;
        case 'envai':
          if (onOpenEnvAi) {
            const selText = editor.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to,
              ' '
            );
            onOpenEnvAi(selText);
          }
          break;
        case 'text':
        default:
          chain.setParagraph().run();
          break;
      }
    },
    [editor, onRequestCreateItem, onOpenEnvAi]
  );

  executeCommandRef.current = executeCommand;

  // Keep editor content in sync when external content prop updates
  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    if (content && content !== currentHTML && content !== rawText) {
      setRawText(content);
      editor.commands.setContent(markdownToHtml(content));
    }
  }, [content, editor, rawText]);

  // Auto-scroll selected command item into view
  useEffect(() => {
    if (slashMenuOpen && slashMenuRef.current) {
      const selectedEl = slashMenuRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [slashIndex, slashMenuOpen]);

  // Click outside listener to dismiss slash menu
  useEffect(() => {
    if (!slashMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node) &&
        editorContainerRef.current &&
        !editorContainerRef.current.contains(e.target as Node)
      ) {
        setSlashMenuOpen(false);
        slashMenuOpenRef.current = false;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [slashMenuOpen]);

  // Handle Raw Markdown toggle
  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    onChange(val);
  };

  return (
    <div ref={editorContainerRef} className="relative w-full max-w-[860px] mx-auto flex flex-col gap-3">
      {/* Floating Slash Command Picker anchored near Caret */}
      {slashMenuOpen && (
        <div
          ref={slashMenuRef}
          style={{ top: `${slashPosition.top}px`, left: `${slashPosition.left}px` }}
          className="absolute w-80 bg-surface-panel border border-border-muted rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.85)] z-50 overflow-hidden flex flex-col animate-in fade-in duration-100"
        >
          <div className="px-3 py-2 border-b border-border-subtle bg-surface-subtle flex items-center justify-between">
            <span className="font-mono text-text-muted text-[10px] uppercase tracking-wider font-semibold">
              Insert Block
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
                  data-selected={isSelected ? 'true' : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Keep editor focus
                    executeCommand(cmd);
                  }}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => {
                    setSlashIndex(idx);
                    slashIndexRef.current = idx;
                  }}
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
                No blocks matching &quot;{slashFilter}&quot;
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

      {/* Primary Notion-Style Inline WYSIWYG Canvas vs Optional Raw Markdown Source */}
      {isRawMarkdown ? (
        <div className="w-full flex flex-col gap-2">
          <div className="font-mono text-xs text-text-muted px-3 py-1.5 bg-surface-panel rounded border border-border-subtle flex items-center justify-between">
            <span>Raw Markdown Source View</span>
            <span className="text-accent-emerald font-semibold font-mono text-[11px]">Direct Edit</span>
          </div>
          <textarea
            value={rawText}
            onChange={handleRawChange}
            placeholder="Type raw Markdown..."
            rows={24}
            className="w-full p-4 bg-[#090d13] border border-border-subtle rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted/60 focus:border-accent-emerald focus:ring-1 focus:ring-accent-emerald leading-relaxed custom-scroll"
          />
        </div>
      ) : (
        /* Genuine Inline WYSIWYG Block Editor Canvas */
        <article className="w-full bg-surface-subtle border border-border-subtle rounded-xl shadow-sm min-h-[500px] overflow-hidden focus-within:border-border-muted transition-colors">
          <EditorContent editor={editor} />
        </article>
      )}
    </div>
  );
}
