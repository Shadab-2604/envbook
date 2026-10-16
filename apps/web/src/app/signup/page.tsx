'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, Lock, User, AtSign, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function SignupPage() {
  const router = useRouter();
  const { signup, user } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    router.replace(user.vaultInitialized ? '/app' : '/vault/setup');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, underscores and hyphens.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter confirmation password.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
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
          <span>Zero-Knowledge Architecture</span>
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
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Create Account</h1>
            <p className="font-mono text-xs text-text-muted mt-1">
              EnvBook Encrypted Developer Workspace
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* 1. Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-medium text-text-secondary mb-1">
                Full Name
              </label>
              <div className="relative rounded border border-border-muted bg-surface-panel focus-within:border-accent-emerald">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full pl-9 pr-3 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-muted/60 border-0 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Username */}
            <div>
              <label htmlFor="signup-username" className="block text-xs font-medium text-text-secondary mb-1">
                Username
              </label>
              <div className="relative rounded border border-border-muted bg-surface-panel focus-within:border-accent-emerald">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <AtSign className="w-4 h-4" />
                </div>
                <input
                  id="signup-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ada_sec"
                  className="w-full pl-9 pr-3 py-2 bg-transparent font-mono text-sm text-text-primary placeholder:text-text-muted/60 border-0 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            {/* 3. Email */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium text-text-secondary mb-1">
                Email Address
              </label>
              <div className="relative rounded border border-border-muted bg-surface-panel focus-within:border-accent-emerald">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-muted/60 border-0 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            {/* 4. Password with Universal Eye Control */}
            <PasswordInput
              id="signup-password"
              label="Password (min 8 characters)"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* 5. Confirm Password with Universal Eye Control */}
            <PasswordInput
              id="signup-confirm-password"
              label="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-accent-emerald hover:bg-accent-emerald-bright text-surface-canvas font-semibold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 btn-security-glow transition-all disabled:opacity-50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating Account...' : 'Sign Up for EnvBook'}</span>
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-emerald hover:underline">
              Log In
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-md text-center py-2 font-mono text-[11px] text-text-muted">
        <span>Runs locally on localhost (127.0.0.1) • Argon2id Hashed</span>
      </footer>
    </div>
  );
}
