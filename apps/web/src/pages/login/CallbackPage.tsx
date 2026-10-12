import { Navigate } from 'react-router-dom';
import { useHandleSignInCallback } from '@logto/react';

export const CallbackPage = () => {
  const { isLoading, isAuthenticated, error } = useHandleSignInCallback();

  if (error) return <p className="text-sm text-red-600">SSO 登录失败：{error.message}</p>;
  if (isLoading) return <p className="text-sm text-gray-500">正在完成登录…</p>;
  return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
};
