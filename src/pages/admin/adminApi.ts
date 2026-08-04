import { getStoredToken } from '../../services/authService';

const BASE = '/api/admin';

export type AdminApiError = Error & { status?: number };

function createAdminApiError(status: number, body: any): AdminApiError {
  const err = new Error(body.error ?? `HTTP ${status}`) as AdminApiError;
  err.status = status;
  return err;
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...((opts.headers ?? {}) as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw createAdminApiError(res.status, body);
  }
  return res.json();
}

export async function adminUpload(path: string, form: FormData) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw createAdminApiError(res.status, body);
  }
  return res.json();
}

/** Fetches a binary resource with auth headers and triggers a browser download. */
export async function adminDownloadFile(path: string, filename: string) {
  const res = await fetch(BASE + path, { headers: { ...authHeaders() } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw createAdminApiError(res.status, body);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const adminGetStats    = ()             => adminFetch('/stats');
export const adminGetMe       = ()             => adminFetch('/me');
export const adminCheck       = ()             => fetch('/api/admin/check').then(r => r.json()) as Promise<{ hasAdmin: boolean }>;
export const adminSetup       = ()             => adminFetch('/setup', { method: 'POST' });
export const adminGetUsers    = (p: Record<string,string>) => adminFetch('/users?' + new URLSearchParams(p));
export const adminCreateUser  = (body: object) => adminFetch('/users', { method: 'POST', body: JSON.stringify(body) });
export const adminUpdateUser  = (id: number, body: object) => adminFetch(`/users/${id}`, { method: 'PUT',  body: JSON.stringify(body) });
export const adminDeleteUser  = (id: number)  => adminFetch(`/users/${id}`, { method: 'DELETE' });
export const adminGetLeaflets = (p: Record<string,string>) => adminFetch('/leaflets?' + new URLSearchParams(p));
export const adminDeleteLeaflet = (id: number) => adminFetch(`/leaflets/${id}`, { method: 'DELETE' });
export const adminBulkDeleteLeaflets = (ids: number[]) => adminFetch('/leaflets', { method: 'DELETE', body: JSON.stringify({ ids }) });
export const adminGetUploads  = ()             => adminFetch('/uploads');
export const adminDeleteUpload= (name: string) => adminFetch(`/uploads/${encodeURIComponent(name)}`, { method: 'DELETE' });
export const adminGetPresetIcons = ()          => adminFetch('/preset-icons');
export const adminUpdatePresetIcon = (key: string, body: object) => adminFetch(`/preset-icons/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body) });
export const adminDeletePresetIcon = (key: string) => adminFetch(`/preset-icons/${encodeURIComponent(key)}`, { method: 'DELETE' });
export const adminGetIcons    = ()             => adminFetch('/icons');
export const adminUploadIcon  = (form: FormData) => adminUpload('/icons', form);
export const adminUpdateIcon  = (id: number, body: object) => adminFetch(`/icons/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const adminDeleteIcon  = (id: number)   => adminFetch(`/icons/${id}`, { method: 'DELETE' });
export const adminGetSettings = ()             => adminFetch('/settings');
export const adminSaveSettings= (body: object) => adminFetch('/settings', { method: 'PUT', body: JSON.stringify(body) });
export const adminGetCoverTemplates = ()       => adminFetch('/cover-layout-templates');
export const adminCreateCoverTemplate = (body: object) => adminFetch('/cover-layout-templates', { method: 'POST', body: JSON.stringify(body) });
export const adminDeleteCoverTemplate = (id: string) => adminFetch(`/cover-layout-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const adminGetSEOPages = ()             => adminFetch('/seo');
export const adminUpdateSEO   = (id: number, body: object) => adminFetch(`/seo/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const adminListBackups    = ()             => adminFetch('/backup/list');
export const adminCreateBackup   = ()             => adminFetch('/backup/create', { method: 'POST' });
export const adminImportBackup   = (form: FormData) => adminUpload('/backup/import', form);
export const adminDeleteBackup   = (name: string) => adminFetch(`/backup/${encodeURIComponent(name)}`, { method: 'DELETE' });
export const adminGetBackupSettings  = ()             => adminFetch('/backup/settings');
export const adminSaveBackupSettings = (body: object) => adminFetch('/backup/settings', { method: 'PUT', body: JSON.stringify(body) });
export const adminGetPageContent  = (page: string)            => adminFetch(`/pages/${page}`);
export const adminSavePageContent = (page: string, body: object) => adminFetch(`/pages/${page}`, { method: 'PUT', body: JSON.stringify(body) });
export const adminGetHelpGroups     = ()             => adminFetch('/help-groups');
export const adminCreateHelpGroup   = (body: object) => adminFetch('/help-groups',     { method: 'POST',   body: JSON.stringify(body) });
export const adminUpdateHelpGroup   = (id: number, body: object) => adminFetch(`/help-groups/${id}`, { method: 'PUT',    body: JSON.stringify(body) });
export const adminDeleteHelpGroup   = (id: number)  => adminFetch(`/help-groups/${id}`, { method: 'DELETE' });
export const adminCreateHelpArticle = (body: object) => adminFetch('/help-articles',    { method: 'POST',   body: JSON.stringify(body) });
export const adminUpdateHelpArticle = (id: number, body: object) => adminFetch(`/help-articles/${id}`, { method: 'PUT',    body: JSON.stringify(body) });
export const adminDeleteHelpArticle = (id: number)  => adminFetch(`/help-articles/${id}`, { method: 'DELETE' });
export const adminGetCardTemplates  = ()             => adminFetch('/card-templates');
export const adminCreateCardTemplate = (body: object) => adminFetch('/card-templates', { method: 'POST', body: JSON.stringify(body) });
