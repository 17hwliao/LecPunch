import type { User } from '@lecpunch/shared';

import { apiRequest } from '@/shared/api/client';

interface LoginPayload {
  accessToken: string;
  user: User;
}

export function login(username: string, password: string): Promise<LoginPayload> {
  return apiRequest<LoginPayload>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentUser(accessToken: string): Promise<User> {
  return apiRequest<User>('/auth/me', { accessToken });
}
