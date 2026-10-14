import { describe, expect, it } from 'vitest';
import { formatMemberName } from '@lecpunch/shared';

describe('跨端成员身份展示', () => {
  it('优先显示真名，括号内使用 Handle', () => {
    expect(formatMemberName({ realName: '陈信豪', username: 'chenxinhao.apries', displayName: '昵称' })).toBe('陈信豪（chenxinhao.apries）');
  });
  it('缺少旧资料时保留可用名称，不重复 Handle', () => {
    expect(formatMemberName({ displayName: '昵称', username: 'member.handle' })).toBe('昵称（member.handle）');
    expect(formatMemberName({ username: 'member.handle' })).toBe('member.handle');
    expect(formatMemberName({ displayName: '旧成员' })).toBe('旧成员');
  });
});
