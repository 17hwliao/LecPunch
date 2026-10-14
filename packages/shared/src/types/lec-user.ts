/** LecSSO 的统一身份资料；业务应用只扩展自己的成员资料和权限。 */
export interface LecUser {
  /** 对应 Logto id / OIDC sub；未绑定 SSO 的旧成员为 null。 */
  lecUserId: string | null;
  /** 工作室统一 Handle。 */
  username: string;
  name: string | null;
  avatar: string | null;
  /** 对应 SSO customData.studentNumber / student_number claim。 */
  studentNumber: string | null;
}
