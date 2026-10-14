# Client/API compatibility notes

## Attendance state (2026-09-02)

- `POST /api/attendance/check-in` creates one active session. The database
  partial unique index permits at most one `status: active` session per user.
- `POST /api/attendance/check-out` checks the network policy, then records the
  wall-clock duration from `checkInAt` to the server check-out time. A completed
  session earns one point per fully completed minute.
- An active session reaches its hard limit at five hours and is invalidated.
  Clients warn at four hours and forty-five minutes.
- `GET /api/attendance/team-active` returns every same-team active session that
  is still below the five-hour limit. Display eligibility does not depend on a
  browser, desktop app, or heartbeat being open.

## Points

`GET /api/points/me?week=YYYY-Www` returns `totalPoints`, the requested ISO
`week`, `weekPoints`, `accrualRate`, and `calculatedAt`. Ledger entries are
completed attendance earns one point per fully completed minute. Both all-time
and weekly totals are the sum of the same ledger field.

## Public GitHub blog sources (2026-09-03)

- `GET /api/github-source/me` and `PUT /api/github-source/me` retain their
  existing response/request fields and add optional `siteUrl`. It is a public
  HTTPS address for the member's human-readable blog site; it may be `null`.
- `GET /api/github-sources/team` is authenticated and returns enabled public
  sources from the caller's team only: `{ items: [{ displayName, repoUrl,
  siteUrl }] }`. `enabled: false` sources are not returned. The response never
  exposes real names, GitHub credentials, branches, index paths, or article
  bodies. Repository and blog addresses are visible to every member in the
  same team.

## Administrator duration adjustments

- A duration adjustment is an auditable weekly correction. It never rewrites a
  real check-in/check-out record and never changes `point_ledger` or
  `GET /api/points/me`.
- `GET /api/attendance/me/weekly-summary?week=YYYY-Www` now uses an **effective
  duration** for `totalFocusedMinutes`: raw completed-session duration plus the
  signed adjustment total for that week, floored at zero. It also returns
  `rawFocusedMinutes`, signed `adjustedMinutes`, `adjustmentsCount`, and the
  member's adjustment entries (including reason and creation time).
- `days[]` remains raw daily attendance. Weekly adjustments deliberately have
  no artificial date, so clients must show a “含管理员调整” marker whenever
  `adjustmentsCount > 0` rather than trying to distribute it among days.
- The three `GET /api/stats/*` endpoints return the same effective value in
  `totalDurationSeconds`, together with `recordedDurationSeconds`,
  `manualAdjustmentSeconds`, and `adjustmentsCount`. Rankings must sort by the
  effective value.
- `GET /api/attendance/admin/weekly-adjustments?week=YYYY-Www` lets a team
  administrator inspect all adjustment entries for that team and week.
- `GET /api/weekly-reports/me?week=YYYY-Www` keeps its existing `week` and
  `item` fields and additionally returns `attendanceSummary`, using the weekly
  summary contract above so a report generator can include adjustment reasons.

## Keepalive compatibility period

`POST /api/attendance/keepalive` remains available for older clients. It is not
part of attendance accounting: it does not resolve client IP, update timestamps,
change duration, or write points. It returns the current active session below the
five-hour limit; no active session returns `ATTENDANCE_NO_ACTIVE_SESSION`, and a
five-hour session is invalidated then returns `ATTENDANCE_SESSION_INVALIDATED`.

New web and Election clients must use `GET /api/attendance/current` and
`GET /api/attendance/team-active` as read-only refreshes instead.

## Network boundary

Only check-in and check-out are network-policy-protected. nginx overwrites
`X-Forwarded-For` with `$remote_addr`; the API trusts one controlled proxy hop.
Clients must never connect directly to MongoDB.

## LAN meeting admission (2026-09-04)

`GET /api/meet/token?room=<name>` is a JWT-authenticated, zero-storage route.
It accepts only a 1–64 character room name composed of letters, numbers,
hyphens, and underscores. It returns `{ token, room, expiresAt,
expiresInSeconds }`; `expiresInSeconds` is 300 (five minutes — invite links
are meant to be used immediately for a meeting happening now). The JWT is
HS256-signed with
the independent `MEET_JWT_SECRET`, has matching `iss`, `aud`, and `sub` values
of `MEET_JWT_APP_ID`, is limited to the requested `room`, and places the
authenticated LecPunch user ID in `context.user.id`. It never accepts a user or
team selector from the client and does not write attendance, duration, points,
or meeting data.

The captain machine must hold the same `MEET_JWT_APP_ID` and
`MEET_JWT_SECRET`; these values are never interchangeable with `AUTH_SECRET`.

## LecSSO 身份展示（2026-10-14）

- LecSSO 对 `lecpunch-web`、`lecpunch-election` 的已签名访问令牌补充 `picture: user.avatar ?? null`，沿用 `username`、`name`、`student_number`。
- API 在验签后同步 Handle、真名和 `avatarUrl`，不改变成员 ID、团队、角色及打卡归属；资料未变化时不写数据库。旧令牌缺少 `picture` 时保留缓存，显式 `null` 时移除缓存。
- 当前用户和团队统计增加可选 `avatarUrl`；团队统计、正在打卡列表增加可选 `username`。两端统一使用真名（Handle）展示，SSO 头像优先于旧应用头像。
- 桌面端通过 HTTPS 加载 SSO 头像；自定义背景继续使用本机资源协议。旧 API 缺少新增字段时保留名称和头像回退。

## 统一用户契约（2026-10-14）

- `packages/shared` 导出 `LecUser`：`lecUserId`、`username`、`name`、`avatar`、`studentNumber`。身份 ID 对应 Logto id / OIDC sub，未绑定 SSO 的旧成员明确为 `null`。
- `User extends LecUser` 补充 LecPunch 业务 ID、团队、显示名称、入学年份、本应用权限和成员状态；桌面端 `ElectionUser` 直接引用此类型。打卡记录、成员管理及所有外键继续使用原有业务 ID。
- 当前用户、资料修改和管理成员接口共用一处响应映射；新调用方统一读取身份字段，响应暂时保留 `realName`、`avatarUrl`、`studentId` 供旧客户端兼容。
- `auth/me` 沿用不返回业务时间戳的契约，因此共享类型中的时间戳为可选；资料修改后继续使用当前 token 的权限投影。
