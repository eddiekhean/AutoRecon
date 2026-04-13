import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { loginSchema, type LoginFormData } from '../utils/schemas';
import { getApiErrorMessage } from '../utils/errors';

type FieldErrors = Partial<Record<keyof LoginFormData, string>>;

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { notify } = useNotification();

  const [form, setForm] = useState<LoginFormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const result = loginSchema.safeParse(form);
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: FieldErrors = {};
    result.error.issues.forEach((issue) => {
      const key = issue.path[0] as keyof LoginFormData;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    });
    setErrors(fieldErrors);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const requiresPasswordChange = await login(form);
      if (requiresPasswordChange) {
        // Navigate directly — avoids a redirect round-trip through AuthGuard
        navigate('/change-password', { replace: true });
      } else {
        notify('success', 'Login Successful', 'Welcome back!');
        navigate('/', { replace: true });
      }
    } catch (err) {
      // Use the centralised error mapper — never display raw server messages
      notify('error', 'Login Failed', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="animate-page-enter" style={{ padding: '32px 28px' }}>
        <h2 className="auth-card__title">Sign In</h2>
        <p className="auth-card__subtitle">Enter your credentials to access your account</p>

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <div className="animate-fade-in" style={{ '--delay': '60ms' } as React.CSSProperties}>
            <Input
              id="login-email"
              label="Email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
              leftIcon={<Mail size={16} />}
            />
          </div>

          <div className="animate-fade-in" style={{ '--delay': '120ms' } as React.CSSProperties}>
            <Input
              id="login-password"
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={errors.password}
              leftIcon={<Lock size={16} />}
            />
          </div>

          <div className="animate-fade-in" style={{ '--delay': '180ms' } as React.CSSProperties}>
            <Button
              id="btn-login"
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              style={{ marginTop: 6 }}
            >
              Sign In
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
