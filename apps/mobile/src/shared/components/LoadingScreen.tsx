import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

export function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 14 },
});
