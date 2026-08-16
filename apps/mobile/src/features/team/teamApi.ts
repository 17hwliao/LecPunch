import type { TeamWeeklyStatItem } from '@lecpunch/shared';

import { apiRequest } from '@/shared/api/client';

export async function getTeamCurrentWeekStats(accessToken: string): Promise<TeamWeeklyStatItem[]> {
  const response = await apiRequest<{ items: TeamWeeklyStatItem[] }>('/stats/team/current-week', { accessToken });
  return response.items;
}
