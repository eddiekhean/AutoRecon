import api from './api';
import type { ProvisionUserFormData, UserStatus } from '../utils/schemas';

export const adminService = {
  provisionUser: async (data: ProvisionUserFormData) => {
    const response = await api.post('/admin/users', data);
    return response.data;
  },
  listUsers: async (filters?: { role?: string; status?: string }) => {
    const response = await api.get('/admin/users', { params: filters });
    return response.data;
  },
  getUser: async (id: string) => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },
  updateUser: async (id: string, data: { full_name?: string; email?: string; role_id?: number }) => {
    const response = await api.patch(`/admin/users/${id}`, data);
    return response.data;
  },
  updateStatus: async (id: string, status: UserStatus) => {
    const response = await api.put(`/admin/users/${id}/status`, { status });
    return response.data;
  },
  resetPassword: async (id: string) => {
    const response = await api.post(`/admin/users/${id}/reset-password`);
    return response.data;
  },
};
