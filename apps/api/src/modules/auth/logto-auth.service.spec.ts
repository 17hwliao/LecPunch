import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LogtoAuthService } from './logto-auth.service';

const memberClaims = {
  sub: 'logto-user-1',
  aud: 'https://api.lecpunch.lec.org',
  organization_id: 'lec-studio',
  scope: 'studio:access',
  username: 'zhangsan.01',
  name: '张三',
  custom_data: { studentNumber: '20230001', realName: '张三' }
};

const buildService = (overrides: Partial<Record<'findByLogtoUserId' | 'create' | 'ensureDefaultTeam', ReturnType<typeof vi.fn>>> = {}) => {
  const user = {
    id: 'mongo-user-1',
    username: 'zhangsan.01',
    displayName: '张三',
    teamId: 'team-1',
    role: 'member',
    status: 'active',
    enrollYear: 2023
  };
  const usersService = {
    findByLogtoUserId: overrides.findByLogtoUserId ?? vi.fn().mockResolvedValue(user),
    create: overrides.create ?? vi.fn().mockResolvedValue(user)
  };
  const teamsService = {
    ensureDefaultTeam: overrides.ensureDefaultTeam ?? vi.fn().mockResolvedValue({ id: 'team-1' })
  };
  const values: Record<string, string> = {
    LOGTO_ENDPOINT: 'http://localhost:3001',
    LOGTO_API_RESOURCE: 'https://api.lecpunch.lec.org',
    LOGTO_ORGANIZATION_ID: 'lec-studio',
    DEFAULT_TEAM_NAME: 'FocusTeam'
  };
  const config = {
    getOrThrow: vi.fn((key: string) => values[key]),
    get: vi.fn((key: string, fallback?: string) => values[key] ?? fallback)
  };
  const service = new LogtoAuthService(config as never, usersService as never, teamsService as never, config as never);
  return { service, usersService, teamsService, user };
};

describe('LogtoAuthService', () => {
  it('将有效的 LEC Studio token 映射为本地业务用户，并以 scope 决定权限', async () => {
    const { service, user } = buildService();

    await expect(service.resolveUser(memberClaims)).resolves.toEqual({
      userId: user.id,
      teamId: user.teamId,
      role: 'member',
      username: user.username,
      displayName: user.displayName,
      enrollYear: user.enrollYear
    });
    await expect(service.resolveUser({ ...memberClaims, scope: 'studio:access studio:admin:access' })).resolves.toMatchObject({ role: 'admin' });
  });

  it('拒绝不属于 LEC Studio 或缺少访问 scope 的 token', async () => {
    const { service } = buildService();

    await expect(service.resolveUser({ ...memberClaims, organization_id: 'other' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.resolveUser({ ...memberClaims, scope: 'openid' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('首次登录按 Logto sub 创建本地业务用户', async () => {
    const create = vi.fn().mockImplementation(async (input) => ({ id: 'mongo-user-2', status: 'active', ...input }));
    const { service, usersService } = buildService({
      findByLogtoUserId: vi.fn().mockResolvedValue(null),
      create
    });

    await expect(service.resolveUser(memberClaims)).resolves.toMatchObject({
      userId: 'mongo-user-2',
      username: 'zhangsan.01',
      displayName: '张三',
      enrollYear: 2023
    });
    expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({
      logtoUserId: 'logto-user-1',
      username: 'zhangsan.01',
      teamId: 'team-1',
      studentId: '20230001',
      realName: '张三'
    }));
  });
});
