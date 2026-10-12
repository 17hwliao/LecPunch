import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandleSignInCallback } from '@logto/react';
import { useAuthStore } from '@/app/store/auth-store';

export const CallbackPage = () => {
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const { error } = useHandleSignInCallback();

  useEffect(() => {
    if (auth.token && auth.user) navigate('/', { replace: true });
  }, [auth, navigate]);

  if (error) return <p className="text-sm text-red-600">SSO 登录失败：{error.message}</p>;
  return <p className="text-sm text-gray-500">正在完成登录…</p>;
};
