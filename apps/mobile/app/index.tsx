import { Redirect } from 'expo-router';

import { LoginScreen } from '@/features/session/LoginScreen';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { useSession } from '@/features/session/SessionProvider';

export default function IndexRoute() {
  const { isHydrating, user } = useSession();

  if (isHydrating) {
    return <LoadingScreen label="正在恢复会话…" />;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return <LoginScreen />;
}
