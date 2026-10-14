import type { LecUser } from './lec-user';

export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User extends LecUser {
  /** LecPunch 业务成员 ID，打卡记录和成员管理继续引用此 ID。 */
  id: string;
  teamId: string;
  displayName: string;
  /** 本应用的权限投影，不代表 SSO 的组织角色。 */
  role: UserRole;
  /** 本应用成员的启用状态。 */
  status: UserStatus;
  enrollYear: number;
  /** 成员管理接口返回业务时间戳；auth/me 沿用不返回时间戳的契约。 */
  createdAt?: string;
  updatedAt?: string;
  /** 旧版应用内头像，仅在没有统一头像时用于回退。 */
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

