import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';
import { Skeleton } from '../common/Skeleton';

/** Require authenticated user. Redirects to /login if not. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, requiresPasswordChange } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton height="24px" width="200px" />
        <Skeleton height="16px" width="320px" />
        <Skeleton height="16px" width="260px" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force user to change password before doing anything else
  if (requiresPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

/** Require ADMIN role. Redirects to / if insufficient. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
