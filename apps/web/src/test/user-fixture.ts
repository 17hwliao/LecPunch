import type { User } from '@lecpunch/shared';

/** 页面测试共用完整的身份与业务用户契约，按场景覆盖具体字段。 */
export const createUserFixture = (overrides: Partial<User> = {}): User => ({
  lecUserId: null, username: 'member', name: null, avatar: null, studentNumber: null,
  id: 'member-1', teamId: 'team-1', displayName: 'Member',
  role: 'member', status: 'active', enrollYear: 2024,
  ...overrides
});
