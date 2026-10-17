'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Key,
  Shield,
  MemoryStick as Memory,
  AlertTriangle,
  Fingerprint,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function VaultUnlockPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { unlock, unlockWithRecoveryKey, isUnlocked, isInitialized, isRestoring } = useVault();

  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Unlock Vault — EnvBook';
  }, []);

  // If already unlocked, redirect to app
  useEffect(() => {
    if (isUnlocked) {
      router.replace('/app');
    }
  }, [isUnlocked, router]);

  // If user is not initialized, redirect to setup
  useEffect(() => {
    if (!isRestoring && user && !user.vaultInitialized && !isInitialized) {
      router.replace('/vault/setup');
    }
  }, [user, isInitialized, isRestoring, router]);

  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas dot-grid">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded bg-surface-panel border border-border-muted flex items-center justify-center animate-pulse">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <span className="font-mono text-xs text-text-muted">Restoring encrypted vault session...</span>
        </div>
      </div>
    );
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      if (mode === 'passphrase') {
        if (!passphrase) {
          setError('Please enter your master passphrase.');
          return;
        }
        await unlock(passphrase);
      } else {
        if (!recoveryKey.trim()) {
          setError('Please enter your emergency recovery key.');
          return;
        }
        await unlockWithRecoveryKey(recoveryKey.trim());
      }
      router.push('/app');
    } catch (err: any) {
      setError(
        mode === 'passphrase'
          ? 'Incorrect master passphrase. Please try again or use your recovery key.'
          : 'Invalid recovery key.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-surface-canvas dot-grid px-4 py-6">
      {/* Top Minimalist Telemetry Bar */}
      <header className="w-full max-w-4xl flex justify-between items-center px-4 py-2 border-b border-border-subtle bg-surface-subtle/80 backdrop-blur-md rounded">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-mono text-[11px] text-text-muted">HOST: 127.0.0.1</span>
          </div>
          <span className="text-border-muted">|</span>
          <span className="font-mono text-[11px] text-text-muted">PORT: 5000 [RPC]</span>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-panel px-2.5 py-1 rounded border border-border-subtle">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-[11px] text-primary font-semibold">
            Local-Only Vault (127.0.0.1)
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
          <span>DAEMON: ACTIVE</span>
          <span className="text-border-muted">/</span>
          <span className="text-primary font-semibold">v1.0-SEC</span>
        </div>
      </header>

      {/* Main Authentication Canvas */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-surface-subtle border border-border-subtle rounded-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-border-muted opacity-80" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded bg-surface-panel border border-border-muted flex items-center justify-center mb-2 shadow-inner">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Unlock EnvBook Vault</h1>
            <p className="font-mono text-xs text-text-muted mt-1">
              Encrypted Vault &amp; Zero-Trust Runtime
            </p>
          </div>

          {/* Segmented Mode Tabs */}
          <div className="flex bg-surface-panel p-1 rounded border border-border-subtle mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('passphrase');
                setError(null);
              }}
              className={`flex-1 py-1 text-center font-sans text-xs rounded font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'passphrase'
                  ? 'bg-surface-raised text-text-primary border border-border-muted shadow-sm font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Unlock Vault</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('recovery');
                setError(null);
              }}
              className={`flex-1 py-1 text-center font-sans text-xs rounded font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'recovery'
                  ? 'bg-surface-raised text-text-primary border border-border-muted shadow-sm font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recovery Key</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            {mode === 'passphrase' ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="unlock-passphrase" className="text-xs font-medium text-text-secondary">
                    Master Passphrase
                  </label>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <span className="text-text-muted">TIMEOUT:</span>
                    <span className="text-text-primary font-semibold">15m IDLE</span>
                  </div>
                </div>
                {/* Universal Eye Control on Unlock Passphrase */}
                <PasswordInput
                  id="unlock-passphrase"
                  required
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  leftIcon={<Key className="w-4 h-4" />}
                />
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="unlock-recovery" className="text-xs font-medium text-text-secondary">
                    Emergency Recovery Key
                  </label>
                </div>
                {/* Universal Eye Control on Recovery Key */}
                <PasswordInput
                  id="unlock-recovery"
                  required
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  placeholder="EBK-XXXX-XXXX-XXXX-XXXX-..."
                  leftIcon={<Shield className="w-4 h-4" />}
                />
              </div>
            )}

            {/* Cryptographic Badges Cluster */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-surface-panel p-2 rounded border border-border-subtle flex items-center gap-2">
                <Memory className="w-4 h-4 text-secondary shrink-0" />
                <div className="overflow-hidden">
                  <div className="font-mono text-[10px] text-text-muted leading-tight">DERIVATION</div>
                  <div className="font-mono text-[11px] text-text-primary truncate font-semibold">
                    Argon2id · 64MB
                  </div>
                </div>
              </div>

              <div className="bg-surface-panel p-2 rounded border border-border-subtle flex items-center gap-2">
                <Shield className="w-4 h-4 text-secondary shrink-0" />
                <div className="overflow-hidden">
                  <div className="font-mono text-[10px] text-text-muted leading-tight">CIPHER</div>
                  <div className="font-mono text-[11px] text-text-primary truncate font-semibold">
                    AES-256-GCM
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full bg-primary hover:bg-primary-hover text-primary-fg font-semibold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 text-primary-fg" />
              <span className="text-primary-fg">{loading ? 'Unwrapping DEK...' : 'Unlock Vault'}</span>
            </button>
          </form>

          {/* Quick Access Separator */}
          <div className="relative flex py-2 items-center mt-2">
            <div className="flex-grow border-t border-border-subtle" />
            <span className="flex-shrink mx-2 font-mono text-[10px] text-text-muted">
              OR QUICK ACCESS
            </span>
            <div className="flex-grow border-t border-border-subtle" />
          </div>

          <button
            type="button"
            onClick={() => router.push('/app')}
            className="w-full bg-surface-panel border border-border-muted text-text-secondary hover:text-text-primary hover:bg-surface-raised py-1.5 px-3 rounded text-xs font-sans flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-text-muted" />
              <span>Quick open workspace</span>
            </div>
            <kbd className="bg-surface-raised text-text-muted text-[10px] font-mono px-1 py-0.5 rounded border border-border-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Path Diagnostic Footer */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
            <span>STORAGE:</span>
            <code className="text-text-secondary bg-surface-panel px-1.5 py-0.5 rounded border border-border-subtle">
              MongoDB @ 127.0.0.1:27017/envbook
            </code>
          </div>
        </div>
      </main>

      {/* Bottom Security Guarantees Bento Ribbon */}
      <footer className="w-full max-w-4xl pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-surface-subtle border border-border-subtle rounded p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-panel border border-border-muted flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-secondary" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Zero Cloud Exposure</div>
              <div className="text-[11px] text-text-muted">Runs 100% locally on localhost</div>
            </div>
          </div>

          <div className="bg-surface-subtle border border-border-subtle rounded p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-panel border border-border-muted flex items-center justify-center shrink-0">
              <Memory className="w-4 h-4 text-secondary" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Argon2id Memory Hardened</div>
              <div className="text-[11px] text-text-muted">No plaintext passphrases stored</div>
            </div>
          </div>

          <div className="bg-surface-subtle border border-border-subtle rounded p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-panel border border-border-muted flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-secondary" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">AES-256-GCM Authenticated</div>
              <div className="text-[11px] text-text-muted">End-to-end zero-knowledge cipher</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
