import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getTeamCurrentWeekStats } from '@/features/team/teamApi';
import { useSession } from '@/features/session/SessionProvider';
import { ScreenState } from '@/shared/components/ScreenState';
import { formatDuration } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';
import type { TeamWeeklyStatItem } from '@lecpunch/shared';

export default function TeamScreen() {
  const { accessToken } = useSession();
  const [items, setItems] = useState<TeamWeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setItems(await getTeamCurrentWeekStats(accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载团队数据失败');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !items.length) return <ScreenState loading label="正在加载团队数据…" />;
  if (error && !items.length) return <ScreenState label={error} actionLabel="重试" onAction={() => void load()} />;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />}
    >
      <Text style={styles.intro}>与同伴一起保持节奏</Text>
      {items.map((item, index) => (
        <View key={item.memberKey} style={styles.row}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayName.slice(0, 1)}</Text></View>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.meta}>{item.sessionsCount} 次打卡</Text>
          </View>
          <Text style={styles.duration}>{formatDuration(item.totalDurationSeconds)}</Text>
        </View>
      ))}
      {items.length === 0 ? <ScreenState label="团队暂时没有本周数据" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  intro: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  row: { backgroundColor: colors.surface, minHeight: 70, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { color: colors.muted, width: 16, textAlign: 'center', fontWeight: '700' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: '800' },
  nameBlock: { flex: 1 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  duration: { color: colors.primaryDark, fontWeight: '800' },
});
