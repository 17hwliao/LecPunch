import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePage } from './ProfilePage';
import { useAuthStore } from '@/app/store/auth-store';

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn(), showToast: vi.fn() }));
vi.mock('@/features/users/users.api', () => ({ updateProfile: mocks.updateProfile }));
vi.mock('@/shared/ui/toast', () => ({ showToast: mocks.showToast }));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      auth: {
        token: 'token-1',
        user: {
          id: 'user-1', teamId: 'team-1', username: 'alice', displayName: 'Alice',
          lecUserId: 'sso-alice', name: 'Alice Zhang', avatar: null, studentNumber: '202612340001', role: 'member', status: 'active', enrollYear: 2024,
          createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z'
        }
      }
    });
  });
  afterEach(cleanup);

  it('显示名称过短时阻止提交', async () => {
    render(<ProfilePage />);
    const input = screen.getByLabelText('显示名称');
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, 'A');
    await userEvent.setup().click(screen.getByRole('button', { name: '保存修改' }));
    expect(await screen.findByText('显示名称至少 2 个字符')).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('保存显示名称并同步用户快照', async () => {
    mocks.updateProfile.mockResolvedValue({ ...useAuthStore.getState().auth.user, displayName: 'Alice New' });
    render(<ProfilePage />);
    const input = screen.getByLabelText('显示名称');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, '  Alice New  ');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Alice New' }));
    expect(useAuthStore.getState().auth.user?.displayName).toBe('Alice New');
  });

  it('将密码管理明确交给 LEC SSO', () => {
    render(<ProfilePage />);
    expect(screen.getByText('密码和身份资料由 LEC SSO 统一管理。')).toBeInTheDocument();
    expect(screen.queryByLabelText('当前密码')).not.toBeInTheDocument();
  });

  it('展示统一用户契约中的姓名、学号和头像', () => {
    useAuthStore.getState().updateUser({ avatar: 'https://sso.example.com/lec-assets/alice.png' });
    render(<ProfilePage />);
    expect(screen.getByText('Alice Zhang')).toBeInTheDocument();
    expect(screen.getByText('202612340001')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://sso.example.com/lec-assets/alice.png');
    expect(screen.getByText('由 LecSSO 统一管理')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更换头像' })).not.toBeInTheDocument();
  });
});
