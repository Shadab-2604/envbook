'use client';

import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { FileText, ArrowUpRight, FolderTree } from 'lucide-react';
import Link from 'next/link';

function ChildPageView({ node }: any) {
  const pageId = node.attrs.pageId;
  const title = node.attrs.title || 'Untitled Subpage';

  return (
    <NodeViewWrapper className="my-2 select-none">
      <Link
        href={`/app/page/${pageId}`}
        className="group inline-flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface-subtle hover:bg-surface-panel border border-border-subtle hover:border-accent-emerald/40 transition-all text-xs text-text-primary no-underline max-w-md shadow-sm"
      >
        <div className="w-5 h-5 rounded bg-surface-panel group-hover:bg-accent-emerald/10 border border-border-subtle flex items-center justify-center shrink-0 transition-colors">
          <FileText className="w-3.5 h-3.5 text-accent-emerald shrink-0" />
        </div>
        <span className="font-medium text-text-primary group-hover:text-accent-emerald truncate max-w-[240px]">
          {title}
        </span>
        <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-raised text-text-muted border border-border-subtle shrink-0">
          Subpage
        </span>
        <ArrowUpRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-emerald shrink-0 ml-auto transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
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
