import type { AttendanceSession } from '@lecpunch/shared';

import { apiRequest } from '@/shared/api/client';

export type AttendanceRecord = Pick<AttendanceSession, 'id' | 'checkInAt' | 'checkOutAt' | 'durationSeconds' | 'status' | 'invalidReason' | 'isMarked' | 'weekKey'>;

export async function getMyRecords(accessToken: string): Promise<AttendanceRecord[]> {
  const response = await apiRequest<{ items: AttendanceRecord[] }>('/records/me?page=1&pageSize=50', { accessToken });
  return response.items;
}
