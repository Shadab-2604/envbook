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
  lock: () => void;
  unlock: (passphrase: string) => Promise<void>;
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<void>;
  setup: (passphrase: string) => Promise<{ recoveryKey: string }>;
  rekey: (newPassphrase: string) => Promise<void>;
  encrypt: (payload: unknown, entryId: string) => Promise<{ ciphertext: string; nonce: string; aad: string }>;
  decrypt: <T = unknown>(ciphertext: string, nonce: string, entryId: string) => Promise<T>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle timeout matching Design System

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initialization state with user profile
  useEffect(() => {
    if (user) {
      setIsInitialized(Boolean(user.vaultInitialized));
    } else {
      setIsInitialized(false);
      setDek(null);
    }
  }, [user]);

  const lock = useCallback(() => {
    // Clear the unwrapped DEK from active React state
    setDek(null);
    console.log('[Vault] In-memory decryption keys wiped. Vault locked.');
    if (user && user.vaultInitialized) {
      router.push('/vault/unlock');
    }
  }, [router, user]);

  // Inactivity auto-lock listener
  useEffect(() => {
    if (!dek) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = () => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        lock();
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    timerRef.current = setInterval(checkInactivity, 30 * 1000); // Check every 30s

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dek, lock]);

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
    lastActivityRef.current = Date.now();
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
    lastActivityRef.current = Date.now();
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
