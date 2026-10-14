import { describe, expect, it } from 'vitest';
import { toUserResponse } from './user.mapper';
import type { UserDocument } from './schemas/user.schema';

const member = {
  id: 'mongo-member-1', logtoUserId: 'sso-user-9', teamId: 'team-1',
  username: 'chenxinhao.apries', realName: '陈信豪', displayName: '本地昵称',
  studentId: '202300010001', avatarUrl: 'https://sso.example.com/lec-assets/avatar.png',
  role: 'member', status: 'active', enrollYear: 2023,
  createdAt: new Date('2026-04-01T00:00:00.000Z'), updatedAt: new Date('2026-04-02T00:00:00.000Z'),
  passwordHash: 'private-password-hash'
} as unknown as UserDocument;

describe('统一身份与业务用户响应', () => {
  it('保留业务成员 ID、统一身份 ID 和资料，并兼容旧客户端字段', () => {
    const user = toUserResponse(member);
    expect(user).toMatchObject({
      id: 'mongo-member-1', lecUserId: 'sso-user-9', teamId: 'team-1',
      username: 'chenxinhao.apries', name: '陈信豪', studentNumber: '202300010001',
      avatar: 'https://sso.example.com/lec-assets/avatar.png',
      realName: '陈信豪', studentId: '202300010001', avatarUrl: 'https://sso.example.com/lec-assets/avatar.png',
      createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-02T00:00:00.000Z'
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('未绑定的旧成员明确返回空身份，不把业务 ID 冒充为 SSO ID', () => {
    const user = toUserResponse({ ...member, logtoUserId: undefined, realName: undefined, studentId: undefined, avatarUrl: undefined } as UserDocument);
    expect(user).toMatchObject({ id: 'mongo-member-1', lecUserId: null, name: null, studentNumber: null, avatar: null });
  });
});
