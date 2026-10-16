'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MemoryStick as Memory,
  Check,
  Copy,
  AlertTriangle,
  CloudOff,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function VaultSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setup, isInitialized } = useVault();

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  // If already initialized and not currently showing recovery key, redirect to unlock
  useEffect(() => {
    if (!loading && user && isInitialized && !recoveryKey) {
      router.replace('/vault/unlock');
    }
  }, [user, isInitialized, recoveryKey, loading, router]);

  const calculateEntropy = (text: string) => {
    if (!text) return { label: 'EMPTY (0 BITS)', color: 'text-text-muted', percent: 0 };
    if (text.length < 10) return { label: 'WEAK (32 BITS)', color: 'text-status-danger', percent: 25 };
    if (text.length < 16) return { label: 'FAIR (64 BITS)', color: 'text-status-warning', percent: 60 };
    return { label: 'STRONG (128 BITS)', color: 'text-accent-emerald', percent: 100 };
  };

  const entropy = calculateEntropy(passphrase);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passphrase.length < 12) {
      setError('Master passphrase must be at least 12 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match. Please re-enter confirmation.');
      return;
    }

    try {
      setLoading(true);
      const res = await setup(passphrase);
      setRecoveryKey(res.recoveryKey);
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize encrypted vault.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRecovery = () => {
    if (recoveryKey) {
      navigator.clipboard.writeText(recoveryKey);
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2000);
    }
  };

  const handleFinish = () => {
    if (!confirmedSaved) {
      setError('Please confirm that you have saved your recovery key.');
      return;
    }
    router.push('/app');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-surface-canvas dot-grid px-4 py-6">
      {/* Top Minimalist Telemetry Bar */}
      <header className="w-full max-w-4xl flex justify-between items-center px-4 py-2 border-b border-border-subtle bg-surface-subtle/80 backdrop-blur-md rounded">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
            <span className="font-mono text-[11px] text-text-muted">HOST: 127.0.0.1</span>
          </div>
          <span className="text-border-muted">|</span>
          <span className="font-mono text-[11px] text-text-muted">RPC: SECURE_LOCAL</span>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-panel px-2.5 py-1 rounded border border-border-subtle">
          <Shield className="w-3.5 h-3.5 text-accent-emerald" />
          <span className="font-mono text-[11px] text-accent-emerald font-semibold">
            Zero-Knowledge Vault
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
          <span>AES-256-GCM</span>
          <span className="text-border-muted">/</span>
          <span className="text-accent-emerald font-semibold">v1.0</span>
        </div>
      </header>

      {/* Main Authentication Canvas */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-surface-subtle border border-border-subtle rounded-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-emerald to-transparent opacity-80" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded bg-surface-panel border border-border-muted flex items-center justify-center mb-2 shadow-inner">
              <Lock className="w-6 h-6 text-accent-emerald" />
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">EnvBook</h1>
            <p className="font-mono text-xs text-text-muted mt-1">
              Encrypted Vault &amp; Zero-Trust Runtime
            </p>
          </div>

          {/* Segmented Mode Tabs */}
          <div className="flex bg-surface-panel p-1 rounded border border-border-subtle mb-6">
            <Link
              href="/vault/unlock"
              className="flex-1 py-1 text-center font-sans text-xs rounded font-medium text-text-muted hover:text-text-primary transition-all flex items-center justify-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Unlock Vault</span>
            </Link>
            <div className="flex-1 py-1 text-center font-sans text-xs rounded font-semibold bg-surface-raised text-text-primary border border-border-muted shadow-sm flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-accent-emerald" />
              <span>Initialize New Vault</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!recoveryKey ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* 1. Master Passphrase Input with Universal Eye Control */}
              <PasswordInput
                id="create-passphrase"
                label="Create Master Passphrase"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Minimum 12 characters or 4 words"
                leftIcon={<Key className="w-4 h-4" />}
              />

              {/* Entropy Meter */}
              <div className="bg-surface-panel p-2.5 rounded border border-border-subtle">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[10px] text-text-muted">ENTROPY STRENGTH</span>
                  <span className={`font-mono text-[10px] font-semibold ${entropy.color}`}>
                    {entropy.label}
                  </span>
                </div>
                <div className="w-full bg-surface-raised h-1 rounded-full overflow-hidden flex gap-1">
                  <div
                    className={`h-full transition-all duration-300 ${
                      entropy.percent > 0 ? 'bg-accent-emerald' : 'bg-transparent'
                    }`}
                    style={{ width: `${entropy.percent}%` }}
                  />
                </div>
              </div>

              {/* 2. Confirm Passphrase Input with Universal Eye Control */}
              <PasswordInput
                id="confirm-passphrase"
                label="Confirm Passphrase"
                required
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Re-enter passphrase"
                leftIcon={<Shield className="w-4 h-4" />}
              />

              {/* Zero Knowledge Critical Notice */}
              <div className="p-3 rounded bg-surface-panel border-l-2 border-status-warning bg-opacity-70 flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
                <p className="text-text-secondary leading-snug">
                  <strong className="text-text-primary">Zero-knowledge architecture:</strong> If you
                  lose this passphrase, your encrypted vault cannot be recovered by anyone. There is
                  no reset email.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent-emerald hover:bg-accent-emerald-bright text-surface-canvas font-semibold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 btn-security-glow transition-all disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? 'Deriving Argon2id Key...' : 'Create Encrypted Vault'}</span>
              </button>
            </form>
          ) : (
            /* Recovery Key Step */
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald-bright text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Vault initialized! Save your high-entropy emergency recovery key below.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-xs text-text-muted">Emergency Recovery Key</label>
                <div className="flex items-center gap-2 bg-surface-panel border border-border-muted p-3 rounded font-mono text-sm text-text-primary tracking-wider justify-between">
                  <span className="font-bold text-accent-emerald">{recoveryKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyRecovery}
                    className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
                    title="Copy Recovery Key"
                  >
                    {copiedRecovery ? (
                      <Check className="w-4 h-4 text-accent-emerald" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={confirmedSaved}
                  onChange={(e) => setConfirmedSaved(e.target.checked)}
                  className="mt-0.5 rounded-sm bg-surface-panel border-border-subtle text-primary focus:ring-0"
                />
                <span>
                  I have saved this recovery key in a secure location. I understand it cannot be
                  shown again.
                </span>
              </label>

              <button
                type="button"
                onClick={handleFinish}
                disabled={!confirmedSaved}
                className="w-full bg-accent-emerald hover:bg-accent-emerald-bright text-surface-canvas font-semibold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 btn-security-glow transition-all disabled:opacity-40 cursor-pointer"
              >
                <span>Enter EnvBook Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Security Guarantees Bento Ribbon */}
      <footer className="w-full max-w-4xl pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-surface-subtle border border-border-subtle rounded p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-panel border border-border-muted flex items-center justify-center shrink-0">
              <CloudOff className="w-4 h-4 text-accent-emerald" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Zero Cloud Exposure</div>
              <div className="text-[11px] text-text-muted">Runs 100% locally on localhost</div>
            </div>
          </div>

          <div className="bg-surface-subtle border border-border-subtle rounded p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-panel border border-border-muted flex items-center justify-center shrink-0">
              <Memory className="w-4 h-4 text-accent-emerald" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Argon2id Hardened</div>
              <div className="text-[11px] text-text-muted">Memory-intensive key derivation</div>
            </div>
          </div>

          <div className="bg-surface-subtle border border-border-subtle rounded p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-panel border border-border-muted flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-accent-emerald" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">AES-256-GCM Cipher</div>
              <div className="text-[11px] text-text-muted">Authenticated client-side cipher</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
