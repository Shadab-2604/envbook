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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import {
  apiChangePassword,
  apiExportBackup,
  apiRestoreBackup,
} from '@/lib/api';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const vault = useVault();

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

  React.useEffect(() => {
    document.title = 'Settings & Security — EnvBook';
  }, []);

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
      </main>
    </div>
  );
}
