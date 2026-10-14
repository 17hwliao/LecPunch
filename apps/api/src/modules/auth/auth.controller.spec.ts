import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const usersService = { findById: vi.fn() };
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(usersService as never);
  });

  it('返回当前 SSO 用户，并以 token 投影角色', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1', logtoUserId: 'sso-user-1', realName: '真实姓名', studentId: '202300010001', avatarUrl: 'https://sso.example.com/avatar.png',
      createdAt: new Date('2026-04-01T00:00:00.000Z'), updatedAt: new Date('2026-04-02T00:00:00.000Z'), username: 'demo-member', displayName: 'Demo Member',
      teamId: 'team-1', role: 'member', status: 'active', enrollYear: 2023
    });

    await expect(controller.me({ userId: 'user-1', role: 'admin' } as never)).resolves.toMatchObject({
      id: 'user-1', lecUserId: 'sso-user-1', name: '真实姓名', avatar: 'https://sso.example.com/avatar.png', studentNumber: '202300010001',
      role: 'admin', status: 'active'
    });
  });
});
