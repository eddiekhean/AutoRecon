import { useState } from 'react';
import { Copy, Check, AlertTriangle, X } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useNotification } from '../../context/NotificationContext';
import { adminService } from '../../services/adminService';
import { provisionUserSchema, type ProvisionUserFormData } from '../../utils/schemas';
import type { ProvisionedUser } from '../../types';

interface ProvisionUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type FieldErrors = Partial<Record<keyof ProvisionUserFormData, string>>;

const ROLES = [
  { id: 2, label: 'SALE' },
  { id: 3, label: 'VIEWER' },
];

export function ProvisionUserModal({ onClose, onSuccess }: ProvisionUserModalProps) {
  const { notify } = useNotification();
  const [form, setForm] = useState<ProvisionUserFormData>({
    full_name: '',
    email: '',
    role_id: 2,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [provisioned, setProvisioned] = useState<ProvisionedUser | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (key: keyof ProvisionUserFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): boolean => {
    const result = provisionUserSchema.safeParse(form);
    if (result.success) { setErrors({}); return true; }
    const fe: FieldErrors = {};
    result.error.issues.forEach((issue) => {
      const key = issue.path[0] as keyof ProvisionUserFormData;
      if (!fe[key]) fe[key] = issue.message;
    });
    setErrors(fe);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await adminService.provisionUser(form);
      setProvisioned(res.data as ProvisionedUser);
      onSuccess();
    } catch (err: any) {
      notify('error', 'Tạo tài khoản thất bại', err?.response?.data?.message ?? 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!provisioned) return;
    await navigator.clipboard.writeText(provisioned.default_password);
    setCopied(true);
    notify('success', 'Đã sao chép!', 'Mật khẩu đã được sao chép vào clipboard.');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div className="modal__header">
          <span className="modal__title" id="modal-title">
            {provisioned ? '✓ Tài khoản đã tạo' : 'Cấp tài khoản mới'}
          </span>
          <button className="modal__close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* ─── Step 2: Show one-time password ─── */}
        {provisioned ? (
          <div className="modal__body">
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Tài khoản cho <strong style={{ color: 'var(--color-text-heading)' }}>{provisioned.email}</strong> đã được tạo thành công.
              Hãy sao chép và gửi mật khẩu bên dưới cho nhân sự — hệ thống <strong style={{ color: 'var(--color-warning)' }}>không lưu lại</strong> thông tin này.
            </p>

            <div className="password-reveal">
              <div className="password-reveal__label">
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />
                Mật khẩu khởi tạo (chỉ hiển thị 1 lần)
              </div>
              <div className="password-reveal__value">
                <span style={{ flex: 1 }}>{provisioned.default_password}</span>
                <Button
                  id="btn-copy-password"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  leftIcon={copied ? <Check size={15} /> : <Copy size={15} />}
                >
                  {copied ? 'Đã sao chép' : 'Sao chép'}
                </Button>
              </div>
            </div>

            <div className="modal__footer" style={{ padding: 0, border: 'none' }}>
              <Button id="btn-modal-done" variant="primary" fullWidth onClick={onClose}>
                Đã xong
              </Button>
            </div>
          </div>
        ) : (
          /* ─── Step 1: Form ─── */
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal__body">
              <Input
                id="provision-fullname"
                label="Họ và tên"
                type="text"
                placeholder="Nguyễn Văn B"
                autoFocus
                value={form.full_name}
                onChange={set('full_name')}
                error={errors.full_name}
              />

              <Input
                id="provision-email"
                label="Email"
                type="email"
                placeholder="sale02@company.com"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
              />

              <div className="input-group">
                <label className="input-label" htmlFor="provision-role">
                  Chức vụ
                </label>
                <select
                  id="provision-role"
                  className="filter-select"
                  style={{ width: '100%', padding: '11px 12px' }}
                  value={form.role_id}
                  onChange={set('role_id')}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {errors.role_id && (
                  <span className="input__error-msg">{errors.role_id}</span>
                )}
              </div>
            </div>

            <div className="modal__footer">
              <Button id="btn-modal-cancel" variant="ghost" type="button" onClick={onClose}>
                Huỷ
              </Button>
              <Button id="btn-modal-submit" type="submit" loading={loading}>
                Tạo tài khoản
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
