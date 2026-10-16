'use client';

import React, { useState, useRef, useEffect } from 'react';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlock from '@tiptap/extension-code-block';
import { Copy, Check, ChevronDown, Search, Terminal } from 'lucide-react';

import { SUPPORTED_CODE_LANGUAGES, CodeLanguage } from '@envbook/shared';
export { SUPPORTED_CODE_LANGUAGES, type CodeLanguage };

export function CodeBlockView({ node, updateAttributes, extension }: any) {
  const currentLangId = (node.attrs.language || 'plaintext').toLowerCase();
  const currentLang =
    SUPPORTED_CODE_LANGUAGES.find(
      (l) => l.id === currentLangId || l.aliases?.includes(currentLangId)
    ) || SUPPORTED_CODE_LANGUAGES[0];

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredLanguages = SUPPORTED_CODE_LANGUAGES.filter((lang) => {
    if (!filter) return true;
    const q = filter.toLowerCase().trim();
    return (
      lang.label.toLowerCase().includes(q) ||
      lang.id.toLowerCase().includes(q) ||
      lang.aliases?.some((a) => a.toLowerCase().includes(q))
    );
  });

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      setFilter('');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [dropdownOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Scroll active item into view during keyboard navigation
  useEffect(() => {
    if (dropdownOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, dropdownOpen]);

  const handleSelectLanguage = (langId: string) => {
    updateAttributes({ language: langId });
    setDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredLanguages.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? filteredLanguages.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredLanguages[selectedIndex];
      if (target) {
        handleSelectLanguage(target.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDropdownOpen(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      const text = node.textContent || '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <NodeViewWrapper className="code-block-wrapper my-3 rounded-lg border border-border-muted bg-[#0c0d0e] shadow-sm overflow-hidden select-text">
      {/* Code Block Toolbar (Notion-Style) */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle bg-surface-panel/90 text-xs select-none">
        {/* Left: Clickable Language Selector with Searchable Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-raised border border-transparent hover:border-border-subtle text-text-secondary hover:text-text-primary font-mono text-[11px] transition-colors"
            title="Select programming language"
          >
            <Terminal className="w-3.5 h-3.5 text-accent-emerald" />
            <span className="font-semibold text-text-primary">{currentLang.label}</span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {/* Searchable Dropdown Menu inside Toolbar */}
          {dropdownOpen && (
            <div
              className="absolute left-0 top-full mt-1 w-52 max-h-64 bg-surface-raised border border-border-muted rounded-md shadow-2xl z-50 flex flex-col overflow-hidden text-xs font-sans"
              onKeyDown={handleKeyDown}
            >
              {/* Search input */}
              <div className="p-2 border-b border-border-subtle bg-surface-panel/80 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter language..."
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setSelectedIndex(0);
                  }}
                  className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>

              {/* Language list */}
              <div ref={listRef} className="overflow-y-auto max-h-48 py-1 divide-y divide-border-subtle/30">
                {filteredLanguages.length === 0 ? (
                  <div className="px-3 py-2 text-text-muted text-[11px] text-center">
                    No matching languages
                  </div>
                ) : (
                  filteredLanguages.map((lang, idx) => {
                    const isCurrent = lang.id === currentLang.id;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => handleSelectLanguage(lang.id)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px] transition-colors ${
                          isSelected
                            ? 'bg-surface-panel text-accent-emerald'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <span className="font-mono">{lang.label}</span>
                        {isCurrent && (
                          <Check className="w-3.5 h-3.5 text-accent-emerald shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Copy Code Button */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
            {currentLang.id}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-raised text-text-muted hover:text-text-primary font-mono text-[11px] transition-colors"
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-accent-emerald" />
                <span className="text-accent-emerald font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editable Code Content */}
      <pre className="p-4 text-xs font-mono text-text-primary leading-relaxed overflow-x-auto focus:outline-none">
        <NodeViewContent as={'code' as any} className={`language-${currentLang.id}`} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CustomCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      language: {
        default: 'plaintext',
        parseHTML: (element) => {
          const codeEl = element.querySelector('code') || element;
          const className = codeEl.getAttribute('class') || element.getAttribute('class') || '';
          const match = /(?:lang|language)-([a-zA-Z0-9_+#-]+)/.exec(className);
          return match ? match[1] : 'plaintext';
        },
        rendered: true,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const lang = node.attrs.language || 'plaintext';
    return [
      'pre',
      HTMLAttributes,
      ['code', { class: `language-${lang}` }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
