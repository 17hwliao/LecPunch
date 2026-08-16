import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { colors } from '@/shared/theme';

const tabIcon = (name: keyof typeof MaterialCommunityIcons.glyphMap) =>
  ({ color, size }: { color: unknown; size: number }) => <MaterialCommunityIcons name={name} color={color as string} size={size} />;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="home" options={{ title: '首页', tabBarIcon: tabIcon('home-variant-outline') }} />
      <Tabs.Screen name="records" options={{ title: '记录', tabBarIcon: tabIcon('clock-outline') }} />
      <Tabs.Screen name="team" options={{ title: '团队', tabBarIcon: tabIcon('account-group-outline') }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarIcon: tabIcon('account-circle-outline') }} />
    </Tabs>
  );
}
