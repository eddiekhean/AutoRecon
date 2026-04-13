import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { Badge } from '../components/common/Badge';
import { Key, Users, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const cards = [
    {
      id: 'card-change-password',
      icon: <Key size={22} />,
      title: 'Update Security Credentials',
      desc: 'Manage your account security settings',
      to: '/change-password',
      color: 'var(--color-brand)',
    },
    ...(isAdmin
      ? [
          {
            id: 'card-manage-users',
            icon: <Users size={22} />,
            title: 'Fleet Management',
            desc: 'Provision and manage user access',
            to: '/admin/users',
            color: 'var(--color-success)',
          },
        ]
      : []),
  ];

  return (
    <MainLayout pageTitle="Dashboard">
      {/* Welcome banner */}
      <div
        className="animate-page-enter"
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
            flexShrink: 0,
          }}
        >
          {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
            Welcome, {user?.full_name ?? 'User'}!
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <p className="text-muted">{user?.email}</p>
            <Badge variant={user?.role ?? ''}>{user?.role}</Badge>
          </div>
        </div>
        {isAdmin && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-brand-light)',
              fontSize: '0.825rem',
            }}
          >
            <ShieldCheck size={15} />
            Admin
          </div>
        )}
      </div>

      {/* Quick access cards */}
      <h3
        className="animate-fade-in"
        style={{
          '--delay': '80ms',
          marginBottom: 16,
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        } as React.CSSProperties}
      >
        Quick Access
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map((card, i) => (
          <Link
            key={card.id}
            id={card.id}
            to={card.to}
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card animate-card-enter"
              style={{
                '--delay': `${120 + i * 80}ms`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'pointer',
                transition: 'border-color 180ms, transform 180ms, box-shadow 180ms',
                borderColor: 'var(--color-border)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = card.color;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = `0 8px 30px ${card.color}26`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--color-border)';
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '';
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
