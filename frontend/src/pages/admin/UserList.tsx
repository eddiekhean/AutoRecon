import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Lock, Unlock, RefreshCw } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SkeletonRow } from '../../components/common/Skeleton';
import { ProvisionUserModal } from './ProvisionUserModal';
import { useNotification } from '../../context/NotificationContext';
import { adminService } from '../../services/adminService';
import type { UserListItem } from '../../types';

const ROLES = ['', 'ADMIN', 'SALE', 'VIEWER'];
const STATUSES = ['', 'ACTIVE', 'INACTIVE'];

export function UserList() {
  const { notify } = useNotification();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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
        newStatus === 'INACTIVE' ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản',
        `${user.full_name} — ${newStatus}`
      );
    } catch (err: any) {
      notify('error', 'Thao tác thất bại', err?.response?.data?.message);
    } finally {
      setTogglingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso)
    );

  return (
    <MainLayout pageTitle="Quản lý người dùng">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Người dùng</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            {loading ? '...' : `${users.length} tài khoản`}
          </p>
        </div>
        <Button
          id="btn-new-user"
          leftIcon={<UserPlus size={16} />}
          onClick={() => setShowModal(true)}
        >
          Cấp tài khoản mới
        </Button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select
          id="filter-role"
          className="filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Lọc theo chức vụ"
        >
          <option value="">Tất cả chức vụ</option>
          {ROLES.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          id="filter-status"
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Lọc theo trạng thái"
        >
          <option value="">Tất cả trạng thái</option>
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
          Làm mới
        </Button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Chức vụ</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
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
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      padding: '48px 16px',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.9rem',
                    }}
                  >
                    Không tìm thấy người dùng nào
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.user_id}>
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
                        {user.status === 'ACTIVE' ? '● Hoạt động' : '○ Đã khoá'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(user.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        id={`btn-toggle-${user.user_id}`}
                        variant={user.status === 'ACTIVE' ? 'danger' : 'success'}
                        size="sm"
                        loading={togglingId === user.user_id}
                        leftIcon={
                          user.status === 'ACTIVE' ? (
                            <Lock size={13} />
                          ) : (
                            <Unlock size={13} />
                          )
                        }
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.status === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ProvisionUserModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchUsers}
        />
      )}
    </MainLayout>
  );
}
