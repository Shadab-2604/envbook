import React from 'react';
import Link from 'next/link';
import { Terminal, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-12 h-12 rounded-lg bg-surface-panel border border-border-subtle flex items-center justify-center text-status-danger mb-4 shadow-xl">
        <Terminal className="w-6 h-6" />
      </div>

      <div className="inline-block px-2.5 py-0.5 rounded bg-surface-panel border border-border-subtle text-[11px] font-label-mono text-status-danger mb-2">
        ERROR 404 // NOT_FOUND
      </div>

      <h1 className="text-2xl sm:text-3xl font-headline-lg font-bold tracking-tight text-text-primary mb-2">
        Requested Path Not Found
      </h1>

      <p className="text-xs sm:text-sm text-text-muted font-body-sm max-w-md mb-6 leading-relaxed">
        The encrypted resource, document, or route you requested does not exist or has been permanently erased.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/app"
          className="px-4 py-2 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright font-label-ui text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
