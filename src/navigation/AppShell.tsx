import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GoalsScreen from '../screens/GoalsScreen';
import HomeScreen from '../screens/HomeScreen';
import PlanScreen from '../screens/PlanScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TimerScreen from '../screens/TimerScreen';
import VictoriesScreen from '../screens/VictoriesScreen';
import { useAuth } from '../state/AuthContext';
import { useStats, useSync } from '../state/DataContext';
import { Header } from './Header';
import { SideMenu } from './SideMenu';
import { TAB_BAR_HEIGHT, TabBar } from './TabBar';
import { ROUTES, type RouteKey } from './routes';

export function AppShell() {
  const [route, setRoute] = useState<RouteKey>('home');
  const [menuOpen, setMenuOpen] = useState(false);

  const { user, logout } = useAuth();
  const stats = useStats();
  const sync = useSync();
  const insets = useSafeAreaInsets();

  // Already computed once in the data layer — no second pass over the history.
  const streak = stats?.streak ?? 0;

  // Space reserved under every screen so the floating tab bar never covers content.
  const bottomInset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + 24;

  const navigate = useCallback((next: RouteKey) => setRoute(next), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Tapping a goal reminder drops the user straight on Today.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setRoute('home');
      setMenuOpen(false);
    });
    return () => sub.remove();
  }, []);

  const meta = ROUTES[route];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Header
        title={meta.title}
        subtitle={meta.subtitle}
        streak={streak}
        syncStatus={sync.status}
        onMenu={openMenu}
        onSync={sync.syncNow}
      />

      {/* Keyed so each route gets a fresh mount + entrance animation. */}
      <Animated.View key={route} entering={FadeIn.duration(220)} style={styles.screen}>
        {route === 'home' ? (
          <HomeScreen bottomInset={bottomInset} navigate={navigate} />
        ) : route === 'victories' ? (
          <VictoriesScreen bottomInset={bottomInset} />
        ) : route === 'goals' ? (
          <GoalsScreen bottomInset={bottomInset} />
        ) : route === 'timer' ? (
          <TimerScreen bottomInset={bottomInset} />
        ) : route === 'progress' ? (
          <ProgressScreen bottomInset={bottomInset} />
        ) : route === 'plan' ? (
          <PlanScreen bottomInset={bottomInset} />
        ) : (
          <SettingsScreen bottomInset={bottomInset} />
        )}
      </Animated.View>

      <TabBar active={route} onSelect={navigate} bottomInset={insets.bottom} />

      <SideMenu
        open={menuOpen}
        active={route}
        userName={user?.name ?? 'Athlete'}
        userEmail={user?.email ?? ''}
        streak={streak}
        onSelect={navigate}
        onClose={closeMenu}
        onLogout={() => {
          closeMenu();
          void logout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
});
