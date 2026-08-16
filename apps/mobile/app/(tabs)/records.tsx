import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getMyRecords, type AttendanceRecord } from '@/features/records/recordsApi';
import { useSession } from '@/features/session/SessionProvider';
import { ScreenState } from '@/shared/components/ScreenState';
import { formatDateTime, formatDuration } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';

export default function RecordsScreen() {
  const { accessToken } = useSession();
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setItems(await getMyRecords(accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载记录失败');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !items.length) return <ScreenState loading label="正在加载记录…" />;
  if (error && !items.length) return <ScreenState label={error} actionLabel="重试" onAction={() => void load()} />;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />}
    >
      <Text style={styles.intro}>最近 50 条打卡记录</Text>
      {items.length === 0 ? <ScreenState label="还没有打卡记录" /> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.date}>{formatDateTime(item.checkInAt)}</Text>
            <Text style={[styles.status, item.status === 'completed' ? styles.completed : styles.invalid]}>
              {item.status === 'completed' ? '已完成' : item.status === 'active' ? '进行中' : '已作废'}
            </Text>
          </View>
          <Text style={styles.detail}>下卡：{item.checkOutAt ? formatDateTime(item.checkOutAt) : '尚未下卡'}</Text>
          <Text style={styles.duration}>{formatDuration(item.durationSeconds ?? 0)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  date: { color: colors.ink, fontSize: 15, fontWeight: '700', flex: 1 },
  detail: { color: colors.muted, fontSize: 13 },
  duration: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  status: { paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, borderRadius: 99, overflow: 'hidden', fontWeight: '700' },
  completed: { color: colors.success, backgroundColor: colors.successSoft },
  invalid: { color: colors.danger, backgroundColor: colors.dangerSoft },
});
