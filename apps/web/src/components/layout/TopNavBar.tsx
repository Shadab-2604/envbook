'use client';

import React from 'react';
import Link from 'next/link';
import {
  Menu,
  Lock,
  List,
  MoreVertical,
  Download,
  FileCode,
  Eye,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';

interface TopNavBarProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  isRawMarkdown?: boolean;
  onToggleRawMarkdown?: () => void;
  onToggleTOC?: () => void;
  onToggleMobileNav?: () => void;
  onExport?: () => void;
  saveStatus?: 'saved' | 'saving' | 'error';
}

export function TopNavBar({
  breadcrumbs = [{ label: 'EnvBook', href: '/app' }],
  isRawMarkdown = false,
  onToggleRawMarkdown,
  onToggleTOC,
  onToggleMobileNav,
  onExport,
  saveStatus = 'saved',
}: TopNavBarProps) {
  const { lock } = useVault();

  return (
    <header className="flex justify-between items-center h-12 px-4 w-full bg-surface border-b border-border-subtle shrink-0 z-20 select-none">
      {/* Mobile Drawer Trigger & Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="md:hidden p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-panel rounded"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <nav className="flex items-center gap-1.5 text-xs text-text-muted truncate">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-border-muted">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-text-primary transition-colors truncate max-w-[140px]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-primary font-medium truncate max-w-[160px]">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Sync Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-border-subtle">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              saveStatus === 'saved'
                ? 'bg-accent-emerald'
                : saveStatus === 'saving'
                ? 'bg-status-warning animate-pulse'
                : 'bg-status-danger'
            }`}
          />
          <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">
            {saveStatus === 'saved'
              ? 'Saved to MongoDB • AES-256 GCM'
              : saveStatus === 'saving'
              ? 'Encrypting & saving...'
              : 'Save failed'}
          </span>
        </div>
      </div>

      {/* Controls & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Rendered vs Raw Segmented Toggle */}
        {onToggleRawMarkdown && (
          <div className="flex items-center bg-surface-subtle p-0.5 rounded border border-border-subtle">
            <button
              type="button"
              onClick={() => isRawMarkdown && onToggleRawMarkdown()}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                !isRawMarkdown
                  ? 'bg-surface-raised text-text-primary shadow-sm border border-border-muted'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Rendered</span>
            </button>
            <button
              type="button"
              onClick={() => !isRawMarkdown && onToggleRawMarkdown()}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                isRawMarkdown
                  ? 'bg-surface-raised text-text-primary shadow-sm border border-border-muted'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <FileCode className="w-3 h-3" />
              <span>Raw</span>
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-border-subtle hidden sm:block" />

        {/* Lock Vault Immediate Button */}
        <button
          type="button"
          onClick={lock}
          title="Lock Vault immediately"
          className="p-1.5 text-text-muted hover:text-status-danger hover:bg-surface-panel rounded transition-colors"
          aria-label="Lock Vault"
        >
          <Lock className="w-4 h-4" />
        </button>

        {/* Table of Contents Toggle */}
        {onToggleTOC && (
          <button
            type="button"
            onClick={onToggleTOC}
            title="Toggle Outline / Table of Contents"
            className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-panel rounded transition-colors hidden xl:block"
            aria-label="Toggle Outline"
          >
            <List className="w-4 h-4" />
          </button>
        )}

        {/* Export Button */}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="px-2.5 py-1 text-xs font-semibold bg-accent-emerald text-surface-canvas hover:bg-accent-emerald-bright rounded transition-all flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        )}
      </div>
    </header>
  );
}
