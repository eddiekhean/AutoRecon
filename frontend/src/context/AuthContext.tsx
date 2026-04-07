import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import type { User, AuthState } from '../types';
import type { LoginFormData } from '../utils/schemas';

interface AuthContextValue extends AuthState {
  login: (data: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: localStorage.getItem('access_token'),
    refreshToken: localStorage.getItem('refresh_token'),
    isAuthenticated: false,
    isLoading: true,
    requiresPasswordChange: false,
  });

  // Load user profile on startup to prevent login-page flash
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      try {
        const res = await userService.getMe();
        setState((s) => ({
          ...s,
          user: res.data as User,
          isAuthenticated: true,
          isLoading: false,
        }));
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setState((s) => ({ ...s, isLoading: false }));
      }
    };

    bootstrap();
  }, []);

  // Listen for forced logout events from the axios interceptor
  useEffect(() => {
    const handleForceLogout = () => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        requiresPasswordChange: false,
      });
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const login = useCallback(async (data: LoginFormData) => {
    const res = await authService.login(data);
    const { access_token, refresh_token, requires_password_change } = res.data;

    localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);

    // Fetch profile immediately after login
    const profileRes = await userService.getMe();

    setState({
      user: profileRes.data as User,
      accessToken: access_token,
      refreshToken: refresh_token ?? null,
      isAuthenticated: true,
      isLoading: false,
      requiresPasswordChange: requires_password_change ?? false,
    });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // Swallow errors — we log out locally regardless
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        requiresPasswordChange: false,
      });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await userService.getMe();
    setState((s) => ({ ...s, user: res.data as User }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
