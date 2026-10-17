'use client';

import React, { useState, useMemo } from 'react';
import { RotateCcw, ArrowLeft, Eye, FileText, Check, Plus, Minus } from 'lucide-react';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Computes line-by-line diff using Longest Common Subsequence (LCS)
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  // Standard DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1) as unknown as number[]);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: 'unchanged',
        text: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: 'added',
        text: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({
        type: 'removed',
        text: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return diff;
}

interface SnapshotDiffViewProps {
  snapshotDate: string;
  snapshotTitle?: string;
  snapshotContent: string;
  currentContent: string;
  onRestore: () => void;
  onBack: () => void;
}

export function SnapshotDiffView({
  snapshotDate,
  snapshotTitle,
  snapshotContent,
  currentContent,
  onRestore,
  onBack,
}: SnapshotDiffViewProps) {
  const [activeTab, setActiveTab] = useState<'diff' | 'raw'>('diff');

  const diffLines = useMemo(() => {
    return computeLineDiff(snapshotContent, currentContent);
  }, [snapshotContent, currentContent]);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const line of diffLines) {
      if (line.type === 'added') additions++;
      else if (line.type === 'removed') deletions++;
    }
    return { additions, deletions };
  }, [diffLines]);

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs font-sans">
      {/* Header bar */}
      <div className="p-3 bg-surface-subtle border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary text-[11px] font-label-mono transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Snapshots</span>
          </button>
          <span className="font-semibold text-text-primary text-xs">
            {snapshotTitle ? `"${snapshotTitle}"` : 'Snapshot'}
          </span>
          <span className="text-[10px] text-text-muted font-label-mono">
            ({new Date(snapshotDate).toLocaleString()})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded bg-surface border border-border-subtle text-[11px] font-label-mono">
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === 'diff'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Diff</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === 'raw'
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Snapshot Content</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRestore}
            className="px-2.5 py-1 rounded bg-primary text-primary-fg hover:bg-primary-hover text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Version</span>
          </button>
        </div>
      </div>

      {/* Diff Stats Banner */}
      {activeTab === 'diff' && (
        <div className="px-3 py-1.5 bg-surface-raised/40 border-b border-border-subtle/80 flex items-center justify-between text-[11px] font-label-mono text-text-muted">
          <span>Comparing Snapshot vs Current Document:</span>
          <div className="flex items-center gap-3">
            <span className="text-text-primary flex items-center gap-0.5 font-semibold">
              <Plus className="w-3 h-3 text-primary" />
              {stats.additions} line{stats.additions === 1 ? '' : 's'} added currently
            </span>
            <span className="text-destructive flex items-center gap-0.5 font-semibold">
              <Minus className="w-3 h-3 text-destructive" />
              {stats.deletions} line{stats.deletions === 1 ? '' : 's'} removed from snapshot
            </span>
          </div>
        </div>
      )}

      {/* Main Diff / Content Area */}
      <div className="flex-1 overflow-y-auto p-2 bg-surface font-mono text-[11px] leading-relaxed mono-scroll">
        {activeTab === 'diff' ? (
          <div className="space-y-0.5">
            {diffLines.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                No differences found between this snapshot and current content.
              </div>
            ) : (
              diffLines.map((line, idx) => {
                if (line.type === 'added') {
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 px-2 py-0.5 rounded bg-surface-raised text-text-primary border-l-2 border-primary font-mono"
                    >
                      <span className="w-6 shrink-0 text-text-muted select-none text-right font-label-mono">
                        {line.newLineNumber}
                      </span>
                      <span className="text-primary shrink-0 select-none font-bold">+</span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{line.text || ' '}</span>
                    </div>
                  );
                }
                if (line.type === 'removed') {
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 px-2 py-0.5 rounded bg-destructive/10 text-destructive border-l-2 border-destructive font-mono"
                    >
                      <span className="w-6 shrink-0 text-destructive/70 select-none text-right font-label-mono">
                        {line.oldLineNumber}
                      </span>
                      <span className="text-destructive shrink-0 select-none font-bold">-</span>
                      <span className="flex-1 whitespace-pre-wrap break-all line-through opacity-80">
                        {line.text || ' '}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex items-start gap-2 px-2 py-0.5 text-text-muted hover:text-text-secondary font-mono">
                    <span className="w-6 shrink-0 opacity-40 select-none text-right font-label-mono">
                      {line.newLineNumber || line.oldLineNumber}
                    </span>
                    <span className="opacity-30 shrink-0 select-none">&nbsp;</span>
                    <span className="flex-1 whitespace-pre-wrap break-all text-text-secondary">
                      {line.text || ' '}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-3 bg-surface-raised rounded border border-border-subtle whitespace-pre-wrap break-words text-text-primary font-mono text-xs">
            {snapshotContent || '(Empty document snapshot)'}
          </div>
        )}
      </div>
    </div>
  );
}
