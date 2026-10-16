'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  deriveKEK,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptPayload,
  decryptPayload,
  generateSaltBase64,
  generateRecoveryKey,
} from '@/lib/crypto';
import { apiGetVaultStatus, apiSetupVault, apiRekeyVault } from '@/lib/api';

interface VaultContextType {
  isInitialized: boolean;
  isUnlocked: boolean;
  isRestoring: boolean;
  lock: () => void;
  unlock: (passphrase: string) => Promise<void>;
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<void>;
  setup: (passphrase: string) => Promise<{ recoveryKey: string }>;
  rekey: (newPassphrase: string) => Promise<void>;
  encrypt: (payload: unknown, entryId: string) => Promise<{ ciphertext: string; nonce: string; aad: string }>;
  decrypt: <T = unknown>(ciphertext: string, nonce: string, entryId: string) => Promise<T>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);

  // Restore persisted non-extractable CryptoKey from IndexedDB on initial mount / reload
  useEffect(() => {
    let active = true;

    async function restoreKey() {
      if (!user) {
        setDek(null);
        setIsInitialized(false);
        setIsRestoring(false);
        return;
      }

      setIsInitialized(Boolean(user.vaultInitialized));

      if (user.vaultInitialized) {
        setIsRestoring(true);
        try {
          const { getPersistedVaultKey } = await import('@/lib/vaultStorage');
          const persistedKey = await getPersistedVaultKey(user.id);
          if (active && persistedKey) {
            setDek(persistedKey);
            console.log('[Vault] Restored non-extractable CryptoKey from IndexedDB. Vault remains unlocked.');
          }
        } catch (err) {
          console.warn('[Vault] Failed to restore persisted key:', err);
        } finally {
          if (active) setIsRestoring(false);
        }
      } else {
        setIsRestoring(false);
      }
    }

    restoreKey();

    return () => {
      active = false;
    };
  }, [user]);

  // Listen for vault lock event across browser tabs/components
  useEffect(() => {
    const handleRemoteLock = () => {
      setDek(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('envbook:vault-locked', handleRemoteLock);
      return () => window.removeEventListener('envbook:vault-locked', handleRemoteLock);
    }
  }, []);

  const lock = useCallback(async () => {
    // 1. Clear the unwrapped DEK from active React state immediately
    setDek(null);

    // 2. Remove persisted key from IndexedDB
    if (user?.id) {
      try {
        const { removePersistedVaultKey } = await import('@/lib/vaultStorage');
        await removePersistedVaultKey(user.id);
      } catch (err) {
        console.warn('[Vault] Error clearing persisted vault key:', err);
      }
    }

    // 3. Broadcast lock event to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('envbook:vault-locked'));
    }

    console.log('[Vault] In-memory decryption keys wiped and storage cleared. Vault locked.');
    if (user && user.vaultInitialized) {
      router.push('/vault/unlock');
    }
  }, [router, user]);

  const unlock = async (passphrase: string) => {
    const status = await apiGetVaultStatus();
    if (!status.isInitialized || !status.salt || !status.wrappedDEK || !status.nonce) {
      throw new Error('Vault is not initialized. Please complete vault setup first.');
    }

    const kek = await deriveKEK(
      passphrase,
      status.salt,
      status.kdfParams?.memoryCost,
      status.kdfParams?.timeCost,
      status.kdfParams?.parallelism
    );

    const unwrappedDEK = await unwrapDEK(status.wrappedDEK, status.nonce, kek);
    setDek(unwrappedDEK);

    // Persist non-extractable CryptoKey across reloads
    if (user?.id) {
      try {
        const { savePersistedVaultKey } = await import('@/lib/vaultStorage');
        await savePersistedVaultKey(user.id, unwrappedDEK);
      } catch (err) {
        console.warn('[Vault] Could not persist key to IndexedDB:', err);
      }
    }
  };

  const unlockWithRecoveryKey = async (recoveryKey: string) => {
    const status = await apiGetVaultStatus();
    if (!status.isInitialized || !status.recoverySalt || !status.recoveryWrappedDEK || !status.recoveryNonce) {
      throw new Error('No recovery key metadata found on vault.');
    }

    const cleanKey = recoveryKey.trim().toUpperCase();
    const kek = await deriveKEK(cleanKey, status.recoverySalt, 16384, 2, 1);
    const unwrappedDEK = await unwrapDEK(status.recoveryWrappedDEK, status.recoveryNonce, kek);
    setDek(unwrappedDEK);

    if (user?.id) {
      try {
        const { savePersistedVaultKey } = await import('@/lib/vaultStorage');
        await savePersistedVaultKey(user.id, unwrappedDEK);
      } catch (err) {
        console.warn('[Vault] Could not persist recovery-unwrapped key:', err);
      }
    }
  };

  const setup = async (passphrase: string): Promise<{ recoveryKey: string }> => {
    const salt = generateSaltBase64(16);
    const kdfParams = { memoryCost: 65536, timeCost: 3, parallelism: 1 };

    const kek = await deriveKEK(passphrase, salt, kdfParams.memoryCost, kdfParams.timeCost, kdfParams.parallelism);
    const newDEK = await generateDEK();
    const { wrappedDEK, nonce } = await wrapDEK(newDEK, kek);

    // Generate recovery key
    const recoveryKey = generateRecoveryKey();
    const recoverySalt = generateSaltBase64(16);
    const recoveryKEK = await deriveKEK(recoveryKey, recoverySalt, 16384, 2, 1);
    const { wrappedDEK: recoveryWrappedDEK, nonce: recoveryNonce } = await wrapDEK(newDEK, recoveryKEK);

    await apiSetupVault({
      salt,
      kdfParams,
      keyVersion: 1,
      wrappedDEK,
      nonce,
      recoverySalt,
      recoveryWrappedDEK,
      recoveryNonce,
    });

    setDek(newDEK);
    setIsInitialized(true);

    if (user?.id) {
      try {
        const { savePersistedVaultKey } = await import('@/lib/vaultStorage');
        await savePersistedVaultKey(user.id, newDEK);
      } catch (err) {
        console.warn('[Vault] Could not persist setup key:', err);
      }
    }
    await refreshUser();

    return { recoveryKey };
  };

  const rekey = async (newPassphrase: string) => {
    if (!dek) throw new Error('Vault must be unlocked to re-key.');

    const salt = generateSaltBase64(16);
    const kdfParams = { memoryCost: 65536, timeCost: 3, parallelism: 1 };
    const kek = await deriveKEK(newPassphrase, salt, kdfParams.memoryCost, kdfParams.timeCost, kdfParams.parallelism);
    const { wrappedDEK, nonce } = await wrapDEK(dek, kek);

    await apiRekeyVault({
      salt,
      kdfParams,
      keyVersion: 1,
      wrappedDEK,
      nonce,
    });
  };

  const encrypt = async (payload: unknown, entryId: string) => {
    if (!dek) throw new Error('Vault is locked. Unlock before encrypting data.');
    const aad = `${user?.id || 'anon'}:${entryId}:1.0`;
    const { ciphertext, nonce } = await encryptPayload(payload, dek, aad);
    return { ciphertext, nonce, aad };
  };

  const decrypt = async <T = unknown>(ciphertext: string, nonce: string, entryId: string): Promise<T> => {
    if (!dek) throw new Error('Vault is locked. Unlock before decrypting data.');
    const aad = `${user?.id || 'anon'}:${entryId}:1.0`;
    return decryptPayload<T>(ciphertext, nonce, dek, aad);
  };

  return (
    <VaultContext.Provider
      value={{
        isInitialized,
        isUnlocked: Boolean(dek),
        isRestoring,
        lock,
        unlock,
        unlockWithRecoveryKey,
        setup,
        rekey,
        encrypt,
        decrypt,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
