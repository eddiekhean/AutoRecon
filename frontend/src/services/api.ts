import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { jwtDecode } from 'jwt-decode';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials ensures the HttpOnly refresh token cookie is sent on
  // cross-origin requests (required in production when API is on a different domain)
  withCredentials: true,
});

// ─── In-memory token store ────────────────────────────────────────────────────
// Access token lives only in JS heap — never written to localStorage or any
// persistent storage. An XSS payload that calls localStorage.getItem() finds nothing.
let inMemoryToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const clearAccessToken = (): void => {
  inMemoryToken = null;
  delete (api.defaults.headers.common as Record<string, string>)['Authorization'];
};

/** Pre-emptively check if token is about to expire (within 30s). */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
};

// ─── Refresh coordination ─────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

// ─── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (inMemoryToken) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: InternalAxiosRequestConfig & { _retry?: boolean } =
      error.config as any;

    // 503: infrastructure issue — do NOT touch tokens or trigger logout.
    // The backend returns 503 when Redis is unreachable (fail-closed design).
    if (error.response?.status === 503) {
      window.dispatchEvent(new CustomEvent('auth:maintenance'));
      return Promise.reject(error);
    }

    const is401 =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh'); // break potential refresh→refresh loop

    if (is401) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The refresh token travels as an HttpOnly cookie — no body needed.
        // The browser includes the cookie automatically.
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          null,
          { withCredentials: true }
        );

        const { access_token } = data.data;
        setAccessToken(access_token);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
