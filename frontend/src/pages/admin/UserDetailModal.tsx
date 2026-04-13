import { useState, useEffect, useRef } from 'react';
import { X, Save, RotateCcw, Copy, Check, AlertTriangle, Clock, ShieldOff, User } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useNotification } from '../../context/NotificationContext';
import { adminService } from '../../services/adminService';
import { getApiErrorMessage } from '../../utils/errors';
import type { UserDetail } from '../../types';

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = [
  { id: 1, label: 'ADMIN' },
  { id: 2, label: 'SALE' },
  { id: 3, label: 'VIEWER' },
];

const PASSWORD_REVEAL_TTL = 120;

export function UserDetailModal({ userId, onClose, onSuccess }: UserDetailModalProps) {
  const { notify } = useNotification();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail]       = useState('');
  const [editRoleId, setEditRoleId]     = useState(2);
  const [saving, setSaving]             = useState(false);

  // Reset password state
  const [resetting, setResetting]     = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [countdown, setCountdown]     = useState(PASSWORD_REVEAL_TTL);
  const [expired, setExpired]         = useState(false);
  // Incremented each time a reset happens — drives the countdown useEffect
  const [resetKey, setResetKey]       = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // `onClose` is intentionally omitted from deps — it's an inline arrow in the parent
  // that changes reference on every render. Including it would re-fetch on each parent
  // re-render (e.g. after fetchUsers completes). The callback is stable in intent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminService.getUser(userId);
        if (!cancelled) {
          const u: UserDetail = res.data;
          setUser(u);
          setEditFullName(u.full_name);
          setEditEmail(u.email);
          setEditRoleId(u.role_id);
        }
      } catch {
        notify('error', 'Failed to Load User', 'Unable to load user details.');
        if (!cancelled) onClose();
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, notify]);

  // Password auto-clear countdown.
  // Keyed on `resetKey` which increments every time a new password is issued —
  // this ensures the timer restarts correctly even if the previous one expired
  // (leaving newPassword as '' which is falsy and would break a newPassword dep).
  useEffect(() => {
    if (!newPassword) return;
    const expireAt = Date.now() + PASSWORD_REVEAL_TTL * 1000;
    setCountdown(PASSWORD_REVEAL_TTL);
    setExpired(false);
    tickerRef.current = setInterval(() => {
      const remaining = Math.ceil((expireAt - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(tickerRef.current!);
        setCountdown(0);
        setExpired(true);
        setNewPassword('');
      } else {
        setCountdown(remaining);
      }
    }, 500);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleSave = async () => {
    if (!user) return;
    const payload: { full_name?: string; email?: string; role_id?: number } = {};
    if (editFullName !== user.full_name) payload.full_name = editFullName;
    if (editEmail    !== user.email)     payload.email     = editEmail;
    if (editRoleId   !== user.role_id)   payload.role_id   = editRoleId;

    if (Object.keys(payload).length === 0) {
      notify('info', 'No Changes', 'No changes to save.');
      return;
    }

    setSaving(true);
    try {
      await adminService.updateUser(user.user_id, payload);
      notify('success', 'Update Successful', `${editFullName} has been updated`);
      onSuccess();
      onClose();
    } catch (err) {
      notify('error', 'Update Failed', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    setResetting(true);
    try {
      const res = await adminService.resetPassword(user.user_id);
      setNewPassword(res.data.default_password);
      setResetKey((k) => k + 1); // triggers a fresh countdown regardless of previous state
      notify('success', 'Temporary Password Created', 'User must change password on next login');
    } catch (err) {
      notify('error', 'Password Reset Failed', getApiErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  const handleCopy = async () => {
    if (!newPassword || expired) return;
    await navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPct = (countdown / PASSWORD_REVEAL_TTL) * 100;
  const urgencyClass =
    countdown <= 15 ? 'countdown-bar--danger' :
    countdown <= 30 ? 'countdown-bar--warning' : '';

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div
        className="modal animate-page-enter"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={18} style={{ color: 'var(--color-brand)' }} />
            <h3 className="modal__title">User Details</h3>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loadingUser ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading...
          </div>
        ) : user ? (
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Status badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge variant={user.status}>
                {user.status === 'ACTIVE' ? '● Active' : '○ Inactive'}
              </Badge>
              {user.requires_password_change && (
                <span className="badge badge--warning">⚠ Password Change Required</span>
              )}
            </div>

            {/* Meta */}
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span>Created: {formatDate(user.created_at)}</span>
              <span>Updated: {formatDate(user.updated_at)}</span>
            </div>

            <hr style={{ borderColor: 'var(--color-border)', margin: '0' }} />

            {/* Edit form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-heading)', fontWeight: 600 }}>
                Edit Information
              </h4>

              <Input
                id="edit-full-name"
                label="Full Name"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Enter full name"
              />

              <Input
                id="edit-email"
                label="Email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Enter email address"
              />

              <div className="form-group">
                <label className="form-label" htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(Number(e.target.value))}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <Button
                id="btn-save-user"
                leftIcon={<Save size={15} />}
                loading={saving}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </div>

            <hr style={{ borderColor: 'var(--color-border)', margin: '0' }} />

            {/* Reset password section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-heading)', fontWeight: 600 }}>
                Reset Password
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Create a temporary password. User must change it on next login. All active sessions will be revoked.
              </p>

              {newPassword !== null && (
                <div className={`password-reveal ${expired ? 'password-reveal--expired' : ''}`}>
                  {expired ? (
                    <div className="password-reveal__expired">
                      <ShieldOff size={20} />
                      <span>Password has been cleared from display</span>
                    </div>
                  ) : (
                    <>
                      <div className="password-reveal__header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          <Clock size={13} />
                          <span>Auto-clears in {countdown}s</span>
                        </div>
                        <button
                          className="password-reveal__copy"
                          onClick={handleCopy}
                          disabled={expired}
                          aria-label="Copy password"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div className="countdown-track">
                        <div
                          className={`countdown-bar ${urgencyClass}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="password-reveal__value">
                        <code>{newPassword}</code>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>This password displays only once and will disappear after {PASSWORD_REVEAL_TTL} seconds.</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <Button
                id="btn-reset-password"
                variant="danger"
                leftIcon={<RotateCcw size={15} />}
                loading={resetting}
                onClick={handleResetPassword}
              >
                Reset Password
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
