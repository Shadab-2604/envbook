import {
  SignupInput,
  LoginInput,
  ChangePasswordInput,
  SafeUser,
  VaultStatusResponse,
  VaultSetupInput,
  CreateEntryInput,
  UpdateEntryInput,
  EntryRecord,
  EntryVersionSnapshot,
  EnvAiConfigInput,
  EnvAiGenerateInput,
  EnvAiConfigStatus,
} from '@envbook/shared';

export class ApiError extends Error {
  code?: string;
  status: number;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // sends HttpOnly cookies automatically
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let data: any;
  if (isJson) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = data?.error || response.statusText || 'Request failed';
    const code = data?.code || 'API_ERROR';
    throw new ApiError(message, response.status, code, data?.details);
  }

  return data as T;
}

// ==========================================
// AUTH API
// ==========================================
export async function apiSignup(input: SignupInput): Promise<{ user: SafeUser; message: string }> {
  return request('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiLogin(input: LoginInput): Promise<{ user: SafeUser; message: string }> {
  return request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiLogout(): Promise<{ message: string }> {
  return request('/api/v1/auth/logout', {
    method: 'POST',
  });
}

export async function apiGetMe(): Promise<{ user: SafeUser }> {
  return request('/api/v1/auth/me', {
    method: 'GET',
  });
}

export async function apiChangePassword(input: ChangePasswordInput): Promise<{ message: string }> {
  return request('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ==========================================
// VAULT API
// ==========================================
export async function apiGetVaultStatus(): Promise<VaultStatusResponse> {
  return request('/api/v1/vault/status', {
    method: 'GET',
  });
}

export async function apiSetupVault(input: VaultSetupInput): Promise<{ message: string; isInitialized: boolean }> {
  return request('/api/v1/vault/setup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiRekeyVault(input: VaultSetupInput): Promise<{ message: string; keyVersion: number }> {
  return request('/api/v1/vault/rekey', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ==========================================
// ENTRIES API
// ==========================================
export interface GetEntriesParams {
  type?: string;
  parentId?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export async function apiGetEntries(params: GetEntriesParams = {}): Promise<{ entries: EntryRecord[]; total: number }> {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  if (params.parentId !== undefined) query.set('parentId', params.parentId);
  if (params.isFavorite !== undefined) query.set('isFavorite', String(params.isFavorite));
  if (params.isArchived !== undefined) query.set('isArchived', String(params.isArchived));
  if (params.isDeleted !== undefined) query.set('isDeleted', String(params.isDeleted));

  const qs = query.toString();
  return request(`/api/v1/entries${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

export async function apiGetEntryById(id: string): Promise<{ entry: EntryRecord }> {
  return request(`/api/v1/entries/${id}`, {
    method: 'GET',
  });
}

export async function apiCreateEntry(input: CreateEntryInput): Promise<{ entry: EntryRecord; message: string }> {
  return request('/api/v1/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateEntry(id: string, input: UpdateEntryInput): Promise<{ entry: EntryRecord; message: string }> {
  return request(`/api/v1/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function apiDeleteEntry(id: string, permanent = false): Promise<{ message: string; entryId: string }> {
  return request(`/api/v1/entries/${id}${permanent ? '?permanent=true' : ''}`, {
    method: 'DELETE',
  });
}

export async function apiRestoreEntry(id: string): Promise<{ entry: EntryRecord; message: string }> {
  return request(`/api/v1/entries/${id}/restore`, {
    method: 'POST',
  });
}

export async function apiArchiveEntry(id: string): Promise<{ entry: EntryRecord; message: string }> {
  return request(`/api/v1/entries/${id}/archive`, {
    method: 'POST',
  });
}

export async function apiDuplicateEntry(id: string): Promise<{ entry: EntryRecord; message: string }> {
  return request(`/api/v1/entries/${id}/duplicate`, {
    method: 'POST',
  });
}

export async function apiMoveEntries(moves: Array<{ entryId: string; parentId?: string | null; sortOrder?: number }>): Promise<{ message: string }> {
  return request('/api/v1/entries/move', {
    method: 'POST',
    body: JSON.stringify({ moves }),
  });
}

export async function apiGetHistory(id: string): Promise<{ history: EntryVersionSnapshot[] }> {
  return request(`/api/v1/entries/${id}/history`, {
    method: 'GET',
  });
}

export async function apiRestoreHistoryVersion(id: string, versionId: string): Promise<{ entry: EntryRecord; message: string }> {
  return request(`/api/v1/entries/${id}/history/${versionId}/restore`, {
    method: 'POST',
  });
}

// ==========================================
// BACKUP API
// ==========================================
export async function apiExportBackup(): Promise<any> {
  return request('/api/v1/backup/export', {
    method: 'GET',
  });
}

export async function apiRestoreBackup(backup: any): Promise<{ message: string; restoredCount: number }> {
  return request('/api/v1/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ backup }),
  });
}

// ==========================================
// ENVAI API
// ==========================================
export async function apiGetEnvAiStatus(): Promise<EnvAiConfigStatus> {
  return request('/api/v1/envai/status', {
    method: 'GET',
  });
}

export async function apiSaveEnvAiConfig(
  input: EnvAiConfigInput
): Promise<{ success: boolean; isConfigured: boolean; testResult?: any }> {
  return request('/api/v1/envai/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function apiTestEnvAi(): Promise<{ success: boolean; message: string; model?: string }> {
  return request('/api/v1/envai/test', {
    method: 'POST',
  });
}

export async function apiDeleteEnvAiConfig(): Promise<{ success: boolean; message: string }> {
  return request('/api/v1/envai/config', {
    method: 'DELETE',
  });
}

export async function apiGenerateEnvAi(
  input: EnvAiGenerateInput & { currentNoteType?: string }
): Promise<{ success: boolean; text: string; citations?: any[]; redactedCount?: number }> {
  return request('/api/v1/envai/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

