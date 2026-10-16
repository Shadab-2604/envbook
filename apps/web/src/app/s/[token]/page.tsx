import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectDB } from '@/server/db';
import { PageShare } from '@/server/models/PageShare';
import { Link as LinkIcon, Shield, Terminal, Calendar, User, Eye, Edit3 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Shared Note — EnvBook',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SharedLinkPage({ params }: Props) {
  const { token } = await params;
  await connectDB();

  const share = await PageShare.findOne({
    publicShareToken: token,
    isPublicLinkEnabled: true,
  }).populate('ownerId', 'name username');

  if (!share) {
    return (
      <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-xl bg-surface-panel border border-border-muted flex items-center justify-center mb-4 text-text-muted">
          <LinkIcon className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold mb-2">Share Link Inactive</h1>
        <p className="text-xs text-text-muted max-w-sm mb-6">
          This link is invalid or its access was revoked by the page owner.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-xs font-mono text-text-primary transition-colors"
        >
          Return to EnvBook
        </Link>
      </div>
    );
  }

  const owner: any = share.ownerId;
  const authorName = owner?.name || owner?.username || 'EnvBook User';
  const cleanHtml = DOMPurify.sanitize(share.publishedContent || '<p>No content</p>', {
    ADD_TAGS: ['div', 'span', 'pre', 'code', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'hr', 'a'],
    ADD_ATTR: ['class', 'href', 'target', 'data-type', 'data-page-id', 'data-page-title'],
  });

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col font-sans antialiased selection:bg-accent-emerald selection:text-black">
      {/* Header */}
      <header className="h-14 border-b border-border-subtle bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2 group text-xs font-mono">
          <div className="w-6 h-6 rounded bg-surface-raised border border-border-muted flex items-center justify-center group-hover:border-accent-emerald transition-colors">
            <Terminal className="w-3.5 h-3.5 text-accent-emerald" />
          </div>
          <span className="font-semibold text-text-primary tracking-tight">EnvBook</span>
          <span className="text-[10px] text-text-muted font-normal">/ Shared</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-panel border border-border-subtle text-[11px] font-mono text-text-secondary">
            {share.publicAccessLevel === 'editor' ? (
              <>
                <Edit3 className="w-3 h-3 text-cyan-400" />
                <span>Editor Access</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-accent-emerald" />
                <span>Viewer Access</span>
              </>
            )}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <article className="prose prose-invert prose-emerald max-w-none">
          <div className="mb-8 pb-6 border-b border-border-subtle">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-3">
              {share.publishedTitle || 'Shared Note'}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-text-muted">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-accent-emerald" />
                <span>Shared by {authorName}</span>
              </div>
            </div>
          </div>

          <div
            className="text-text-primary leading-relaxed text-sm space-y-4"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-6 text-center text-xs font-mono text-text-muted bg-surface-subtle/40">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="w-3.5 h-3.5 text-accent-emerald" />
          <span>Shared securely via EnvBook Zero-Knowledge Workspace</span>
        </div>
        <p className="text-[11px] text-text-muted/70">
          Unlisted cryptographic link. Private credentials and vault secrets remain encrypted.
        </p>
      </footer>
    </div>
  );
}
