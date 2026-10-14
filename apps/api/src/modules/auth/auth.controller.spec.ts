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
      id: 'user-1', username: 'demo-member', displayName: 'Demo Member',
      teamId: 'team-1', role: 'member', status: 'active', enrollYear: 2023
    });

    await expect(controller.me({ userId: 'user-1', role: 'admin' } as never)).resolves.toMatchObject({
      id: 'user-1', role: 'admin', status: 'active'
    });
  });
});
