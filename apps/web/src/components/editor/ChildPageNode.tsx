'use client';

import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { FileText, ArrowUpRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { apiDeleteEntry } from '@/lib/api';

function ChildPageView({ node, deleteNode }: any) {
  const pageId = node.attrs.pageId;
  const title = node.attrs.title || 'Untitled Subpage';
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Move subpage "${title}" to Trash? You can restore it later from Trash.`)) {
      return;
    }

    try {
      setDeleting(true);
      await apiDeleteEntry(pageId);
      deleteNode();
      window.dispatchEvent(new CustomEvent('envbook:subpage-deleted', { detail: { pageId } }));
      window.dispatchEvent(new CustomEvent('envbook:workspace-tree-updated'));
    } catch (err: any) {
      console.error('[ChildPageNode] Failed to delete subpage:', err);
      alert(`Failed to delete subpage: ${err.message || 'Server error'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <NodeViewWrapper className="my-2 select-none group/subpage-wrapper relative inline-block">
      <div className="inline-flex items-center gap-1.5">
        <Link
          href={`/app/page/${pageId}`}
          className="group inline-flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface-subtle hover:bg-surface-panel border border-border-muted hover:border-border-focus transition-all text-xs text-text-primary no-underline max-w-md shadow-sm"
        >
          <div className="w-5 h-5 rounded bg-surface-panel group-hover:bg-surface-raised border border-border-muted flex items-center justify-center shrink-0 transition-colors">
            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
          </div>
          <span className="font-medium text-text-primary group-hover:underline truncate max-w-[240px]">
            {title}
          </span>
          <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-raised text-text-muted border border-border-muted shrink-0">
            Subpage
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary shrink-0 ml-auto transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          title={`Delete subpage "${title}"`}
          aria-label={`Delete subpage "${title}"`}
          className="opacity-0 group-hover/subpage-wrapper:opacity-100 p-1.5 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-all cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const ChildPageNode = Node.create({
  name: 'childPage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-page-id'),
        renderHTML: (attrs) => ({ 'data-page-id': attrs.pageId }),
      },
      title: {
        default: 'Untitled Subpage',
        parseHTML: (el) => el.getAttribute('data-page-title') || el.textContent?.trim(),
        renderHTML: (attrs) => ({ 'data-page-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="child-page"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return {};
          return {
            pageId: element.getAttribute('data-page-id'),
            title: element.getAttribute('data-page-title') || element.textContent?.trim() || 'Untitled Subpage',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'child-page',
        'data-page-id': HTMLAttributes.pageId,
        'data-page-title': HTMLAttributes.title,
        class: 'child-page-block my-2',
      }),
      [
        'a',
        {
          href: `/app/page/${HTMLAttributes.pageId}`,
          class: 'child-page-link inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-subtle border border-border-subtle text-text-primary text-xs font-medium no-underline',
        },
        ['span', { class: 'text-accent-emerald' }, '📄'],
        ['span', { class: 'font-semibold' }, HTMLAttributes.title || 'Untitled Subpage'],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChildPageView);
  },
});
