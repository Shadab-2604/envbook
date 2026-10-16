import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  savePersistedVaultKey,
  getPersistedVaultKey,
  removePersistedVaultKey,
  clearAllPersistedVaultKeys,
} from '../src/lib/vaultStorage';

// Minimal in-memory mock for IndexedDB to test vaultStorage persistence logic
class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: any = null;
  onerror: any = null;
}

class MockIDBStore {
  storage: Map<string, any>;
  constructor(storage: Map<string, any>) {
    this.storage = storage;
  }
  put(record: any) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.storage.set(record.userId, record);
      req.result = record.userId;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  get(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.storage.get(key) || null;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  delete(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.storage.delete(key);
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  clear() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.storage.clear();
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
}

class MockIDBTransaction {
  store: MockIDBStore;
  oncomplete: any = null;
  onerror: any = null;
  constructor(store: MockIDBStore) {
    this.store = store;
  }
  objectStore() {
    return this.store;
  }
}

class MockIDBDatabase {
  objectStoreNames = {
    contains: () => true,
  };
  mockStore: MockIDBStore;
  constructor(storage: Map<string, any>) {
    this.mockStore = new MockIDBStore(storage);
  }
  transaction() {
    const tx = new MockIDBTransaction(this.mockStore);
    setTimeout(() => {
      if (tx.oncomplete) tx.oncomplete();
    }, 5);
    return tx;
  }
  close() {}
}

describe('Vault CryptoKey IndexedDB Persistence', () => {
  const inMemoryDB = new Map<string, any>();
  const originalWindow = global.window;

  beforeEach(() => {
    inMemoryDB.clear();
    const mockDb = new MockIDBDatabase(inMemoryDB);

    // Attach mock IndexedDB to global window
    (global as any).window = {
      indexedDB: {
        open: () => {
          const req = new MockIDBRequest();
          setTimeout(() => {
            req.result = mockDb;
            if (req.onsuccess) req.onsuccess({ target: req });
          }, 0);
          return req;
        },
      },
    };
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  it('fails safely and returns null when IndexedDB is not available', async () => {
    (global as any).window = undefined;
    const res = await getPersistedVaultKey('user-123');
    expect(res).toBeNull();

    const saveRes = await savePersistedVaultKey('user-123', {} as any);
    expect(saveRes).toBe(false);
  });

  it('persists a non-extractable CryptoKey and restores it across reloads', async () => {
    // Construct a mock CryptoKey
    const mockKey = Object.create(CryptoKey.prototype, {
      type: { value: 'secret' },
      extractable: { value: false },
      algorithm: { value: { name: 'AES-GCM', length: 256 } },
      usages: { value: ['encrypt', 'decrypt'] },
    });

    const saved = await savePersistedVaultKey('user-alice', mockKey);
    expect(saved).toBe(true);

    // Simulate page reload: retrieve key using user ID
    const restoredKey = await getPersistedVaultKey('user-alice');
    expect(restoredKey).toBeDefined();
    expect(restoredKey).toBe(mockKey);
  });

  it('removes the persisted key when explicitly locking the vault', async () => {
    const mockKey = Object.create(CryptoKey.prototype, {
      type: { value: 'secret' },
      extractable: { value: false },
      algorithm: { value: { name: 'AES-GCM', length: 256 } },
      usages: { value: ['encrypt', 'decrypt'] },
    });

    await savePersistedVaultKey('user-bob', mockKey);
    expect(await getPersistedVaultKey('user-bob')).toBe(mockKey);

    // Explicit lock deletes the key
    await removePersistedVaultKey('user-bob');
    expect(await getPersistedVaultKey('user-bob')).toBeNull();
  });

  it('clears all keys on sign-out', async () => {
    const mockKey1 = Object.create(CryptoKey.prototype);
    const mockKey2 = Object.create(CryptoKey.prototype);

    await savePersistedVaultKey('user-1', mockKey1);
    await savePersistedVaultKey('user-2', mockKey2);

    expect(inMemoryDB.size).toBe(2);

    await clearAllPersistedVaultKeys();
    expect(inMemoryDB.size).toBe(0);
  });
});
