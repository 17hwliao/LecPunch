import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getCurrentUser, login as loginRequest } from '@/features/session/sessionApi';
import type { User } from '@lecpunch/shared';

const ACCESS_TOKEN_KEY = 'lecpunch.access-token';

interface SessionContextValue {
  accessToken: string | null;
  isHydrating: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (!storedToken) return;
        const currentUser = await getCurrentUser(storedToken);
        setAccessToken(storedToken);
        setUser(currentUser);
      } catch {
        await clearSession();
      } finally {
        setIsHydrating(false);
      }
    };

    void restoreSession();
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await loginRequest(username, password);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.accessToken);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const value = useMemo(() => ({ accessToken, isHydrating, user, login, logout: clearSession }), [accessToken, clearSession, isHydrating, login, user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession 必须在 SessionProvider 内使用');
  return value;
}
