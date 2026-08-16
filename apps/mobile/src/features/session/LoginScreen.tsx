import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { useSession } from '@/features/session/SessionProvider';
import { colors, spacing } from '@/shared/theme';

export function LoginScreen() {
  const { login } = useSession();
  const [username, setUsername] = useState('demo-member');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)/home');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请检查账号和网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.page}>
      <View style={styles.content}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
        <Text style={styles.title}>LecPunch</Text>
        <Text style={styles.subtitle}>移动端 Demo · 先从一次安心的打卡开始</Text>
        <View style={styles.form}>
          <Text style={styles.label}>用户名</Text>
          <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="输入用户名" />
          <Text style={styles.label}>密码</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="输入密码" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.submit, loading && styles.submitDisabled]} onPress={() => void submit()} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>进入工作台</Text>}
          </Pressable>
          <Text style={styles.helper}>本地演示账号：demo-member / 123456</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 10 },
  brandMark: { width: 56, height: 56, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  brandMarkText: { color: '#FFFFFF', fontSize: 27, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, lineHeight: 21 },
  form: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 9, marginTop: 20 },
  label: { color: colors.ink, fontWeight: '700', fontSize: 13, marginTop: 5 },
  input: { height: 49, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, color: colors.ink, backgroundColor: '#FBFCFE' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  submit: { minHeight: 50, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
