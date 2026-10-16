import React from 'react';
import Link from 'next/link';
import { Terminal, Home, ArrowLeft, Shield, LogIn } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col items-center justify-center p-6 text-center select-none selection:bg-primary-container selection:text-on-primary-container">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 font-mono text-xs text-text-muted">
        <Link href="/" className="hover:text-accent-emerald transition-colors">
          EnvBook
        </Link>
        <span>/</span>
        <span className="text-text-secondary">404</span>
      </nav>

      {/* Terminal Icon Badge */}
      <div className="w-14 h-14 rounded-xl bg-surface-panel border border-border-muted flex items-center justify-center text-status-danger mb-5 shadow-2xl">
        <Terminal className="w-7 h-7" />
      </div>

      {/* Error Code Pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-panel border border-border-muted text-xs font-mono text-status-danger mb-4">
        <span>ERROR 404 // RESOURCE_NOT_FOUND</span>
      </div>

      {/* Exactly One Semantic H1 Tag */}
      <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-text-primary mb-3">
        404 — Encrypted Route Not Found
      </h1>

      {/* Descriptive explanation */}
      <p className="text-xs sm:text-sm text-text-muted max-w-md mb-8 leading-relaxed">
        The requested resource, secret page, or document does not exist, was moved to trash, or requires an unlocked vault session.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        <Link
          href="/app"
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-accent-emerald text-surface-canvas hover:bg-accent-emerald-bright font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Home className="w-4 h-4" />
          <span>Open App Dashboard</span>
        </Link>
        <Link
          href="/"
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-surface-panel hover:bg-surface-elevated text-text-primary border border-border-muted font-medium text-xs flex items-center justify-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <Link
          href="/login"
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-surface-panel hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-muted font-medium text-xs flex items-center justify-center gap-2 transition-all"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In</span>
        </Link>
      </div>

      {/* Security Footer Note */}
      <div className="mt-12 text-[11px] font-mono text-text-muted flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-accent-emerald" />
        <span>EnvBook Zero-Knowledge Architecture • envbook.vercel.app</span>
      </div>
    </div>
  );
}
