'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  Home,
  ArrowLeft,
  Shield,
  FileQuestion,
  Lock,
  Pause,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';

export default function NotFound() {
  const router = useRouter();
  const { isUnlocked } = useVault();
  const [countdown, setCountdown] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedRef = useRef(false);

  // Home route based on current vault session
  const homeRoute = isUnlocked ? '/app' : '/';

  const cancelRedirect = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPaused(true);
  };

  const handleNavigateHome = () => {
    cancelRedirect();
    hasNavigatedRef.current = true;
    router.push(homeRoute);
  };

  const handleGoBack = () => {
    cancelRedirect();
    hasNavigatedRef.current = true;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push(homeRoute);
    }
  };

  useEffect(() => {
    // Respect reduced-motion preferences: do not auto-redirect if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setIsPaused(true);
      return;
    }

    // Set 5-second interval timer
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            router.push(homeRoute);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [router, homeRoute]);

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Decorative large background 404 watermark */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <span className="text-[12rem] sm:text-[18rem] md:text-[22rem] font-mono font-black text-text-primary/[0.03] tracking-tighter">
          404
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 font-mono text-xs text-text-muted">
          <Link href={homeRoute} onClick={cancelRedirect} className="hover:text-text-primary transition-colors">
            EnvBook
          </Link>
          <span className="text-border-muted">/</span>
          <span className="text-text-secondary">Vault Index</span>
          <span className="text-border-muted">/</span>
          <span className="text-primary font-semibold">404</span>
        </nav>

        {/* Developer-Vault Themed Icon */}
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-muted flex items-center justify-center text-primary mb-6 shadow-2xl relative">
          <FileQuestion className="w-8 h-8 text-primary" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface-panel border border-border-muted flex items-center justify-center text-text-muted">
            <Lock className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-panel border border-border-muted text-xs font-mono text-text-secondary mb-4 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-status-danger" />
          <span>VAULT_RECORD_NOT_FOUND</span>
        </div>

        {/* Semantic H1 Tag */}
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-text-primary mb-3">
          Page Not Found
        </h1>

        {/* Concise Description */}
        <p className="text-xs sm:text-sm text-text-secondary mb-6 leading-relaxed max-w-md">
          The requested document, page entry, or environment record could not be found in your encrypted vault.
          It may have moved to a different folder, been deleted, or never existed.
        </p>

        {/* Automatic Redirect Countdown Pill */}
        <div className="mb-8 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-elevated border border-border-muted text-xs font-mono text-text-muted shadow-xs">
          {!isPaused ? (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>
                Redirecting to Home in <strong className="text-text-primary font-bold">{countdown}</strong> second{countdown === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={cancelRedirect}
                className="ml-2 text-[10px] text-text-muted hover:text-text-primary underline cursor-pointer"
                title="Pause countdown"
              >
                Pause
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-text-muted">
              <Pause className="w-3 h-3 text-text-muted" />
              <span>Automatic redirect paused</span>
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleNavigateHome}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary text-primary-fg hover:opacity-90 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Home className="w-4 h-4 text-primary-fg" />
            <span className="text-primary-fg">Back to Home</span>
          </button>

          <button
            type="button"
            onClick={handleGoBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-primary border border-border-muted font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Security Footer Note */}
        <div className="mt-12 text-[11px] font-mono text-text-muted flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-text-muted" />
          <span>EnvBook Zero-Knowledge Client Vault • Private Session</span>
        </div>
      </div>
    </div>
  );
}
