import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth-store';

export const ProtectedRoute = () => {
  const location = useLocation();
  const auth = useAuthStore((state) => state.auth);
  const authInitializing = useAuthStore((state) => state.authInitializing);

  if (authInitializing) return null;
  if (!auth.token || !auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
