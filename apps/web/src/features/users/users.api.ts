import { apiClient } from '@/shared/http/api-client';
import type { User } from '@lecpunch/shared';

export interface UpdateProfileInput {
  displayName?: string;
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

export const updateProfile = async (input: UpdateProfileInput): Promise<User> => {
  const response = await apiClient.patch<User>('/users/me', input);
  return response.data;
};

export const getAdminMembers = async (): Promise<User[]> => {
  const response = await apiClient.get<{ items: User[] }>('/users/admin/members');
  return response.data.items;
};

export interface AdminUpdateMemberInput {
  role?: User['role'];
  status?: User['status'];
}

export const updateAdminMember = async (userId: string, input: AdminUpdateMemberInput): Promise<User> => {
  const response = await apiClient.patch<User>(`/users/admin/members/${userId}`, input);
  return response.data;
};

export const deleteAdminMember = async (userId: string): Promise<void> => {
  await apiClient.delete(`/users/admin/members/${userId}`);
};
