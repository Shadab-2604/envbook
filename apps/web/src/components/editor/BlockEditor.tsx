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
  GripVertical,
  Trash2,
} from 'lucide-react';
import { SLASH_COMMANDS, SlashCommandItem, WorkspaceItemType } from '@envbook/shared';
import { CustomCodeBlock } from './CodeBlockView';
import { ChildPageNode } from './ChildPageNode';
import { apiDeleteEntry } from '@/lib/api';

interface BlockEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  isRawMarkdown?: boolean;
  onHeadingsChange?: (headings: Array<{ level: number; text: string; id: string }>) => void;
  onRequestCreateItem?: (type: WorkspaceItemType) => void;
  onRequestCreateChildPage?: (onCreated: (child: { id: string; title: string }) => void) => void;
  onOpenEnvAi?: (selectedText?: string) => void;
}

/**
 * Converts initial markdown content to formatted HTML for Tiptap
 */
function markdownToHtml(md: string): string {
  const trimmed = (md || '').trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return DOMPurify.sanitize(trimmed, {
      ADD_TAGS: ['div', 'span', 'pre', 'code', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'hr', 'a'],
      ADD_ATTR: ['class', 'href', 'target', 'data-type', 'data-page-id', 'data-page-title'],
    });
  }

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
        codeLang = line.replace('```', '').trim() || 'plaintext';
        codeBuffer = [];
      } else {
        inCode = false;
        htmlParts.push(
          `<pre><code class="language-${codeLang || 'plaintext'}">${DOMPurify.sanitize(
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

    if (line.includes('data-type="child-page"')) {
      htmlParts.push(
        DOMPurify.sanitize(line, {
          ADD_TAGS: ['div', 'span', 'a'],
          ADD_ATTR: ['class', 'href', 'target', 'data-type', 'data-page-id', 'data-page-title'],
        })
      );
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
  onRequestCreateChildPage,
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
  const articleRef = useRef<HTMLElement>(null);

  // Notion-Style Block Selection State
  const [selectedBlockIndices, setSelectedBlockIndices] = useState<Set<number>>(new Set());
  const selectedBlockIndicesRef = useRef<Set<number>>(new Set());
  selectedBlockIndicesRef.current = selectedBlockIndices;

  const [anchorBlockIndex, setAnchorBlockIndex] = useState<number | null>(null);
  const anchorBlockIndexRef = useRef<number | null>(null);
  anchorBlockIndexRef.current = anchorBlockIndex;

  const [hoveredBlock, setHoveredBlock] = useState<{ index: number; top: number } | null>(null);
  const isDraggingSelectionRef = useRef<boolean>(false);
  const deleteSelectedBlocksRef = useRef<() => Promise<void>>(() => Promise.resolve());

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
        codeBlock: false,
      }),
      CustomCodeBlock,
      ChildPageNode,
      Placeholder.configure({
        placeholder: "Write something, or press '/' for commands...",
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
        class: 'focus:outline-none min-h-[140px] pl-6 sm:pl-7 pr-1 py-1 text-sm sm:text-base text-text-primary leading-relaxed',
      },
      handleKeyDown: (_view, event) => {
        // Intercept block selection keys (Delete, Backspace, Esc, Shift+Arrow)
        if (selectedBlockIndicesRef.current.size > 0) {
          if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            deleteSelectedBlocksRef.current();
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setSelectedBlockIndices(new Set());
            setAnchorBlockIndex(null);
            return true;
          }
          if (event.key === 'ArrowDown' && event.shiftKey) {
            event.preventDefault();
            const list = Array.from(selectedBlockIndicesRef.current);
            const maxIdx = Math.max(...list);
            if (_view.state.doc.childCount > 0 && maxIdx < _view.state.doc.childCount - 1) {
              const next = new Set(selectedBlockIndicesRef.current);
              next.add(maxIdx + 1);
              setSelectedBlockIndices(next);
            }
            return true;
          }
          if (event.key === 'ArrowUp' && event.shiftKey) {
            event.preventDefault();
            const list = Array.from(selectedBlockIndicesRef.current);
            const minIdx = Math.min(...list);
            if (minIdx > 0) {
              const next = new Set(selectedBlockIndicesRef.current);
              next.add(minIdx - 1);
              setSelectedBlockIndices(next);
            }
            return true;
          }
        }

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
      // Clear block selection when user clicks inside text to edit
      if (!isDraggingSelectionRef.current && selectedBlockIndicesRef.current.size > 0) {
        setSelectedBlockIndices(new Set());
        setAnchorBlockIndex(null);
      }
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
        if (cmd.id === 'page' || cmd.id === 'notes-page') {
          if (onRequestCreateChildPage) {
            onRequestCreateChildPage((child) => {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'childPage',
                  attrs: {
                    pageId: child.id,
                    title: child.title,
                  },
                })
                .run();
            });
            return;
          }
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
          chain.setCodeBlock({ language: 'plaintext' }).run();
          break;
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

  // Notion-Style Block Selection & Deletion Logic
  const deleteSelectedBlocks = useCallback(async () => {
    if (!editor || editor.isDestroyed || selectedBlockIndicesRef.current.size === 0) return;

    const doc = editor.state.doc;
    const indices = Array.from(selectedBlockIndicesRef.current).sort((a, b) => a - b);

    // 1. Identify any subpages in the selected blocks
    const subpagesToDelete: Array<{ pageId: string; title: string }> = [];

    indices.forEach((idx) => {
      if (idx < doc.childCount) {
        const child = doc.child(idx);
        if (child.type.name === 'childPage' && child.attrs.pageId) {
          subpagesToDelete.push({
            pageId: child.attrs.pageId,
            title: child.attrs.title || 'Untitled Subpage',
          });
        } else {
          child.descendants((nested) => {
            if (nested.type.name === 'childPage' && nested.attrs.pageId) {
              subpagesToDelete.push({
                pageId: nested.attrs.pageId,
                title: nested.attrs.title || 'Untitled Subpage',
              });
            }
          });
        }
      }
    });

    // 2. Prompt confirmation ONLY if subpages are present
    if (subpagesToDelete.length > 0) {
      const titles = subpagesToDelete.map((s) => `"${s.title}"`).join(', ');
      const confirmMsg =
        subpagesToDelete.length === 1
          ? `Move subpage ${titles} to Trash? You can restore it later from Trash.`
          : `Move ${subpagesToDelete.length} subpages (${titles}) to Trash? You can restore them later from Trash.`;

      if (!confirm(confirmMsg)) {
        return;
      }

      try {
        for (const sp of subpagesToDelete) {
          await apiDeleteEntry(sp.pageId);
          window.dispatchEvent(
            new CustomEvent('envbook:subpage-deleted', { detail: { pageId: sp.pageId } })
          );
        }
        window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
      } catch (err: any) {
        console.error('[BlockEditor] Error deleting subpages:', err);
        alert(`Failed to delete subpage record: ${err.message || 'Server error'}`);
        return;
      }
    }

    // 3. Compute ProseMirror block ranges
    const blockRanges: Array<{ from: number; to: number }> = [];
    let curPos = 0;
    for (let i = 0; i < doc.childCount; i++) {
      const child = doc.child(i);
      const from = curPos;
      const to = curPos + child.nodeSize;
      if (selectedBlockIndicesRef.current.has(i)) {
        blockRanges.push({ from, to });
      }
      curPos += child.nodeSize;
    }

    if (blockRanges.length === 0) return;

    // 4. Delete blocks safely
    const isDeletingEntireDoc = selectedBlockIndicesRef.current.size >= doc.childCount;
    if (isDeletingEntireDoc) {
      editor.commands.setContent('<p></p>');
    } else {
      blockRanges.sort((a, b) => b.from - a.from);
      const tr = editor.state.tr;
      for (const range of blockRanges) {
        tr.delete(range.from, range.to);
      }
      editor.view.dispatch(tr);
    }

    // 5. Clear selection
    setSelectedBlockIndices(new Set());
    setAnchorBlockIndex(null);
    anchorBlockIndexRef.current = null;
    setHoveredBlock(null);

    // 6. Notify parent of content change
    onChange(editor.getHTML());
  }, [editor, onChange]);

  deleteSelectedBlocksRef.current = deleteSelectedBlocks;

  // Update data-block-selected attribute on DOM elements
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    if (!dom) return;

    const children = Array.from(dom.children);
    children.forEach((child, idx) => {
      if (selectedBlockIndices.has(idx)) {
        child.setAttribute('data-block-selected', 'true');
      } else {
        child.removeAttribute('data-block-selected');
      }
    });
  }, [selectedBlockIndices, editor]);

  // Handle dragging selection across blocks
  const handleDragSelection = useCallback((clientY: number) => {
    if (!isDraggingSelectionRef.current || anchorBlockIndexRef.current === null) return;
    if (!editor || editor.isDestroyed) return;

    const dom = editor.view.dom;
    if (!dom) return;
    const children = Array.from(dom.children) as HTMLElement[];
    if (children.length === 0) return;

    let targetIndex = -1;
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      const firstR = children[0].getBoundingClientRect();
      const lastR = children[children.length - 1].getBoundingClientRect();
      if (clientY < firstR.top) targetIndex = 0;
      else if (clientY > lastR.bottom) targetIndex = children.length - 1;
    }

    if (targetIndex !== -1) {
      const start = Math.min(anchorBlockIndexRef.current, targetIndex);
      const end = Math.max(anchorBlockIndexRef.current, targetIndex);
      const nextSet = new Set<number>();
      for (let i = start; i <= end; i++) {
        nextSet.add(i);
      }
      setSelectedBlockIndices(nextSet);
    }
  }, [editor]);

  // Handle clicking on the block handle
  const handleHandleMouseDown = (e: React.MouseEvent, blockIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey && anchorBlockIndexRef.current !== null) {
      const start = Math.min(anchorBlockIndexRef.current, blockIndex);
      const end = Math.max(anchorBlockIndexRef.current, blockIndex);
      const nextSet = new Set<number>();
      for (let i = start; i <= end; i++) {
        nextSet.add(i);
      }
      setSelectedBlockIndices(nextSet);
    } else {
      setSelectedBlockIndices(new Set([blockIndex]));
      setAnchorBlockIndex(blockIndex);
      anchorBlockIndexRef.current = blockIndex;
    }

    isDraggingSelectionRef.current = true;
  };

  // Article mouse move to track hover and dragging
  const handleArticleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSelectionRef.current) {
      handleDragSelection(e.clientY);
      return;
    }

    if (!editor || editor.isDestroyed || !articleRef.current) return;
    const dom = editor.view.dom;
    if (!dom) return;

    const articleRect = articleRef.current.getBoundingClientRect();
    const children = Array.from(dom.children) as HTMLElement[];
    let foundIndex = -1;
    let foundTop = 0;

    for (let i = 0; i < children.length; i++) {
      const childRect = children[i].getBoundingClientRect();
      if (e.clientY >= childRect.top && e.clientY <= childRect.bottom) {
        foundIndex = i;
        foundTop = childRect.top - articleRect.top + articleRef.current.scrollTop + 4;
        break;
      }
    }

    if (foundIndex !== -1) {
      setHoveredBlock({ index: foundIndex, top: foundTop });
    } else {
      setHoveredBlock(null);
    }
  };

  const handleArticleMouseLeave = () => {
    if (!isDraggingSelectionRef.current) {
      setHoveredBlock(null);
    }
  };

  // Mouse down in left gutter to start drag selection
  const handleArticleMouseDown = (e: React.MouseEvent) => {
    if (!articleRef.current || !editor || editor.isDestroyed) return;
    const articleRect = articleRef.current.getBoundingClientRect();
    const relativeX = e.clientX - articleRect.left;

    // If clicked in left gutter (first 38px)
    if (relativeX <= 38 && relativeX >= 0) {
      e.preventDefault();
      const dom = editor.view.dom;
      if (!dom) return;
      const children = Array.from(dom.children) as HTMLElement[];
      for (let i = 0; i < children.length; i++) {
        const childRect = children[i].getBoundingClientRect();
        if (e.clientY >= childRect.top && e.clientY <= childRect.bottom) {
          if (e.shiftKey && anchorBlockIndexRef.current !== null) {
            const start = Math.min(anchorBlockIndexRef.current, i);
            const end = Math.max(anchorBlockIndexRef.current, i);
            const nextSet = new Set<number>();
            for (let k = start; k <= end; k++) nextSet.add(k);
            setSelectedBlockIndices(nextSet);
          } else {
            setSelectedBlockIndices(new Set([i]));
            setAnchorBlockIndex(i);
            anchorBlockIndexRef.current = i;
          }
          isDraggingSelectionRef.current = true;
          break;
        }
      }
    }
  };

  // Global mouseup to terminate block drag selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingSelectionRef.current = false;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Global keydown for block deletion and keyboard navigation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (selectedBlockIndicesRef.current.size === 0) return;

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        !activeEl.closest('.ProseMirror');
      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedBlocksRef.current();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedBlockIndices(new Set());
        setAnchorBlockIndex(null);
        return;
      }

      if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();
        if (!editor || editor.isDestroyed) return;
        const maxIdx = Math.max(...Array.from(selectedBlockIndicesRef.current));
        if (maxIdx < editor.state.doc.childCount - 1) {
          const next = new Set(selectedBlockIndicesRef.current);
          next.add(maxIdx + 1);
          setSelectedBlockIndices(next);
        }
        return;
      }

      if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();
        const minIdx = Math.min(...Array.from(selectedBlockIndicesRef.current));
        if (minIdx > 0) {
          const next = new Set(selectedBlockIndicesRef.current);
          next.add(minIdx - 1);
          setSelectedBlockIndices(next);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editor]);

  return (
    <div ref={editorContainerRef} className="relative w-full max-w-[860px] mx-auto flex flex-col gap-2">
      {/* Floating Slash Command Picker anchored near Caret */}
      {slashMenuOpen && (
        <div
          ref={slashMenuRef}
          style={{ top: `${slashPosition.top}px`, left: `${slashPosition.left}px` }}
          className="absolute w-80 bg-surface-elevated border border-border-muted rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in duration-100"
        >
          <div className="px-3 py-2 border-b border-border-subtle bg-surface-panel flex items-center justify-between">
            <span className="font-mono text-text-muted text-[10px] uppercase tracking-wider font-semibold">
              Insert Block
            </span>
            <span className="font-mono text-primary text-[10px]">
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
                      ? 'bg-surface-raised border-l-2 border-primary text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-primary font-bold text-xs shrink-0">
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
                  <kbd className="font-mono text-[10px] bg-surface-panel border border-border-muted px-1 rounded text-text-muted shrink-0 ml-2">
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

          <div className="px-3 py-1.5 border-t border-border-subtle bg-surface-panel flex items-center justify-between font-mono text-text-muted text-[10px]">
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
          <div className="font-mono text-xs text-text-muted px-3 py-1.5 bg-surface-panel rounded border border-border-muted flex items-center justify-between">
            <span>Raw Markdown Source View</span>
            <span className="text-primary font-semibold font-mono text-[11px]">Direct Edit</span>
          </div>
          <textarea
            value={rawText}
            onChange={handleRawChange}
            placeholder="Type raw Markdown..."
            rows={24}
            className="w-full p-4 bg-surface-panel border border-border-muted rounded-lg font-mono text-xs text-text-primary placeholder:text-text-muted/60 focus:border-border-focus focus:ring-1 focus:ring-border-focus leading-relaxed custom-scroll"
          />
        </div>
      ) : (
        /* Genuine Inline WYSIWYG Block Editor Canvas directly on page canvas */
        <article
          ref={articleRef}
          onMouseMove={handleArticleMouseMove}
          onMouseLeave={handleArticleMouseLeave}
          onMouseDown={handleArticleMouseDown}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.ProseMirror') && !target.closest('.slash-command-picker')) {
              if (editor && !editor.isFocused) {
                editor.commands.focus('end');
              }
            }
          }}
          className="relative w-full cursor-text"
        >
          {/* Notion-style floating block handle */}
          {hoveredBlock !== null && (
            <div
              role="button"
              aria-label="Select block"
              title="Click to select block (Shift-click to extend, Drag to select)"
              style={{ top: `${hoveredBlock.top}px` }}
              onMouseDown={(e) => handleHandleMouseDown(e, hoveredBlock.index)}
              className={`absolute left-0 w-5 h-5 -mt-0.5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing transition-all z-20 group select-none ${
                selectedBlockIndices.has(hoveredBlock.index)
                  ? 'bg-primary text-surface-canvas border border-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover border border-transparent hover:border-border-subtle'
              }`}
            >
              <GripVertical className="w-3.5 h-3.5 group-hover:text-text-primary transition-colors" />
            </div>
          )}

          {/* Editor Content Canvas */}
          <EditorContent editor={editor} />

          {/* Floating Action Pill when blocks are selected */}
          {selectedBlockIndices.size > 0 && (
            <div className="sticky bottom-6 mx-auto w-fit px-4 py-2 bg-surface-elevated/95 backdrop-blur border border-border-muted rounded-full shadow-2xl flex items-center gap-3 text-xs z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-1.5 text-text-primary font-medium">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>
                  {selectedBlockIndices.size} block{selectedBlockIndices.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="h-3 w-[1px] bg-border-subtle" />
              <button
                type="button"
                onClick={deleteSelectedBlocks}
                className="btn-destructive flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors shadow-sm"
                title="Delete selected blocks (Delete or Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
                <kbd className="font-mono text-[9px] bg-black/20 text-white px-1 rounded">Del</kbd>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBlockIndices(new Set());
                  setAnchorBlockIndex(null);
                }}
                className="text-text-muted hover:text-text-primary px-1.5 py-1 text-xs transition-colors"
                title="Clear selection (Esc)"
              >
                Deselect
              </button>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
