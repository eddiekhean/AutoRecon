import { type ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand__icon">
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>P</span>
          </div>
          <span className="auth-brand__name">Porsche</span>
        </div>
        <div className="card card--glass">
          {children}
        </div>
      </div>
    </div>
  );
}
