import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { Badge } from '../components/common/Badge';
import { Key, Users, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const cards = [
    {
      id: 'card-change-password',
      icon: <Key size={22} />,
      title: 'Đổi mật khẩu',
      desc: 'Cập nhật mật khẩu đăng nhập của bạn',
      to: '/change-password',
      color: 'var(--color-brand)',
    },
    ...(isAdmin
      ? [
          {
            id: 'card-manage-users',
            icon: <Users size={22} />,
            title: 'Quản lý người dùng',
            desc: 'Cấp phát, khoá / mở khoá tài khoản',
            to: '/admin/users',
            color: 'var(--color-success)',
          },
        ]
      : []),
  ];

  return (
    <MainLayout pageTitle="Dashboard">
      {/* Welcome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '20px 24px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--r-xl)',
          border: '1px solid var(--color-border)',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: '#fff',
            fontSize: '1.125rem',
            boxShadow: '0 0 20px hsl(245 82% 63% / 0.4)',
          }}
        >
          {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
            Chào mừng, {user?.full_name ?? 'Người dùng'}!
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <p className="text-muted">{user?.email}</p>
            <Badge variant={user?.role ?? ''}>{user?.role}</Badge>
          </div>
        </div>
        {isAdmin && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-brand-light)', fontSize: '0.825rem' }}>
            <ShieldCheck size={15} />
            Admin
          </div>
        )}
      </div>

      {/* Quick access cards */}
      <h3 style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Truy cập nhanh
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <Link
            key={card.id}
            id={card.id}
            to={card.to}
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'pointer',
                transition: 'border-color 180ms, transform 180ms',
                borderColor: 'var(--color-border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = card.color;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: `color-mix(in srgb, ${card.color} 15%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                }}
              >
                {card.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{card.title}</h3>
                <p className="text-muted" style={{ marginTop: 4 }}>{card.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
