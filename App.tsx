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
import { TeamsProvider } from './src/state/TeamsContext';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { BootSplash } from './src/ui/Feedback';
import { Screen } from './src/ui/Screen';
import { ToastProvider } from './src/ui/Toast';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/*
          Outside Screen so a crash in the canvas itself still renders the
          message rather than a blank window.
        */}
        <ErrorBoundary>
          <Screen>
            <StatusBar style="light" />
            <AuthProvider>
              <ToastProvider>
                <Root />
              </ToastProvider>
            </AuthProvider>
          </Screen>
        </ErrorBoundary>
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
      {/*
        Inside the data layer so a screen can read both, and keyed with it by
        user id. Teams are fetched rather than synced: they belong to more than
        one person, so a local copy is stale the moment a coach changes it.
      */}
      <TeamsProvider token={token}>
        <Animated.View entering={FadeIn.duration(320)} style={styles.root}>
          <AppShell />
        </Animated.View>
      </TeamsProvider>
    </DataProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
