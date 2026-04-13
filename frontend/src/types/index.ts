export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'SALE' | string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresPasswordChange: boolean;
}

export interface UserListItem {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface UserDetail {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  role_id: number;
  status: 'ACTIVE' | 'INACTIVE';
  requires_password_change: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProvisionedUser {
  user_id: string;
  email: string;
  default_password: string;
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
}
