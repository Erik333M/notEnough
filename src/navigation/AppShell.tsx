import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GoalsScreen from '../screens/GoalsScreen';
import HomeScreen from '../screens/HomeScreen';
import PlanScreen from '../screens/PlanScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SuccessJourneyScreen from '../screens/SuccessJourneyScreen';
import TeamsScreen from '../screens/TeamsScreen';
import TimerScreen from '../screens/TimerScreen';
import VictoriesScreen from '../screens/VictoriesScreen';
import { notificationsSupported } from '../notifications/notifications';
import IntentScreen, { type Intent } from '../screens/IntentScreen';
import { readJSON, storageKeys, writeJSON } from '../lib/storage';
import { useAuth } from '../state/AuthContext';
import { useStats, useSync } from '../state/DataContext';
import { useCapabilities } from '../state/TeamsContext';
import { Header } from './Header';
import { SideMenu } from './SideMenu';
import { TAB_BAR_HEIGHT, TabBar } from './TabBar';
import { ROUTES, menuRoutes, type RouteKey } from './routes';

export function AppShell() {
  const [route, setRoute] = useState<RouteKey>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  /** `undefined` while the stored answer is being read; `null` means unasked. */
  const [intent, setIntent] = useState<Intent | null | undefined>(undefined);
  const [teamsAction, setTeamsAction] = useState<'join' | 'create' | undefined>(undefined);

  const { user, logout } = useAuth();
  const capabilities = useCapabilities();
  const stats = useStats();
  const sync = useSync();
  const insets = useSafeAreaInsets();

  // Already computed once in the data layer — no second pass over the history.
  const streak = stats?.streak ?? 0;

  // Space reserved under every screen so the floating tab bar never covers content.
  const bottomInset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + 24;

  const navigate = useCallback((next: RouteKey) => {
    setTeamsAction(undefined);
    setRoute(next);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void readJSON<Intent | null>(storageKeys.intent(user.id), null).then((stored) => {
      if (!cancelled) setIntent(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * The answer picks the opening screen and is then done with.
   *
   * Nothing downstream reads it again: capabilities come from real
   * memberships, so someone who answered "on my own" and later joins a squad
   * gets the full team experience without anything to undo.
   */
  const handleIntent = useCallback(
    (choice: Intent) => {
      setIntent(choice);
      if (user) void writeJSON(storageKeys.intent(user.id), choice);
      if (choice === 'athlete') {
        setTeamsAction('join');
        setRoute('teams');
      } else if (choice === 'coach') {
        setTeamsAction('create');
        setRoute('teams');
      }
    },
    [user],
  );

  const skipIntent = useCallback(() => {
    setIntent('solo');
    if (user) void writeJSON(storageKeys.intent(user.id), 'solo');
  }, [user]);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Tapping a goal reminder drops the user straight on Today. Guarded because
  // Expo Go no longer supports this module and the failure is a hard client
  // exit rather than a catchable error.
  useEffect(() => {
    if (!notificationsSupported()) return;
    try {
      const sub = Notifications.addNotificationResponseReceivedListener(() => {
        setRoute('home');
        setMenuOpen(false);
      });
      return () => sub.remove();
    } catch {
      return;
    }
  }, []);

  // One derivation, from one boolean. Teams simply is not in the menu for a
  // solo user, rather than being present and refusing to open.
  const menu = useMemo(() => menuRoutes({ hasTeams: capabilities.hasTeams }), [capabilities.hasTeams]);

  const meta = ROUTES[route];

  // Held back rather than flashed: the shell would otherwise render for a
  // frame behind the question.
  if (intent === undefined) return <View style={styles.root} />;
  if (intent === null) return <IntentScreen onChoose={handleIntent} onSkip={skipIntent} />;

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
        ) : route === 'journey' ? (
          <SuccessJourneyScreen bottomInset={bottomInset} />
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
        ) : route === 'teams' ? (
          <TeamsScreen
            bottomInset={bottomInset}
            initialAction={teamsAction}
            onOpenTeam={() => undefined}
          />
        ) : route === 'privacy' ? (
          <PrivacyScreen bottomInset={bottomInset} />
        ) : (
          <SettingsScreen bottomInset={bottomInset} navigate={navigate} />
        )}
      </Animated.View>

      <TabBar active={route} onSelect={navigate} bottomInset={insets.bottom} />

      <SideMenu
        open={menuOpen}
        active={route}
        userName={user?.name ?? 'Athlete'}
        userEmail={user?.email ?? ''}
        streak={streak}
        routes={menu}
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
