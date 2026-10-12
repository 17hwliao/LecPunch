import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setNavigateToLogin } from '@/shared/http/api-client';
import { LogtoSession } from './LogtoSession';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigateToLogin(() => navigate('/login', { replace: true }));
  }, [navigate]);

  return <LogtoSession>{children}</LogtoSession>;
};
