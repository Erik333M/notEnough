import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from './src/navigation/AppShell';
import AuthScreen from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { DataProvider } from './src/state/DataContext';
import { BootSplash } from './src/ui/Feedback';
import { Screen } from './src/ui/Screen';
import { ToastProvider } from './src/ui/Toast';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Screen>
          <StatusBar style="light" />
          <AuthProvider>
            <ToastProvider>
              <Root />
            </ToastProvider>
          </AuthProvider>
        </Screen>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Auth gate. The splash is held for a short minimum so a fast disk read does
 * not produce a one-frame flash of the loader — it either shows properly or
 * not at all.
 */
function Root() {
  const { status, user, token, invalidateSession } = useAuth();
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), 650);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'loading' || !minimumElapsed) {
    return (
      <Animated.View exiting={FadeOut.duration(220)} style={styles.root}>
        <BootSplash label={status === 'loading' ? 'Restoring your session' : 'Almost there'} />
      </Animated.View>
    );
  }

  if (status === 'signedOut' || !user) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.root}>
        <AuthScreen />
      </Animated.View>
    );
  }

  return (
    // Keyed by user id so switching accounts rebuilds the data layer cleanly.
    <DataProvider
      key={user.id}
      userId={user.id}
      token={token}
      onUnauthorized={() => void invalidateSession()}
    >
      <Animated.View entering={FadeIn.duration(320)} style={styles.root}>
        <AppShell />
      </Animated.View>
    </DataProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
