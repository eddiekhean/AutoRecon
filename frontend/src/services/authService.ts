import api from './api';
import type { LoginFormData } from '../utils/schemas';

export const authService = {
  login: async (data: LoginFormData) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  logout: async (refreshToken: string) => {
    const response = await api.post('/auth/logout', { refresh_token: refreshToken });
    return response.data;
  },
  refresh: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },
};
