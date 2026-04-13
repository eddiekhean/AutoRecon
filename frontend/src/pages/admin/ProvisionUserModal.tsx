import { useState, useEffect, useRef } from 'react';
import { Copy, Check, AlertTriangle, X, Clock, ShieldOff } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useNotification } from '../../context/NotificationContext';
import { adminService } from '../../services/adminService';
import { provisionUserSchema, type ProvisionUserFormData } from '../../utils/schemas';
import { getApiErrorMessage } from '../../utils/errors';
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

/** Duration (seconds) before the one-time password is auto-cleared from the DOM. */
const PASSWORD_REVEAL_TTL = 120;

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
  const [countdown, setCountdown] = useState(PASSWORD_REVEAL_TTL);
  const [expired, setExpired] = useState(false);

  /** Interval ref — cleared in cleanup and on expiry to prevent memory leaks. */
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Security timer: auto-clear the one-time password from React state and the DOM
   * after PASSWORD_REVEAL_TTL seconds. This limits the window during which an
   * unattended screen could expose the credential.
   */
  useEffect(() => {
    if (!provisioned) return;

    const expireAt = Date.now() + PASSWORD_REVEAL_TTL * 1000;
    setCountdown(PASSWORD_REVEAL_TTL);
    setExpired(false);

    tickerRef.current = setInterval(() => {
      const remaining = Math.ceil((expireAt - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(tickerRef.current!);
        tickerRef.current = null;
        setCountdown(0);
        setExpired(true);
        // Zero out the password value in React state — removes it from the virtual DOM
        setProvisioned((prev) => (prev ? { ...prev, default_password: '' } : null));
      } else {
        setCountdown(remaining);
      }
    }, 500);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [provisioned?.email]); // re-run only when a NEW user is provisioned

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
    } catch (err) {
      notify('error', 'Account Creation Failed', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!provisioned || expired) return;
    await navigator.clipboard.writeText(provisioned.default_password);
    setCopied(true);
    notify('success', 'Copied!', 'Password has been copied to clipboard.');
    setTimeout(() => setCopied(false), 3000);
  };

  /** Countdown urgency level — drives colour changes. */
  const urgency: 'normal' | 'warning' | 'danger' =
    countdown <= 15 ? 'danger' : countdown <= 30 ? 'warning' : 'normal';

  const urgencyColor =
    urgency === 'danger'
      ? 'var(--color-error)'
      : urgency === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-text-muted)';

  const progressPct = (countdown / PASSWORD_REVEAL_TTL) * 100;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div className="modal__header">
          <span className="modal__title" id="modal-title">
            {provisioned ? '✓ Account Created' : 'Provision User'}
          </span>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ─── Step 2: One-time password reveal with countdown ─── */}
        {provisioned ? (
          <div className="modal__body">
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Account for{' '}
              <strong style={{ color: 'var(--color-text-heading)' }}>{provisioned.email}</strong>{' '}
              has been created. Copy and send the password below to the user —{' '}
              <strong style={{ color: 'var(--color-warning)' }}>the system does not store it</strong>.
            </p>

            {/* Password reveal box */}
            <div
              className="password-reveal"
              style={{
                borderColor: urgency !== 'normal'
                  ? `${urgencyColor}55`
                  : 'var(--color-border)',
                transition: 'border-color 0.4s ease',
              }}
            >
              {/* Label row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="password-reveal__label">
                  <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
                  Initial Password (one-time display)
                </div>

                {/* Countdown */}
                {!expired && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: urgencyColor,
                      transition: 'color 0.4s ease',
                    }}
                    aria-live="polite"
                    aria-label={`Password will be cleared in ${countdown} seconds`}
                  >
                    <Clock size={12} aria-hidden="true" />
                    {countdown}s
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {!expired && (
                <div className="countdown-track">
                  <div
                    className="countdown-bar"
                    style={{
                      width: `${progressPct}%`,
                      background: urgency === 'danger'
                        ? 'var(--color-error)'
                        : urgency === 'warning'
                        ? 'var(--color-warning)'
                        : 'var(--color-brand)',
                      transition: 'width 0.5s linear, background 0.4s ease',
                    }}
                    role="progressbar"
                    aria-valuenow={countdown}
                    aria-valuemin={0}
                    aria-valuemax={PASSWORD_REVEAL_TTL}
                  />
                </div>
              )}

              {/* Password value / expired overlay */}
              {expired ? (
                <div className="password-reveal__expired">
                  <ShieldOff size={18} aria-hidden="true" />
                  <span>Password has been cleared from display for security</span>
                </div>
              ) : (
                <div className="password-reveal__value">
                  <span
                    style={{ flex: 1, userSelect: 'all' }}
                    aria-label="Initial password"
                  >
                    {provisioned.default_password}
                  </span>
                  <Button
                    id="btn-copy-password"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    leftIcon={copied ? <Check size={15} /> : <Copy size={15} />}
                    disabled={expired}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>

            <div className="modal__footer" style={{ padding: 0, border: 'none' }}>
              <Button id="btn-modal-done" variant="primary" fullWidth onClick={onClose}>
                Done
              </Button>
            </div>
          </div>

        ) : (
          /* ─── Step 1: Provision form ─── */
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal__body">
              <Input
                id="provision-fullname"
                label="Full Name"
                type="text"
                placeholder="John Smith"
                autoFocus
                value={form.full_name}
                onChange={set('full_name')}
                error={errors.full_name}
              />

              <Input
                id="provision-email"
                label="Email"
                type="email"
                placeholder="john@company.com"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
              />

              <div className="input-group">
                <label className="input-label" htmlFor="provision-role">
                  Role
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
                Cancel
              </Button>
              <Button id="btn-modal-submit" type="submit" loading={loading}>
                Create Account
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
