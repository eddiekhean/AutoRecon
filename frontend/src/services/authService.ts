import api from './api';
import type { LoginFormData } from '../utils/schemas';

export const authService = {
  login: async (data: LoginFormData) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  // No body needed — the refresh token travels as an HttpOnly cookie
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  // No body needed — the refresh token travels as an HttpOnly cookie
  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};
