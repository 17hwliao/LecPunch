const apiBaseUrl = (process.env.MOBILE_BRIDGE_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const username = process.env.MOBILE_BRIDGE_USERNAME ?? 'demo-member';
const password = process.env.MOBILE_BRIDGE_PASSWORD ?? '123456';

async function request(path, { accessToken, ...options } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${body?.message ?? 'unknown error'}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert(login?.accessToken, '登录响应缺少 accessToken');
  assert(login?.user?.id, '登录响应缺少用户信息');

  const token = login.accessToken;
  const [profile, attendance, weekly, records, team] = await Promise.all([
    request('/auth/me', { accessToken: token }),
    request('/attendance/current', { accessToken: token }),
    request('/stats/me/weekly', { accessToken: token }),
    request('/records/me?page=1&pageSize=50', { accessToken: token }),
    request('/stats/team/current-week', { accessToken: token }),
  ]);

  assert(profile?.id === login.user.id, '会话用户与登录用户不一致');
  assert(typeof attendance?.hasActiveSession === 'boolean', '当前打卡响应不完整');
  assert(Array.isArray(weekly?.items) && typeof weekly?.weeklyGoalSeconds === 'number', '周统计响应不完整');
  assert(Array.isArray(records?.items), '记录响应不完整');
  assert(Array.isArray(team?.items), '团队统计响应不完整');

  console.log('Mobile-Web bridge check passed');
  console.log(`User: ${profile.displayName} (${profile.username})`);
  console.log(`Endpoints: auth/me, attendance/current, stats/me/weekly, records/me, stats/team/current-week`);
}

main().catch((error) => {
  console.error(`Mobile-Web bridge check failed: ${error.message}`);
  process.exitCode = 1;
});
