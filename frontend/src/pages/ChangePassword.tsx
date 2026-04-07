import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { MainLayout } from '../components/layout/MainLayout';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { userService } from '../services/userService';
import { changePasswordSchema, type ChangePasswordFormData } from '../utils/schemas';

type FieldErrors = Partial<Record<keyof ChangePasswordFormData, string>>;

export function ChangePassword() {
  const navigate = useNavigate();
  const { requiresPasswordChange, logout } = useAuth();
  const { notify } = useNotification();

  const [form, setForm] = useState<ChangePasswordFormData>({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof ChangePasswordFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): boolean => {
    const result = changePasswordSchema.safeParse(form);
    if (result.success) { setErrors({}); return true; }
    const fieldErrors: FieldErrors = {};
    result.error.issues.forEach((issue) => {
      const key = issue.path[0] as keyof ChangePasswordFormData;
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
      await userService.changePassword({
        old_password: form.old_password,
        new_password: form.new_password,
      });

      notify(
        'success',
        'Đổi mật khẩu thành công',
        'Vui lòng đăng nhập lại với mật khẩu mới.'
      );

      // Server revokes all sessions — we must log out locally too
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Có lỗi xảy ra. Vui lòng thử lại.';
      notify('error', 'Đổi mật khẩu thất bại', msg);
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form style={{ display: 'flex', flexDirection: 'column', gap: 18 }} onSubmit={handleSubmit} noValidate>
      {requiresPasswordChange && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--color-warning-bg)',
            border: '1px solid hsl(38 92% 50% / 0.3)',
            alignItems: 'flex-start',
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', margin: 0, lineHeight: 1.5 }}>
            Tài khoản mới yêu cầu bạn đổi mật khẩu trước khi sử dụng hệ thống.
          </p>
        </div>
      )}

      <Input
        id="old-password"
        label="Mật khẩu hiện tại"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        autoFocus
        value={form.old_password}
        onChange={set('old_password')}
        error={errors.old_password}
        leftIcon={<Lock size={16} />}
      />

      <Input
        id="new-password"
        label="Mật khẩu mới"
        type="password"
        placeholder="Tối thiểu 12 ký tự"
        autoComplete="new-password"
        value={form.new_password}
        onChange={set('new_password')}
        error={errors.new_password}
        leftIcon={<Lock size={16} />}
      />

      <Input
        id="confirm-password"
        label="Xác nhận mật khẩu mới"
        type="password"
        placeholder="Nhập lại mật khẩu mới"
        autoComplete="new-password"
        value={form.confirm_password}
        onChange={set('confirm_password')}
        error={errors.confirm_password}
        leftIcon={<Lock size={16} />}
      />

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: -4 }}>
        Phải có ít nhất 12 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
      </p>

      <Button
        id="btn-change-password"
        type="submit"
        fullWidth
        loading={loading}
        style={{ marginTop: 4 }}
      >
        Cập nhật mật khẩu
      </Button>
    </form>
  );

  // If forced change — show standalone auth layout, otherwise inside main layout
  if (requiresPasswordChange) {
    return (
      <AuthLayout>
        <div style={{ padding: '32px 28px' }}>
          <h2 className="auth-card__title">Đặt mật khẩu mới</h2>
          <p className="auth-card__subtitle">Tài khoản của bạn yêu cầu đổi mật khẩu lần đầu</p>
          {formContent}
        </div>
      </AuthLayout>
    );
  }

  return (
    <MainLayout pageTitle="Đổi mật khẩu">
      <div style={{ maxWidth: 480 }}>
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Đổi mật khẩu</h3>
          {formContent}
        </div>
      </div>
    </MainLayout>
  );
}
