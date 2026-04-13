import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthGuard, AdminGuard } from './components/guards/Guards';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ChangePassword } from './pages/ChangePassword';
import { UserList } from './pages/admin/UserList';

/**
 * MaintenanceBanner — shown when the backend returns 503 (Redis unavailable).
 * Per the fail-closed policy: DO NOT clear tokens or redirect on 503.
 * The user's session is intact; it is an infrastructure issue.
 */
function MaintenanceBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="maintenance-banner" role="status" aria-live="polite">
      <AlertTriangle size={15} className="maintenance-banner__icon" aria-hidden="true" />
      <span className="maintenance-banner__text">
        Authentication service is temporarily unavailable. Your session is safe — please try again in a moment.
      </span>
      <button
        className="maintenance-banner__close"
        onClick={onDismiss}
        aria-label="Dismiss maintenance notice"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function App() {
  const [showMaintenance, setShowMaintenance] = useState(false);

  useEffect(() => {
    const handler = () => setShowMaintenance(true);
    window.addEventListener('auth:maintenance', handler);
    return () => window.removeEventListener('auth:maintenance', handler);
  }, []);

  return (
    <BrowserRouter>
      {/* Global maintenance banner — does NOT touch auth state (fail-closed) */}
      {showMaintenance && (
        <MaintenanceBanner onDismiss={() => setShowMaintenance(false)} />
      )}

      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — any authenticated user */}
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Dashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/change-password"
              element={
                <AuthGuard>
                  <ChangePassword />
                </AuthGuard>
              }
            />

            {/* Protected — Admin only */}
            <Route
              path="/admin/users"
              element={
                <AuthGuard>
                  <AdminGuard>
                    <UserList />
                  </AdminGuard>
                </AuthGuard>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
