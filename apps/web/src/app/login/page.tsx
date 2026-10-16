'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, Lock, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    router.replace(user.vaultInitialized ? '/vault/unlock' : '/vault/setup');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Username or email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    try {
      setLoading(true);
      await login({
        identifier: identifier.trim(),
        password,
      });
    } catch (err: any) {
      setError(err?.message || 'Invalid username/email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-surface-canvas dot-grid px-4 py-8">
      {/* Telemetry Header Bar */}
      <header className="w-full max-w-4xl flex justify-between items-center px-4 py-2 border-b border-border-subtle bg-surface-subtle/80 rounded backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
          <span className="font-mono text-[11px] text-text-muted">HOST: 127.0.0.1</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-accent-emerald">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-Only Session</span>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-surface-subtle border border-border-subtle rounded-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-emerald to-transparent opacity-80" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded bg-surface-panel border border-border-muted flex items-center justify-center mb-2 shadow-inner">
              <Terminal className="w-6 h-6 text-accent-emerald" />
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Log In to EnvBook</h1>
            <p className="font-mono text-xs text-text-muted mt-1">
              Encrypted Personal Workspace
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 1. Identifier (Username or Email) */}
            <div>
              <label htmlFor="login-identifier" className="block text-xs font-medium text-text-secondary mb-1">
                Username or Email
              </label>
              <div className="relative rounded border border-border-muted bg-surface-panel focus-within:border-accent-emerald">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or user@domain.com"
                  className="w-full pl-9 pr-3 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-muted/60 border-0 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Password with Universal Eye Control */}
            <PasswordInput
              id="login-password"
              label="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-accent-emerald hover:bg-accent-emerald-bright text-surface-canvas font-semibold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 btn-security-glow transition-all disabled:opacity-50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Authenticating...' : 'Log In'}</span>
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-text-muted">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-accent-emerald hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-md text-center py-2 font-mono text-[11px] text-text-muted">
        <span>Zero-Knowledge Server • HttpOnly Cookie Authentication</span>
      </footer>
    </div>
  );
}
