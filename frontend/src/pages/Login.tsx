import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { loginSchema, type LoginFormData } from '../utils/schemas';

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
      fieldErrors[key] = issue.message;
    });
    setErrors(fieldErrors);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login(form);
      notify('success', 'Đăng nhập thành công', 'Chào mừng trở lại!');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Email hoặc mật khẩu không chính xác.';
      notify('error', 'Đăng nhập thất bại', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ padding: '32px 28px' }}>
        <h2 className="auth-card__title">Đăng nhập</h2>
        <p className="auth-card__subtitle">
          Nhập thông tin tài khoản để tiếp tục
        </p>

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <Input
            id="login-email"
            label="Email"
            type="email"
            placeholder="ten@congty.com"
            autoComplete="email"
            autoFocus
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errors.email}
            leftIcon={<Mail size={16} />}
          />

          <Input
            id="login-password"
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            error={errors.password}
            leftIcon={<Lock size={16} />}
          />

          <Button
            id="btn-login"
            type="submit"
            fullWidth
            size="lg"
            loading={loading}
            style={{ marginTop: 6 }}
          >
            Đăng nhập
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
