import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Users,
  LogOut,
  Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

interface MainLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function MainLayout({ children, pageTitle }: MainLayoutProps) {
  const { user, logout } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      notify('error', 'Lỗi đăng xuất', 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((p) => p[0]).slice(-2).join('').toUpperCase()
    : '?';

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">
            <Shield size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="sidebar__brand-name">AutoRecon</span>
        </div>

        <nav className="sidebar__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item${isActive ? ' nav-item--active' : ''}`
            }
          >
            <LayoutDashboard size={17} />
            Dashboard
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item--active' : ''}`
              }
            >
              <Users size={17} />
              Quản lý người dùng
            </NavLink>
          )}

          <NavLink
            to="/change-password"
            className={({ isActive }) =>
              `nav-item${isActive ? ' nav-item--active' : ''}`
            }
          >
            <Key size={17} />
            Đổi mật khẩu
          </NavLink>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{initials}</div>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">{user?.full_name ?? '—'}</div>
              <div className="sidebar__user-role">{user?.role ?? ''}</div>
            </div>
          </div>
          <button
            className="nav-item"
            onClick={handleLogout}
            style={{ marginTop: 6, color: 'var(--color-error)' }}
            id="btn-logout"
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {pageTitle && (
          <header className="topbar">
            <h1 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0 }}>
              {pageTitle}
            </h1>
          </header>
        )}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
