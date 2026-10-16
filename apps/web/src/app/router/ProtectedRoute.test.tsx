import { createUserFixture } from '@/test/user-fixture';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useAuthStore } from '@/app/store/auth-store';
import { ProtectedRoute } from './ProtectedRoute';

const renderRoute = (entry = '/dashboard') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/login" element={<div>Login</div>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/records" element={<div>Records</div>} />
      </Route>
    </Routes>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authInitializing: false,
      auth: {
        token: null,
        user: null
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects unauthenticated users to /login', () => {
    renderRoute();

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('allows authenticated users to access protected routes', () => {
    useAuthStore.setState({
      auth: {
        token: 'token-1',
        user: createUserFixture({
          id: 'user-1',
          teamId: 'team-1',
          username: 'alice',
          displayName: 'Alice',
          role: 'member',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z'
        })
      }
    });

    renderRoute();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('刷新时等待全局会话恢复，恢复完成后保留原来的记录页', () => {
    useAuthStore.setState({ authInitializing: true });
    // 与 AppRouter 保持无扩展名导入，防止旧 JS 再次遮蔽真实路由守卫。
    renderRoute('/records');
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Records')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.getState().setAuth({ token: 'restored-token', user: createUserFixture() });
    });
    expect(screen.queryByText('Records')).not.toBeInTheDocument();
    act(() => {
      useAuthStore.getState().setAuthInitializing(false);
    });
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('初始化完成且确认没有会话后才跳转登录页', () => {
    useAuthStore.setState({ authInitializing: true });
    renderRoute();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    act(() => {
      useAuthStore.getState().setAuthInitializing(false);
    });
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
