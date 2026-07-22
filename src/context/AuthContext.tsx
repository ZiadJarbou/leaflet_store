import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AuthUser, AuthResponse } from '../services/authService';
import {
  storeSession, clearSession, getStoredUser,
  apiLogin, apiSignup, apiLogout, apiMe,
} from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  authModalOpen: boolean;
  authView: 'login' | 'signup';
  setAuthView: (v: 'login' | 'signup') => void;
  openAuthModal: (view?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  submitLogin: (email: string, password: string) => Promise<AuthResponse>;
  submitSignup: (name: string, email: string, password: string) => Promise<AuthResponse>;
  notice: string;
  setNotice: (n: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<AuthUser | null>(getStoredUser);
  const [loading, setLoading]         = useState(true);
  const [authModalOpen, setOpen]      = useState(false);  // always starts closed
  const [authView, setAuthView]       = useState<'login' | 'signup'>('login');
  const [notice, setNotice]           = useState('');

  useEffect(() => {
    apiMe()
      .then(u => {
        if (u) setUser(u);
        else if (!getStoredUser()) setUser(null);
      })
      .catch(() => { /* network error — keep stored user if any */ })
      .finally(() => setLoading(false));
  }, []);

  async function submitLogin(email: string, password: string): Promise<AuthResponse> {
    const res = await apiLogin(email, password);
    if (res.user && res.token) {
      storeSession(res.user, res.token);
      setUser(res.user);
      if (res.notice) setNotice(res.notice);
    }
    return res;
  }

  async function submitSignup(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await apiSignup(name, email, password);
    if (res.user && res.token) {
      storeSession(res.user, res.token);
      setUser(res.user);
      if (res.notice) setNotice(res.notice);
    }
    return res;
  }

  async function logout() {
    await apiLogout();
    clearSession();
    setUser(null);
  }

  const openAuthModal = useCallback((view: 'login' | 'signup' = 'login') => {
    setAuthView(view);
    setOpen(true);
  }, []);
  const closeAuthModal = useCallback(() => setOpen(false), []);

  return (
    <AuthContext.Provider value={{
      user, loading, logout,
      authModalOpen, authView, setAuthView, openAuthModal, closeAuthModal,
      submitLogin, submitSignup,
      notice, setNotice,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
