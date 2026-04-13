import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { MainLayout } from '../components/layout/MainLayout';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { userService } from '../services/userService';
import { changePasswordSchema, type ChangePasswordFormData } from '../utils/schemas';
import { getApiErrorMessage } from '../utils/errors';

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

  const set = (key: keyof ChangePasswordFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
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
        'Password Update Successful',
        'Please log in again with your new password.'
      );

      // Server has revoked all sessions — clear local state and redirect to login
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      notify('error', 'Password Update Failed', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form style={{ display: 'flex', flexDirection: 'column', gap: 18 }} onSubmit={handleSubmit} noValidate>
      <Input
        id="old-password"
        label="Current Password"
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
        label="New Password"
        type="password"
        placeholder="Minimum 12 characters"
        autoComplete="new-password"
        value={form.new_password}
        onChange={set('new_password')}
        error={errors.new_password}
        leftIcon={<Lock size={16} />}
      />

      <Input
        id="confirm-password"
        label="Confirm New Password"
        type="password"
        placeholder="Re-enter new password"
        autoComplete="new-password"
        value={form.confirm_password}
        onChange={set('confirm_password')}
        error={errors.confirm_password}
        leftIcon={<Lock size={16} />}
      />

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: -4 }}>
        Must be at least 12 characters with uppercase, lowercase, numbers, and special characters.
      </p>

      <Button
        id="btn-change-password"
        type="submit"
        fullWidth
        loading={loading}
        style={{ marginTop: 4 }}
      >
        Update Password
      </Button>
    </form>
  );

  // Forced-change mode: full-screen auth layout with security lock visual
  if (requiresPasswordChange) {
    return (
      <AuthLayout>
        <div className="animate-page-enter" style={{ padding: '32px 28px' }}>
          {/* High-impact forced-change warning banner */}
          <div className="forced-change-banner">
            <div className="forced-change-banner__icon-wrap">
              <ShieldAlert size={28} className="forced-change-banner__icon" />
            </div>
            <div>
              <h2 className="auth-card__title" style={{ marginBottom: 4 }}>
                Set New Password
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', margin: 0, lineHeight: 1.5 }}>
                Your account requires a password change before using the system.
                All other actions are blocked until this is completed.
              </p>
            </div>
          </div>

          {formContent}
        </div>
      </AuthLayout>
    );
  }

  // Regular change-password view inside the main layout
  return (
    <MainLayout pageTitle="Security Settings">
      <div className="animate-page-enter" style={{ maxWidth: 480 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: 'var(--r-md)',
              background: '#dc143c20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-brand)',
            }}>
              <ShieldCheck size={18} />
            </div>
            <h3 style={{ margin: 0 }}>Change Password</h3>
          </div>
          {formContent}
        </div>
      </div>
    </MainLayout>
  );
}
