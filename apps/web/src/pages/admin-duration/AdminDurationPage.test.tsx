import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminDurationPage } from './AdminDurationPage';

const mocks = vi.hoisted(() => ({ members: vi.fn(), context: vi.fn(), audit: vi.fn(), adjust: vi.fn() }));
vi.mock('@/features/users/users.api', () => ({ getAdminMembers: mocks.members }));
vi.mock('@/features/attendance/duration-adjustments.api', () => ({
  getAdjustmentContext: mocks.context, getAdjustmentAudit: mocks.audit, adjustDuration: mocks.adjust
}));

describe('AdminDurationPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.members.mockResolvedValue([{ id: 'member-1', username: 'new.handle', displayName: '测试成员', status: 'active', studentNumber: '202500001234' }]);
    mocks.context.mockResolvedValue({ userId: 'member-1', weekKey: '2026-10-12', isoWeek: '2026-W42', recordedDurationSeconds: 600, manualAdjustmentSeconds: 0, totalDurationSeconds: 600 });
    mocks.audit.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it('retries an unknown result with the same stable member ID and request key', async () => {
    mocks.adjust.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ resultingDurationSeconds: 540 });
    render(<AdminDurationPage />);
    const user = userEvent.setup();
    await screen.findByRole('option', { name: /测试成员/ });
    await user.selectOptions(screen.getByRole('combobox', { name: '选择成员' }), 'member-1');
    await screen.findByText(/本周 2026-10-12 起/);
    await user.selectOptions(screen.getByRole('combobox', { name: '增减方式' }), 'subtract');
    await user.type(screen.getByRole('spinbutton', { name: '分钟' }), '1');
    await user.type(screen.getByRole('textbox', { name: '调整原因' }), '核对后调整');
    await user.click(screen.getByRole('button', { name: '确认调整' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: '调整原因' })).toHaveValue('核对后调整');
    await user.click(screen.getByRole('button', { name: '确认调整' }));
    await waitFor(() => expect(mocks.adjust).toHaveBeenCalledTimes(2));
    expect(mocks.adjust.mock.calls[1][0]).toEqual(mocks.adjust.mock.calls[0][0]);
    expect(mocks.adjust.mock.calls[0][0]).toMatchObject({ userId: 'member-1', durationSeconds: 60, operation: 'subtract', expectedWeekKey: '2026-10-12' });
    expect(await screen.findByRole('status')).toHaveTextContent('00:09:00');
  });

  it.each(['context', 'audit'])('never resubmits after a successful adjustment when refreshing %s fails', async failure => {
    mocks.adjust.mockResolvedValue({ resultingDurationSeconds: 660 });
    render(<AdminDurationPage />);
    await screen.findByRole('option', { name: /测试成员/ });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择成员' }), 'member-1');
    await screen.findByText(/本周 2026-10-12 起/);
    await userEvent.type(screen.getByRole('spinbutton', { name: '分钟' }), '1');
    await userEvent.type(screen.getByRole('textbox', { name: '调整原因' }), '补录');
    mocks[failure as 'context' | 'audit'].mockRejectedValueOnce(new Error('refresh failed'));
    await userEvent.click(screen.getByRole('button', { name: '确认调整' }));
    expect(await screen.findByRole('status')).toHaveTextContent('调整成功');
    expect(screen.getByRole('alert')).toHaveTextContent('调整已成功，但刷新数据失败');
    expect(screen.getByRole('spinbutton', { name: '分钟' })).toHaveValue(null);
    await userEvent.type(screen.getByRole('spinbutton', { name: '分钟' }), '1');
    await userEvent.type(screen.getByRole('textbox', { name: '调整原因' }), '误以为未完成');
    expect(screen.getByRole('button', { name: '确认调整' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '仅刷新数据' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '仅刷新数据' })).not.toBeInTheDocument());
    expect(mocks.adjust).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the negative balance and only allows an amount that fully repairs it', async () => {
    mocks.context.mockResolvedValue({ userId: 'member-1', weekKey: '2026-10-12', isoWeek: '2026-W42', recordedDurationSeconds: 0, manualAdjustmentSeconds: -600, totalDurationSeconds: -600 });
    mocks.adjust.mockResolvedValue({ resultingDurationSeconds: 0 });
    render(<AdminDurationPage />);
    await screen.findByRole('option', { name: /测试成员/ });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择成员' }), 'member-1');
    expect(await screen.findByText(/当前合计 -00:10:00/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: '调整原因' }), '核对后补正');
    const minutes = screen.getByRole('spinbutton', { name: '分钟' });
    await userEvent.type(minutes, '9');
    expect(screen.getByRole('button', { name: '确认调整' })).toBeDisabled();
    await userEvent.clear(minutes); await userEvent.type(minutes, '10');
    expect(screen.getByText(/预计调整后：00:00:00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认调整' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: '确认调整' }));
    expect(mocks.adjust).toHaveBeenCalledWith(expect.objectContaining({ operation: 'add', durationSeconds: 600 }));
  });
});
