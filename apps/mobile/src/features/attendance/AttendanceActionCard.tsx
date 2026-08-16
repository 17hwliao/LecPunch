import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { checkIn, checkOut, type CurrentAttendance } from '@/features/attendance/attendanceApi';
import { formatDuration } from '@/shared/lib/format';
import { colors, spacing } from '@/shared/theme';

interface AttendanceActionCardProps {
  accessToken: string;
  attendance: CurrentAttendance | null;
  onChanged: (next: CurrentAttendance | null) => void;
  onError: (message: string) => void;
}

export function AttendanceActionCard({ accessToken, attendance, onChanged, onError }: AttendanceActionCardProps) {
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const activeSession = attendance?.hasActiveSession ? attendance.session : null;

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const elapsedSeconds = useMemo(() => {
    if (!activeSession) return 0;
    return Math.max(0, Math.floor((now - new Date(activeSession.checkInAt).getTime()) / 1000));
  }, [activeSession, now]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (activeSession) {
        await checkOut(accessToken);
        onChanged({ hasActiveSession: false, session: null });
      } else {
        await checkIn(accessToken);
        onChanged(null);
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = Boolean(activeSession);
  return (
    <View style={[styles.card, isActive ? styles.activeCard : styles.readyCard]}>
      <Text style={[styles.eyebrow, isActive ? styles.activeText : styles.readyText]}>{isActive ? '正在打卡' : '准备开始'}</Text>
      <Text style={[styles.mainText, isActive ? styles.activeText : styles.readyText]}>{isActive ? formatDuration(elapsedSeconds) : '还未开始打卡'}</Text>
      <Text style={[styles.description, isActive ? styles.activeDescription : styles.readyDescription]}>
        {isActive ? `上卡时间：${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(activeSession!.checkInAt))}` : '点击下方按钮，服务端将记录本次开始时间'}
      </Text>
      <Pressable style={[styles.action, isActive ? styles.stopAction : styles.startAction, submitting && styles.disabled]} onPress={() => void submit()} disabled={submitting}>
        {submitting ? <ActivityIndicator color={isActive ? colors.danger : '#FFFFFF'} /> : <Text style={[styles.actionText, isActive ? styles.stopActionText : undefined]}>{isActive ? '结束打卡' : '开始打卡'}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: spacing.lg, gap: 9 },
  readyCard: { backgroundColor: colors.ink },
  activeCard: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#A9E7C4' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  mainText: { fontSize: 31, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 20 },
  activeText: { color: colors.success },
  readyText: { color: '#FFFFFF' },
  activeDescription: { color: '#367657' },
  readyDescription: { color: '#C7D2E9' },
  action: { minHeight: 51, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  startAction: { backgroundColor: colors.primary },
  stopAction: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8E5C7' },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  stopActionText: { color: colors.danger },
  disabled: { opacity: 0.65 },
});
