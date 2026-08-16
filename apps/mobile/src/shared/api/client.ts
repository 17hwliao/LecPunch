const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

interface RequestOptions extends RequestInit {
  accessToken?: string;
}

export async function apiRequest<T>(path: string, { accessToken, headers, ...options }: RequestOptions = {}): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error('未配置 EXPO_PUBLIC_API_BASE_URL，请先复制 .env.example 并填写 API 地址');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const payload = await response.json().catch(() => null) as { message?: string; error?: string } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : null;
    throw new Error(message || `请求失败（${response.status}）`);
  }

  return payload as T;
}
