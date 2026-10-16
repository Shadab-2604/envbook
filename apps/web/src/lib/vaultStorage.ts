/**
 * EnvBook IndexedDB Vault Key Persistence
 * 
 * Securely persists the non-extractable CryptoKey (DEK) across page reloads
 * using the W3C Web Cryptography API and IndexedDB Structured Clone algorithm.
 * 
 * Security properties:
 * - Plaintext passphrases, raw byte keys, and decrypted secrets are NEVER stored.
 * - Non-extractable CryptoKey cannot be read or exfiltrated via localStorage or cookies.
 * - Scoped strictly to the authenticated user's ID.
 * - Removed immediately on explicit "Lock Vault" or sign-out.
 */

const DB_NAME = 'envbook_vault_v1';
const STORE_NAME = 'keys';
const DB_VERSION = 1;

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open vault IndexedDB'));
  });
}

/**
 * Persists an active CryptoKey in IndexedDB for the given user.
 */
export async function savePersistedVaultKey(userId: string, key: CryptoKey): Promise<boolean> {
  if (!isIndexedDBAvailable() || !userId) return false;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        userId,
        key,
        savedAt: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.warn('[VaultStorage] Failed to store CryptoKey in IndexedDB:', request.error);
        resolve(false);
      };

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  } catch (err) {
    console.warn('[VaultStorage] IndexedDB storage unavailable:', err);
    return false;
  }
}

/**
 * Retrieves the persisted CryptoKey for the given user from IndexedDB.
 */
export async function getPersistedVaultKey(userId: string): Promise<CryptoKey | null> {
  if (!isIndexedDBAvailable() || !userId) return null;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(userId);

      request.onsuccess = () => {
        const record = request.result;
        if (record && record.key instanceof CryptoKey) {
          resolve(record.key);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.warn('[VaultStorage] Error reading key from IndexedDB:', request.error);
        resolve(null);
      };

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  } catch (err) {
    console.warn('[VaultStorage] Failed to open IndexedDB for key restoration:', err);
    return null;
  }
}

/**
 * Deletes the persisted CryptoKey for the given user from IndexedDB.
 */
export async function removePersistedVaultKey(userId: string): Promise<void> {
  if (!isIndexedDBAvailable() || !userId) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(userId);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  } catch {
    // Non-fatal if DB is already closed or unavailable
  }
}

/**
 * Clears all persisted vault keys (e.g. on global sign-out).
 */
export async function clearAllPersistedVaultKeys(): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  } catch {
    // Non-fatal
  }
}
