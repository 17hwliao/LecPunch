import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController contract', () => {
  it('保持 auth/me 响应结构并不暴露时间戳', async () => {
    const usersService = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1', username: 'demo-member', displayName: 'Demo Member', teamId: 'team-1',
        status: 'active', enrollYear: 2023, createdAt: new Date(), updatedAt: new Date()
      })
    };
    const controller = new AuthController(usersService as never);

    const result = await controller.me({ userId: 'user-1', role: 'member' } as never);

    expect(result).toMatchObject({
      id: 'user-1', username: 'demo-member', displayName: 'Demo Member',
      teamId: 'team-1', role: 'member', status: 'active'
    });
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });
});
