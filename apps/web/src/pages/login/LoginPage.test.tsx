import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';

const signIn = vi.fn();
vi.mock('@logto/react', () => ({
  useLogto: () => ({ signIn, error: undefined })
}));

describe('LoginPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('仅显示 LEC SSO 登录入口', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /欢迎回来/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '使用 LEC SSO 登录' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/密码/i)).not.toBeInTheDocument();
  });

  it('请求组织限定的 SSO 授权流程', async () => {
    render(<LoginPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: '使用 LEC SSO 登录' }));
    expect(signIn).toHaveBeenCalledWith(expect.objectContaining({
      extraParams: { organization_id: 'lec-studio' }
    }));
  });
});
