import type { User, UserRole } from '@lecpunch/shared';
import type { UserDocument } from './schemas/user.schema';

/** 当前用户、资料修改及管理成员接口共用同一身份和业务字段映射。 */
export function toUserResponse(user: UserDocument, role: UserRole = user.role, includeTimestamps = true): User & Pick<UserDocument, 'realName' | 'studentId' | 'avatarUrl'> {
  return {
    lecUserId: user.logtoUserId ?? null,
    username: user.username,
    name: user.realName ?? null,
    avatar: user.avatarUrl ?? null,
    studentNumber: user.studentId ?? null,
    id: user.id,
    teamId: user.teamId,
    displayName: user.displayName,
    role,
    status: user.status,
    enrollYear: user.enrollYear,
    ...(includeTimestamps ? {
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    } : {}),
    avatarBase64: user.avatarBase64,
    avatarColor: user.avatarColor,
    avatarEmoji: user.avatarEmoji,
    // 兼容旧桌面客户端；新调用方统一读取 name、studentNumber、avatar。
    realName: user.realName,
    studentId: user.studentId,
    avatarUrl: user.avatarUrl,
  };
}
