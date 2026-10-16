'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { Terminal } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isUnlocked } = useVault();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (!user.vaultInitialized) {
      router.replace('/vault/setup');
    } else if (!isUnlocked) {
      router.replace('/vault/unlock');
    } else {
      router.replace('/app');
    }
  }, [user, authLoading, isUnlocked, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface-canvas dot-grid">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded bg-surface-panel border border-border-muted flex items-center justify-center animate-pulse">
          <Terminal className="w-5 h-5 text-accent-emerald" />
        </div>
        <span className="font-mono text-xs text-text-muted">Loading EnvBook secure runtime...</span>
      </div>
    </div>
  );
}
