import { apiClient } from './client';
import type { AuthResponse } from '../types';

export const authApi = {
  register: (name: string, email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/register', { name, email, password }).then((r) => r.data),

  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  me: () =>
    apiClient.get<AuthResponse['user']>('/auth/me').then((r) => r.data),
};
