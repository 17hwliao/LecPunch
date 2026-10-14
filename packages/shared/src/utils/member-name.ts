/** 两端统一用真名和 Handle 标识成员；旧资料缺少真名时使用显示名称。 */
export function formatMemberName(member: { name?: string | null; realName?: string; username?: string; displayName?: string }) {
  const name = member.name?.trim() || member.realName?.trim() || member.displayName?.trim() || member.username || '未知成员';
  const handle = member.username?.trim();
  return handle && handle !== name ? `${name}（${handle}）` : name;
}
