export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface FieldErrors {
  general?: string;
  name?: string;
  email?: string;
  password?: string;
}

export interface AuthResponse {
  user?: AuthUser;
  token?: string;
  notice?: string;
  errors?: FieldErrors;
  switchTo?: 'login' | 'signup';
  old?: { name?: string; email?: string };
}

const TOKEN_KEY = 'leafletai_token';
const USER_KEY  = 'leafletai_user';

export function storeSession(user: AuthUser, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function post<T = AuthResponse>(path: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot connect to server. Make sure the API server is running on port 4000.');
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // Server returned non-JSON (e.g. HTML error page from proxy)
    console.error(`[API ${path}] Non-JSON response (${res.status}):`, text.slice(0, 200));
    if (res.status === 503 || res.status === 502) {
      throw new Error('Cannot connect to server. Make sure the API server is running.');
    }
    throw new Error(`Server error (${res.status}). Please refresh the page and try again.`);
  }
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return post('/api/login', { email, password });
}

export async function apiSignup(name: string, email: string, password: string): Promise<AuthResponse> {
  return post('/api/signup', { name, email, password });
}

export async function apiLogout(): Promise<void> {
  try { await post('/api/logout', {}); } catch { /* ignore */ }
  clearSession();
}

export async function apiForgotPassword(email: string): Promise<{ notice: string }> {
  return post('/api/forgot-password', { email });
}

export async function apiVerifyEmail(email: string, token: string): Promise<{ message: string }> {
  try {
    const res = await fetch(`/api/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    throw new Error('Verification failed. Please try again.');
  }
}

export async function apiMe(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { clearSession(); return null; }
    const data = await res.json();
    return data.user ?? null;
  } catch { return null; }
}
