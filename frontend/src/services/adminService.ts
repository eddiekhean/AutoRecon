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
  updateStatus: async (id: string, status: UserStatus) => {
    const response = await api.put(`/admin/users/${id}/status`, { status });
    return response.data;
  },
};
