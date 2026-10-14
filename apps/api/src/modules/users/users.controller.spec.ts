import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import type { AuthUser } from '../auth/types/auth-user.type';

const adminUser: AuthUser = {
  userId: 'admin-1',
  teamId: 'team-1',
  role: 'admin',
  username: 'admin',
  displayName: 'Admin',
  enrollYear: 2024
};

const memberUser: AuthUser = {
  ...adminUser,
  userId: 'member-1',
  role: 'member',
  username: 'member',
  displayName: 'Member'
};

describe('UsersController', () => {
  const usersService = {
    listTeamMembers: vi.fn(),
    adminUpdateMember: vi.fn(),
    adminDeleteMember: vi.fn(),
    updateProfile: vi.fn(),
    updatePassword: vi.fn()
  };

  let controller: UsersController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UsersController(usersService as never);
  });

  it('lists team members for admins without exposing password hashes', async () => {
    usersService.listTeamMembers.mockResolvedValue([
      {
        id: 'member-2',
        teamId: 'team-1',
        username: 'alice',
        displayName: 'Alice',
        role: 'member',
        status: 'active',
        enrollYear: 2025,
        createdAt: new Date('2026-04-11T00:00:00.000Z'),
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
        passwordHash: 'secret'
      }
    ]);

    const result = await controller.listTeamMembers(adminUser);

    expect(usersService.listTeamMembers).toHaveBeenCalledWith('team-1');
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'member-2',
          username: 'alice',
          displayName: 'Alice'
        })
      ]
    });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('rejects member access to admin member management routes', async () => {
    await expect(controller.listTeamMembers(memberUser)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.adminUpdateMember(memberUser, 'member-2', { role: 'admin' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.adminDeleteMember(memberUser, 'member-2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('更新自己的业务资料后，继续按当前 token 投影权限并返回统一身份字段', async () => {
    usersService.updateProfile.mockResolvedValue({
      id: 'admin-1', logtoUserId: 'sso-captain-1', username: 'captain.lec', displayName: '新昵称',
      realName: '队长', studentId: '202300010001', avatarUrl: 'https://sso.example.com/avatar.png',
      teamId: 'team-1', role: 'member', status: 'active', enrollYear: 2023,
      createdAt: new Date('2026-04-01T00:00:00.000Z'), updatedAt: new Date('2026-04-02T00:00:00.000Z')
    });
    await expect(controller.updateProfile(adminUser, { displayName: '新昵称' })).resolves.toMatchObject({
      id: 'admin-1', lecUserId: 'sso-captain-1', name: '队长', studentNumber: '202300010001',
      avatar: 'https://sso.example.com/avatar.png', role: 'admin', displayName: '新昵称'
    });
    expect(usersService.updateProfile).toHaveBeenCalledWith('admin-1', { displayName: '新昵称' });
  });
});
