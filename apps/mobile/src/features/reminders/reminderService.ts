import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REMINDER_ID_KEY = 'lecpunch.checkin-reminder-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getReminderEnabled(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(REMINDER_ID_KEY));
}

export async function scheduleCheckInReminder(): Promise<void> {
  const permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) {
    throw new Error('未获得通知权限，请在系统设置中允许 LecPunch 发送通知');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('checkin-reminders', {
      name: '打卡提醒',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelCheckInReminder();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '今天记得打卡',
      body: '打开 LecPunch，开始今天的打卡记录。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
  await SecureStore.setItemAsync(REMINDER_ID_KEY, notificationId);
}

export async function cancelCheckInReminder(): Promise<void> {
  const notificationId = await SecureStore.getItemAsync(REMINDER_ID_KEY);
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
  await SecureStore.deleteItemAsync(REMINDER_ID_KEY);
}
