import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { setAccessToken, clearAccessToken, API_BASE_URL } from '../services/api';
import type { User, AuthState } from '../types';
import type { LoginFormData } from '../utils/schemas';

interface AuthContextValue extends AuthState {
  /** Returns true when the server requires a password change before any other action. */
  login: (data: LoginFormData) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    requiresPasswordChange: false,
  });

  // Bootstrap: attempt to exchange the HttpOnly refresh cookie for a fresh access token.
  // Raw axios is used intentionally — the api instance interceptors must not fire
  // during initialisation before a token exists.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          null,
          { withCredentials: true }
        );
        const { access_token } = data.data;
        setAccessToken(access_token);

        try {
          const profileRes = await userService.getMe();
          setState({
            user: profileRes.data as User,
            isAuthenticated: true,
            isLoading: false,
            requiresPasswordChange: false,
          });
        } catch (profileErr: unknown) {
          // A 403 means the account is valid but requires a password change before
          // any profile data is accessible. Treat as authenticated-but-locked, NOT
          // as an auth failure — clearing the token here would log the user out on
          // every page refresh while on /change-password.
          if ((profileErr as any)?.response?.status === 403) {
            setState({
              user: null,
              isAuthenticated: true,
              isLoading: false,
              requiresPasswordChange: true,
            });
          } else {
            throw profileErr;
          }
        }
      } catch {
        clearAccessToken();
        setState((s) => ({ ...s, isLoading: false }));
      }
    };

    bootstrap();
  }, []);

  // Listen for forced logout events dispatched by the axios interceptor.
  useEffect(() => {
    const handleForceLogout = () => {
      clearAccessToken();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        requiresPasswordChange: false,
      });
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  /**
   * Authenticates the user. Returns `true` when `requires_password_change` is set
   * so the caller can navigate directly to /change-password without a redirect round-trip.
   *
   * Security note: when `requires_password_change` is true the backend blocks every
   * route except PUT /users/me/password (returns 403). We therefore skip the profile
   * fetch in that case to avoid an unnecessary 403 round-trip.
   */
  const login = useCallback(async (data: LoginFormData): Promise<boolean> => {
    const res = await authService.login(data);
    const { access_token, requires_password_change } = res.data;

    setAccessToken(access_token);

    if (requires_password_change) {
      // Do NOT call /users/me — it is blocked with 403 until the password is changed.
      setState({
        user: null,
        isAuthenticated: true,
        isLoading: false,
        requiresPasswordChange: true,
      });
      return true;
    }

    const profileRes = await userService.getMe();
    setState({
      user: profileRes.data as User,
      isAuthenticated: true,
      isLoading: false,
      requiresPasswordChange: false,
    });
    return false;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Swallow errors — we log out locally regardless
    } finally {
      clearAccessToken();
      setState({
        user: null,
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
