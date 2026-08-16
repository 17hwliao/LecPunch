import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useSession } from '@/features/session/SessionProvider';
import { cancelCheckInReminder, getReminderEnabled, scheduleCheckInReminder } from '@/features/reminders/reminderService';
import { colors, spacing } from '@/shared/theme';

export default function ProfileScreen() {
  const { user, logout } = useSession();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    void getReminderEnabled().then(setReminderEnabled);
  }, []);

  const changeReminder = async (nextValue: boolean) => {
    setSavingReminder(true);
    try {
      if (nextValue) {
        await scheduleCheckInReminder();
      } else {
        await cancelCheckInReminder();
      }
      setReminderEnabled(nextValue);
    } catch (cause) {
      Alert.alert('提醒设置失败', cause instanceof Error ? cause.message : '请检查系统通知权限后重试');
    } finally {
      setSavingReminder(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.displayName.slice(0, 1) ?? 'L'}</Text></View>
        <Text style={styles.name}>{user?.displayName}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        <Text style={styles.role}>团队成员</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>打卡提醒</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>每日打卡提醒</Text>
            <Text style={styles.settingDescription}>每天 09:00 在本机提醒你开始打卡</Text>
          </View>
          <Switch value={reminderEnabled} onValueChange={(value) => void changeReminder(value)} disabled={savingReminder} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>
      <Text style={styles.footer}>Demo 版本不限制网关；正式规则仍由服务端统一裁决。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  profileCard: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 30, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 21, fontWeight: '800', marginTop: 12 },
  username: { color: colors.muted, marginTop: 3 },
  role: { color: colors.primaryDark, fontWeight: '700', backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginTop: 11, fontSize: 12 },
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.md, gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { flex: 1, gap: 3 },
  settingTitle: { color: colors.ink, fontWeight: '700' },
  settingDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  logoutButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#F6C8C8', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  logoutText: { color: colors.danger, fontWeight: '800' },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
