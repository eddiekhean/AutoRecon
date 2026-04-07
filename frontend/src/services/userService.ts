import api from './api';
import type { ChangePasswordFormData } from '../utils/schemas';

export const userService = {
  getMe: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },
  changePassword: async (data: Omit<ChangePasswordFormData, 'confirm_password'>) => {
    const response = await api.put('/users/me/password', data);
    return response.data;
  },
};
