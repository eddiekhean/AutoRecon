import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthGuard, AdminGuard } from './components/guards/Guards';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ChangePassword } from './pages/ChangePassword';
import { UserList } from './pages/admin/UserList';

export default function App() {
  return (
    <BrowserRouter>
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
