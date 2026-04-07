import { type ReactNode } from 'react';
import { Shield } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand__icon">
            <Shield size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="auth-brand__name">AutoRecon</span>
        </div>
        <div className="card card--glass">
          {children}
        </div>
      </div>
    </div>
  );
}
