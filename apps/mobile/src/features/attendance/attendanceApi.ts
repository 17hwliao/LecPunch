import type { AttendancePauseReason, WeeklyStatItem } from '@lecpunch/shared';

import { apiRequest } from '@/shared/api/client';

export interface CurrentAttendance {
  hasActiveSession: boolean;
  session: null | {
    id: string;
    checkInAt: string;
    elapsedSeconds: number;
    isPaused?: boolean;
    pauseReason?: AttendancePauseReason;
  };
}

interface WeeklyStatsResponse {
  items: WeeklyStatItem[];
  weeklyGoalSeconds: number;
}

export function getCurrentAttendance(accessToken: string): Promise<CurrentAttendance> {
  return apiRequest<CurrentAttendance>('/attendance/current', { accessToken });
}

export function checkIn(accessToken: string): Promise<void> {
  return apiRequest<void>('/attendance/check-in', { method: 'POST', accessToken });
}

export function checkOut(accessToken: string): Promise<void> {
  return apiRequest<void>('/attendance/check-out', { method: 'POST', accessToken });
}

export function getMyWeeklyStats(accessToken: string): Promise<WeeklyStatsResponse> {
  return apiRequest<WeeklyStatsResponse>('/stats/me/weekly', { accessToken });
}
