/** 两端统一用真名和 Handle 标识成员；旧资料缺少真名时使用显示名称。 */
export function formatMemberName(member: { realName?: string; username?: string; displayName?: string }) {
  const name = member.realName?.trim() || member.displayName?.trim() || member.username || '未知成员';
  const handle = member.username?.trim();
  return handle && handle !== name ? `${name}（${handle}）` : name;
}
