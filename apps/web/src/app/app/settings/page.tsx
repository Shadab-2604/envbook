'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Settings,
  Shield,
  Key,
  Lock,
  Download,
  Upload,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import {
  apiChangePassword,
  apiExportBackup,
  apiRestoreBackup,
  apiGetEnvAiStatus,
  apiSaveEnvAiConfig,
  apiTestEnvAi,
  apiDeleteEnvAiConfig,
} from '@/lib/api';
import { EnvAiConfigStatus } from '@envbook/shared';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const vault = useVault();

  // envAi state
  const [aiStatus, setAiStatus] = useState<EnvAiConfigStatus | null>(null);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-flash-latest');
  const [aiShowKey, setAiShowKey] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiDeleting, setAiDeleting] = useState(false);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Vault Passphrase Rekey state
  const [newVaultPassphrase, setNewVaultPassphrase] = useState('');
  const [confirmVaultPassphrase, setConfirmVaultPassphrase] = useState('');
  const [rekeyLoading, setRekeyLoading] = useState(false);
  const [rekeySuccess, setRekeySuccess] = useState<string | null>(null);
  const [rekeyError, setRekeyError] = useState<string | null>(null);

  // Backup / Restore state
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAiStatus = async () => {
    try {
      const status = await apiGetEnvAiStatus();
      setAiStatus(status);
      if (status.model) setAiModel(status.model);
    } catch {
      // Ignored if user not authenticated or network error
    }
  };

  React.useEffect(() => {
    document.title = 'Settings & Security — EnvBook';
    loadAiStatus();
  }, []);

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError(null);
    setAiSuccess(null);

    if (!aiApiKey.trim()) {
      setAiError('Please enter a valid Google Gemini API Key.');
      return;
    }

    try {
      setAiLoading(true);
      const res = await apiSaveEnvAiConfig({
        apiKey: aiApiKey.trim(),
        model: aiModel,
      });

      if (res.testResult?.success) {
        setAiSuccess(`envAi configured and verified successfully with ${aiModel}!`);
      } else {
        setAiSuccess('envAi key saved (AES-256-GCM encrypted in database).');
      }
      setAiApiKey('');
      await loadAiStatus();
      setTimeout(() => setAiSuccess(null), 5000);
    } catch (err: any) {
      setAiError(err.message || 'Failed to save and test envAi configuration.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleTestAiConnection = async () => {
    setAiError(null);
    setAiSuccess(null);
    try {
      setAiTesting(true);
      const res = await apiTestEnvAi();
      if (res.success) {
        setAiSuccess(`Connection test passed: ${res.message}`);
      } else {
        setAiError(`Connection test failed: ${res.message}`);
      }
      await loadAiStatus();
      setTimeout(() => setAiSuccess(null), 5000);
    } catch (err: any) {
      setAiError(err.message || 'Connection test error.');
    } finally {
      setAiTesting(false);
    }
  };

  const handleDeleteAiConfig = async () => {
    if (!confirm('Are you sure you want to remove your envAi provider key?')) return;
    setAiError(null);
    setAiSuccess(null);
    try {
      setAiDeleting(true);
      await apiDeleteEnvAiConfig();
      setAiSuccess('envAi configuration removed successfully.');
      await loadAiStatus();
      setTimeout(() => setAiSuccess(null), 4000);
    } catch (err: any) {
      setAiError(err.message || 'Failed to remove envAi configuration.');
    } finally {
      setAiDeleting(false);
    }
  };


  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    try {
      setPasswordLoading(true);
      await apiChangePassword({ currentPassword, newPassword });
      setPasswordSuccess('Password successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRekeyVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setRekeyError(null);
    setRekeySuccess(null);

    if (!newVaultPassphrase || !confirmVaultPassphrase) {
      setRekeyError('Passphrase fields are required.');
      return;
    }

    if (newVaultPassphrase !== confirmVaultPassphrase) {
      setRekeyError('Passphrases do not match.');
      return;
    }

    if (newVaultPassphrase.length < 10) {
      setRekeyError('Vault passphrase must be at least 10 characters.');
      return;
    }

    try {
      setRekeyLoading(true);
      await vault.rekey(newVaultPassphrase);
      setRekeySuccess('Vault passphrase successfully re-keyed with fresh salt and wrapped DEK.');
      setNewVaultPassphrase('');
      setConfirmVaultPassphrase('');
      setTimeout(() => setRekeySuccess(null), 4000);
    } catch (err: any) {
      setRekeyError(err.message || 'Failed to re-key vault.');
    } finally {
      setRekeyLoading(false);
    }
  };

  // Export encrypted backup
  const handleExportBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupError(null);
      const data = await apiExportBackup();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = `envbook_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      setBackupSuccess('Encrypted backup successfully downloaded.');
      setTimeout(() => setBackupSuccess(null), 4000);
    } catch (err: any) {
      setBackupError(err.message || 'Failed to export backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  // Restore encrypted backup file
  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        'RESTORE ENCRYPTED BACKUP: This will import backup records into your workspace. Do you wish to continue?'
      )
    ) {
      return;
    }

    try {
      setRestoreLoading(true);
      setBackupError(null);
      const text = await file.text();
      const backupJson = JSON.parse(text);

      const res = await apiRestoreBackup(backupJson);
      setBackupSuccess(`Restore complete: restored ${res.restoredCount} entries.`);
      setTimeout(() => setBackupSuccess(null), 5000);
    } catch (err: any) {
      setBackupError(`Restore error: ${err.message}`);
    } finally {
      setRestoreLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <h1 className="text-text-primary text-xs font-medium flex items-center gap-1.5 inline-flex">
            <Settings className="w-3.5 h-3.5 text-primary" />
            Workspace Settings &amp; Security
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full mono-scroll space-y-6">
        {/* 1. Account Profile Card */}
        <section className="p-5 rounded-lg bg-surface-panel border border-border-subtle space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">Developer Account Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-body-sm">
            <div>
              <span className="text-[11px] font-label-mono uppercase text-text-muted block mb-0.5">Full Name</span>
              <span className="text-text-primary font-medium">{user?.name || '—'}</span>
            </div>
            <div>
              <span className="text-[11px] font-label-mono uppercase text-text-muted block mb-0.5">Username</span>
              <span className="text-primary font-mono font-medium">@{user?.username || '—'}</span>
            </div>
            <div>
              <span className="text-[11px] font-label-mono uppercase text-text-muted block mb-0.5">Email</span>
              <span className="text-text-primary font-medium">{user?.email || '—'}</span>
            </div>
          </div>
        </section>

        {/* 2. Change Account Password */}
        <section className="p-5 rounded-lg bg-surface-panel border border-border-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-status-warning" />
              <h3 className="text-sm font-semibold text-text-primary">Change Account Password</h3>
            </div>
            <span className="text-[10px] font-label-mono text-text-muted">Argon2id Hashed</span>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md text-xs">
            {passwordError && (
              <div className="p-2.5 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="p-2.5 rounded bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                Current Password *
              </label>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Verify current password..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                New Password *
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter minimum 8 characters..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                Confirm New Password *
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password..."
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="px-3.5 py-1.5 rounded bg-surface-raised hover:bg-surface-bright border border-border-subtle text-text-primary text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>

        {/* 3. Re-Key Vault Passphrase */}
        <section className="p-5 rounded-lg bg-surface-panel border border-border-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">Re-Key Client Vault Passphrase</h3>
            </div>
            <span className="text-[10px] font-label-mono text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded">
              Zero-Knowledge DEK Wrapping
            </span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Re-keying re-encrypts your in-memory master Data Encryption Key (DEK) with a new Key Encryption Key (KEK) derived from your new passphrase.
            Existing encrypted documents and credentials are <strong>not</strong> modified.
          </p>

          <form onSubmit={handleRekeyVault} className="space-y-3 max-w-md text-xs">
            {rekeyError && (
              <div className="p-2.5 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{rekeyError}</span>
              </div>
            )}
            {rekeySuccess && (
              <div className="p-2.5 rounded bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{rekeySuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                New Vault Passphrase *
              </label>
              <PasswordInput
                value={newVaultPassphrase}
                onChange={(e) => setNewVaultPassphrase(e.target.value)}
                placeholder="Enter new strong passphrase (min 10 chars)..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                Confirm New Vault Passphrase *
              </label>
              <PasswordInput
                value={confirmVaultPassphrase}
                onChange={(e) => setConfirmVaultPassphrase(e.target.value)}
                placeholder="Confirm new passphrase..."
              />
            </div>

            <button
              type="submit"
              disabled={rekeyLoading}
              className="px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {rekeyLoading ? 'Re-keying...' : 'Re-Key Vault'}
            </button>
          </form>
        </section>

        {/* 4. Encrypted Backup & Restore */}
        <section className="p-5 rounded-lg bg-surface-panel border border-border-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">Encrypted Vault Backup &amp; Portability</h3>
            </div>
            <span className="text-[10px] font-label-mono text-text-muted">Zero-Plaintext Export</span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Backups contain only your encrypted records, nonces, and vault metadata as persisted in MongoDB.
            No decrypted passwords, secret values, or passphrases are ever written into backup files.
          </p>

          {backupError && (
            <div className="p-2.5 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{backupError}</span>
            </div>
          )}
          {backupSuccess && (
            <div className="p-2.5 rounded bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{backupSuccess}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleExportBackup}
              disabled={backupLoading}
              className="px-3.5 py-1.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>{backupLoading ? 'Generating...' : 'Download Encrypted Backup (.json)'}</span>
            </button>

            <label className="px-3.5 py-1.5 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-status-warning" />
              <span>{restoreLoading ? 'Restoring...' : 'Restore from Backup (.json)'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                className="hidden"
                disabled={restoreLoading}
              />
            </label>
          </div>
        </section>

        {/* 5. envAi Assistant & Gemini Provider Settings */}
        <section id="envai" className="p-5 rounded-lg bg-surface-panel border border-border-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">envAi Assistant &amp; Gemini Provider</h3>
            </div>
            {aiStatus?.isConfigured ? (
              <span className="flex items-center gap-1.5 text-[10px] font-label-mono text-accent-emerald bg-accent-emerald/10 border border-accent-emerald/30 px-2 py-0.5 rounded">
                <Check className="w-3 h-3" />
                <span>Configured (AES-256-GCM Encrypted)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-label-mono text-status-warning bg-status-warning/10 border border-status-warning/30 px-2 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3" />
                <span>Not Configured</span>
              </span>
            )}
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            envAi connects to Google Gemini for AI-powered note writing, code explanations, cybersecurity analysis, and contextual synthesis.
            Your API key is never stored in plaintext and never stored in <code className="text-text-primary font-mono text-[11px]">.env</code> files. It is securely encrypted in MongoDB using an HKDF-derived AES-256-GCM key from your authentication secret.
          </p>

          <div className="p-3 rounded bg-surface border border-border-subtle text-[11px] text-text-muted space-y-1">
            <div className="flex items-center gap-2 text-text-primary font-medium">
              <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Strict Zero-Knowledge &amp; Credential Privacy Policy</span>
            </div>
            <p>
              Environment variables, database credentials, and raw private keys are strictly blocked and filtered from AI context. envAi only operates on your documentation and notes.
            </p>
          </div>

          {aiError && (
            <div className="p-2.5 rounded bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}
          {aiSuccess && (
            <div className="p-2.5 rounded bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{aiSuccess}</span>
            </div>
          )}

          {aiStatus?.isConfigured && (
            <div className="p-3 rounded bg-surface border border-border-subtle text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-label-mono">
                <span className="text-text-muted">ACTIVE MODEL</span>
                <span className="text-primary font-semibold">{aiStatus.model || 'gemini-flash-latest'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-label-mono">
                <span className="text-text-muted">LAST TESTED</span>
                <span className="text-text-secondary">
                  {aiStatus.lastTestedAt ? new Date(aiStatus.lastTestedAt).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-label-mono">
                <span className="text-text-muted">HEALTH STATUS</span>
                <span className={aiStatus.lastTestStatus === 'success' ? 'text-accent-emerald font-semibold' : 'text-status-warning font-semibold'}>
                  {aiStatus.lastTestStatus?.toUpperCase() || 'UNTESTED'}
                </span>
              </div>
              {aiStatus.message && (
                <div className="text-[11px] text-text-muted pt-1 border-t border-border-subtle">
                  {aiStatus.message}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={aiTesting}
                  className="px-3 py-1 rounded bg-surface-raised hover:bg-surface-bright border border-border-subtle text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-primary ${aiTesting ? 'animate-spin' : ''}`} />
                  <span>{aiTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAiConfig}
                  disabled={aiDeleting}
                  className="px-3 py-1 rounded bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 text-status-danger text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{aiDeleting ? 'Removing...' : 'Remove Key'}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveAiConfig} className="space-y-3 max-w-md text-xs pt-1">
            <h4 className="text-xs font-semibold text-text-primary">
              {aiStatus?.isConfigured ? 'Replace Google Gemini API Key' : 'Configure Google Gemini API Key'}
            </h4>

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                Gemini API Key *
              </label>
              <div className="relative">
                <input
                  type={aiShowKey ? 'text' : 'password'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="AIzaSy... or AQ..."
                  className="w-full bg-surface-raised border border-border-subtle focus:border-primary focus:outline-none rounded px-3 py-2 pr-10 text-xs font-mono text-text-primary"
                />
                <button
                  type="button"
                  onClick={() => setAiShowKey(!aiShowKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {aiShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                Get an API key free from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                Model Tier
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full bg-surface-raised border border-border-subtle focus:border-primary focus:outline-none rounded px-3 py-2 text-xs text-text-primary"
              >
                <option value="gemini-flash-latest">gemini-flash-latest (Recommended, Ultra Fast &amp; Multimodal)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Standard Flash)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (Experimental)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={aiLoading}
              className="px-4 py-2 rounded bg-primary text-black hover:bg-accent-emerald-bright text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiLoading ? 'Verifying & Saving...' : 'Save & Verify Key'}</span>
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
