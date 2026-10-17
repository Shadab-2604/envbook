import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectDB } from '@/server/db';
import { PageShare } from '@/server/models/PageShare';
import { Globe, Shield, Terminal, ArrowLeft, Calendar, User } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connectDB();
  const share = await PageShare.findOne({
    publishedSlug: slug.toLowerCase(),
    isPublished: true,
  });

  if (!share) {
    return {
      title: 'Note Not Found — EnvBook',
      robots: 'noindex, nofollow',
    };
  }

  const title = `${share.publishedTitle || 'Untitled Note'} — EnvBook Public`;
  const description = (share.publishedContent || '').slice(0, 160).replace(/<[^>]*>/g, '');

  return {
    title,
    description: description || 'Published note from EnvBook developer workspace.',
    alternates: {
      canonical: `https://envbook.vercel.app/p/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://envbook.vercel.app/p/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PublishedPage({ params }: Props) {
  const { slug } = await params;
  await connectDB();

  const share = await PageShare.findOne({
    publishedSlug: slug.toLowerCase(),
    isPublished: true,
  }).populate('ownerId', 'name username');

  if (!share) {
    notFound();
  }

  const owner: any = share.ownerId;
  const authorName = owner?.name || owner?.username || 'EnvBook User';
  const cleanHtml = DOMPurify.sanitize(share.publishedContent || '<p>No content</p>', {
    ADD_TAGS: ['div', 'span', 'pre', 'code', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'hr', 'a'],
    ADD_ATTR: ['class', 'href', 'target', 'data-type', 'data-page-id', 'data-page-title'],
  });

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col font-sans antialiased selection:bg-primary selection:text-primary-fg">
      {/* Minimal Header */}
      <header className="h-14 border-b border-border-subtle bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2 group text-xs font-mono">
          <div className="w-6 h-6 rounded bg-surface-raised border border-border-muted flex items-center justify-center group-hover:border-primary transition-colors">
            <Terminal className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-semibold text-text-primary tracking-tight">EnvBook</span>
          <span className="text-[10px] text-text-muted font-normal">/ Public</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-raised border border-border-subtle text-[11px] font-mono text-primary">
            <Globe className="w-3 h-3" />
            <span>Published Document</span>
          </div>

          <Link
            href="/login"
            className="hidden sm:inline-flex px-3 py-1 text-xs rounded bg-surface-panel hover:bg-surface-raised border border-border-subtle text-text-primary transition-colors font-medium"
          >
            Create Your Workspace
          </Link>
        </div>
      </header>

      {/* Main Article Container */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <article className="prose max-w-none">
          {/* Article Header */}
          <div className="mb-8 pb-6 border-b border-border-subtle">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-3">
              {share.publishedTitle || 'Untitled Note'}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-text-muted">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Published by {authorName}</span>
              </div>

              {share.publishedAt && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <time dateTime={share.publishedAt.toISOString()}>
                    {new Date(share.publishedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              )}
            </div>
          </div>

          {/* Rendered Note Content */}
          <div
            className="text-text-primary leading-relaxed text-sm space-y-4"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-6 text-center text-xs font-mono text-text-muted bg-surface-subtle/40">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span>Published securely via EnvBook Zero-Knowledge Workspace</span>
        </div>
        <p className="text-[11px] text-text-muted/70">
          Environment variables, secrets, and private vault notes are never made public.
        </p>
      </footer>
    </div>
  );
}
