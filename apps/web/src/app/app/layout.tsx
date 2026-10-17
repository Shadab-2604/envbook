'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { SideNavBar } from '@/components/layout/SideNavBar';
import { TopNavBar } from '@/components/layout/TopNavBar';
import { QuickSwitcherModal } from '@/components/layout/QuickSwitcherModal';
import { Terminal } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { isUnlocked, isInitialized, isRestoring } = useVault();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);

  // Authentication & Vault Guard
  useEffect(() => {
    // Wait until both auth and persisted key restoration have finished
    if (authLoading || isRestoring) return;

    if (!user) {
      router.replace('/login');
    } else if (!user.vaultInitialized && !isInitialized) {
      router.replace('/vault/setup');
    } else if (!isUnlocked) {
      router.replace('/vault/unlock');
    }
  }, [user, authLoading, isUnlocked, isInitialized, isRestoring, router]);

  // Global Keyboard Shortcuts (Cmd+K for switcher, Esc for locking when no modal)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSwitcherOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  if (authLoading || isRestoring || !user || !isUnlocked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-canvas dot-grid">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded bg-surface-panel border border-border-muted flex items-center justify-center animate-pulse">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <span className="font-mono text-xs text-text-muted">
            {isRestoring ? 'Restoring encrypted vault session...' : 'Authenticating encrypted session...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-surface-canvas text-text-primary antialiased">
      {/* Sidebar Component */}
      <SideNavBar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Child Page Content */}
        {children}
      </div>

      {/* Quick Switcher Modal */}
      <QuickSwitcherModal
        isOpen={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
      />
    </div>
  );
}
