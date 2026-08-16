import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AttendanceActionCard } from '@/features/attendance/AttendanceActionCard';
import { getCurrentAttendance, getMyWeeklyStats, type CurrentAttendance } from '@/features/attendance/attendanceApi';
import { useSession } from '@/features/session/SessionProvider';
import { ScreenState } from '@/shared/components/ScreenState';
import { formatDuration } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';

export default function HomeScreen() {
  const { user, accessToken } = useSession();
  const [attendance, setAttendance] = useState<CurrentAttendance | null>(null);
  const [weekSeconds, setWeekSeconds] = useState(0);
  const [weekGoalSeconds, setWeekGoalSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setError(null);
    try {
      const [nextAttendance, weekly] = await Promise.all([
        getCurrentAttendance(accessToken),
        getMyWeeklyStats(accessToken),
      ]);
      setAttendance(nextAttendance);
      const currentWeek = weekly.items[0];
      setWeekSeconds(currentWeek?.totalDurationSeconds ?? 0);
      setWeekGoalSeconds(weekly.weeklyGoalSeconds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载首页失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const progress = useMemo(() => {
    if (!weekGoalSeconds) return 0;
    return Math.min(1, weekSeconds / weekGoalSeconds);
  }, [weekGoalSeconds, weekSeconds]);

  if (loading && !attendance) {
    return <ScreenState loading label="正在加载打卡状态…" />;
  }

  if (error && !attendance) {
    return <ScreenState label={error} actionLabel="重试" onAction={() => void load()} />;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />}
    >
      <View>
        <Text style={styles.greeting}>你好，{user?.displayName ?? '同学'}</Text>
        <Text style={styles.subheading}>今天也继续保持节奏</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AttendanceActionCard
        accessToken={accessToken ?? ''}
        attendance={attendance}
        onChanged={(nextAttendance) => {
          setAttendance(nextAttendance);
          void load();
        }}
        onError={(message) => Alert.alert('打卡未完成', message)}
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.cardEyebrow}>本周累计</Text>
            <Text style={styles.duration}>{formatDuration(weekSeconds)}</Text>
          </View>
          <Text style={styles.goalText}>目标 {formatDuration(weekGoalSeconds)}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressValue, { width: `${Math.max(3, progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>已完成 {Math.round(progress * 100)}%</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  subheading: { color: colors.muted, fontSize: 14, marginTop: 5 },
  error: { color: colors.danger, fontSize: 14 },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 12 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardEyebrow: { color: colors.muted, fontSize: 13 },
  duration: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 4 },
  goalText: { color: colors.muted, fontSize: 12 },
  progressTrack: { height: 9, backgroundColor: colors.primarySoft, borderRadius: 9, overflow: 'hidden' },
  progressValue: { height: '100%', backgroundColor: colors.primary, borderRadius: 9 },
  progressText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
});
