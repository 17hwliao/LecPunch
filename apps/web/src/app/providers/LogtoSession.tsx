import { useEffect } from 'react';
import { useLogto } from '@logto/react';
import { useAuthStore } from '@/app/store/auth-store';
import {
  fetchCurrentUser,
  logtoOrganizationId,
  logtoResource,
  setAccessTokenProvider,
  setLogoutProvider
} from '@/shared/auth/logto';

export const LogtoSession = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, getAccessToken, signOut } = useLogto();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setAuthInitializing = useAuthStore((state) => state.setAuthInitializing);

  useEffect(() => {
    setAccessTokenProvider(() => getAccessToken(logtoResource, logtoOrganizationId));
    setLogoutProvider(() => signOut(window.location.origin));
    return () => {
      setAccessTokenProvider(null);
      setLogoutProvider(null);
    };
  }, [getAccessToken, signOut]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setAuth({ token: null, user: null });
      setAuthInitializing(false);
    }
  }, [isAuthenticated, isLoading, setAuth, setAuthInitializing]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    setAuthInitializing(true);
    void (async () => {
      try {
        const token = await getAccessToken(logtoResource, logtoOrganizationId);
        if (!token || cancelled) return;
        const user = await fetchCurrentUser();
        if (!cancelled) setAuth({ token, user });
      } finally {
        if (!cancelled) setAuthInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated, setAuth, setAuthInitializing]);

  return children;
};
