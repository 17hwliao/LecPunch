import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

interface ScreenStateProps {
  label: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function ScreenState({ label, loading = false, actionLabel, onAction }: ScreenStateProps) {
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      <Text style={styles.label}>{label}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.button} onPress={onAction}><Text style={styles.buttonText}>{actionLabel}</Text></Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  label: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
  button: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
});
