import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

function BootstrapLoader() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Animated brand dot */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid var(--color-brand-alpha)',
            borderTop: '3px solid var(--color-brand)',
            animation: 'spin 0.8s linear infinite',
          }}
          aria-label="Đang tải..."
          role="status"
        />
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Đang xác thực phiên…
        </p>
      </div>
    </div>
  );
}

/** Require authenticated user. Redirects to /login if not. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, requiresPasswordChange } = useAuth();
  const location = useLocation();

  if (isLoading) return <BootstrapLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Strict guard: if password change is required, ALL routes except /change-password are blocked.
  // This mirrors the backend 403 enforcement for requires_password_change.
  if (requiresPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

/** Require ADMIN role. Redirects to / if insufficient. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.role?.toUpperCase() !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
