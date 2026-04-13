import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Lock, Unlock, RefreshCw, Users, Pencil } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SkeletonRow } from '../../components/common/Skeleton';
import { ProvisionUserModal } from './ProvisionUserModal';
import { UserDetailModal } from './UserDetailModal';
import { useNotification } from '../../context/NotificationContext';
import { adminService } from '../../services/adminService';
import { getApiErrorMessage } from '../../utils/errors';
import type { UserListItem } from '../../types';

const ROLES = ['', 'ADMIN', 'SALE', 'VIEWER'];
const STATUSES = ['', 'ACTIVE', 'INACTIVE'];

export function UserList() {
  const { notify } = useNotification();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (roleFilter)   filters.role   = roleFilter;
      if (statusFilter) filters.status = statusFilter;
      const res = await adminService.listUsers(filters);
      setUsers(res.data as UserListItem[]);
    } catch {
      notify('error', 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, notify]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user: UserListItem) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTogglingId(user.user_id);
    try {
      await adminService.updateStatus(user.user_id, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, status: newStatus } : u))
      );
      notify(
        'success',
        newStatus === 'INACTIVE' ? 'Account Locked' : 'Account Unlocked',
        `${user.full_name} — ${newStatus}`
      );
    } catch (err) {
      notify('error', 'Action Failed', getApiErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso)
    );

  return (
    <MainLayout pageTitle="Fleet Management">
      {/* Header */}
      <div className="page-header animate-page-enter">
        <div>
          <h2 className="page-title">Users</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            {loading ? '...' : `${users.length} accounts`}
          </p>
        </div>
        <Button
          id="btn-new-user"
          leftIcon={<UserPlus size={16} />}
          onClick={() => setShowModal(true)}
        >
          Provision User
        </Button>
      </div>

      {/* Filters */}
      <div
        className="filter-bar animate-fade-in"
        style={{ '--delay': '60ms' } as React.CSSProperties}
      >
        <select
          id="filter-role"
          className="filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="">All Roles</option>
          {ROLES.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          id="filter-status"
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <Button
          id="btn-refresh"
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          onClick={fetchUsers}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div
        className="card animate-fade-in"
        style={{ padding: 0, '--delay': '120ms' } as React.CSSProperties}
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                </>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="table-empty-state">
                      <Users size={32} className="table-empty-state__icon" aria-hidden="true" />
                      <p className="table-empty-state__text">No users found</p>
                      <p className="table-empty-state__hint">Try adjusting filters or create a new account</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <tr
                    key={user.user_id}
                    className="animate-row-enter"
                    style={{ '--delay': `${Math.min(i * 40, 480)}ms` } as React.CSSProperties}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            background: 'var(--color-brand)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--color-text-heading)', fontWeight: 500 }}>
                          {user.full_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {user.email}
                    </td>
                    <td>
                      <Badge variant={user.role}>{user.role}</Badge>
                    </td>
                    <td>
                      <Badge variant={user.status}>
                        {user.status === 'ACTIVE' ? '● Active' : '○ Inactive'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(user.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Button
                          id={`btn-edit-${user.user_id}`}
                          variant="ghost"
                          size="sm"
                          leftIcon={<Pencil size={13} />}
                          onClick={() => setDetailUserId(user.user_id)}
                        >
                          Edit
                        </Button>
                        <Button
                          id={`btn-toggle-${user.user_id}`}
                          variant={user.status === 'ACTIVE' ? 'danger' : 'success'}
                          size="sm"
                          loading={togglingId === user.user_id}
                          leftIcon={user.status === 'ACTIVE' ? <Lock size={13} /> : <Unlock size={13} />}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.status === 'ACTIVE' ? 'Lock' : 'Unlock'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <ProvisionUserModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchUsers}
        />
      )}
      {detailUserId && (
        <UserDetailModal
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onSuccess={fetchUsers}
        />
      )}
    </MainLayout>
  );
}
