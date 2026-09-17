import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readJSON, storageKeys, writeJSON } from '../lib/storage';
import { notificationsSupported } from '../notifications/notifications';
import HomeScreen from '../screens/HomeScreen';
import IntentScreen, { type Intent } from '../screens/IntentScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SuccessJourneyScreen from '../screens/SuccessJourneyScreen';
import TeamsScreen from '../screens/TeamsScreen';
import TrainScreen from '../screens/TrainScreen';
import { useAuth } from '../state/AuthContext';
import { useStats, useSync } from '../state/DataContext';
import { Header } from './Header';
import { TAB_BAR_HEIGHT, TabBar } from './TabBar';
import { ROUTES, type RouteKey } from './routes';

/**
 * Five tabs, each owning whatever depth it needs.
 *
 * The shell used to switch between ten screens and carry a slide-out menu for
 * the ones that would not fit in the bar. Both are gone: the menu existed only
 * to hold overflow, and with five destinations there is no overflow. Anything
 * deeper than a tab is that tab's own business, which is why this file no
 * longer grows when a feature gains a screen.
 */
export function AppShell() {
  const [route, setRoute] = useState<RouteKey>('home');
  /** `undefined` while the stored answer is being read; `null` means unasked. */
  const [intent, setIntent] = useState<Intent | null | undefined>(undefined);
  const [teamsAction, setTeamsAction] = useState<'join' | 'create' | undefined>(undefined);
  /** Bumped when the current route is re-selected; see `navigate`. */
  const [resetNonce, setResetNonce] = useState(0);

  const { user } = useAuth();
  const stats = useStats();
  const sync = useSync();
  const insets = useSafeAreaInsets();

  // Already computed once in the data layer — no second pass over the history.
  const streak = stats?.streak ?? 0;

  // Space reserved under every screen so the floating tab bar never covers content.
  const bottomInset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + 24;

  /**
   * Re-selecting the tab you are already on returns it to its root.
   *
   * Tabs own their stacks, so tapping Teams while three screens inside a team
   * otherwise appeared to do nothing at all. Bumping the key remounts the
   * screen, which resets its stack — what a tab bar is expected to do.
   */
  const navigate = useCallback(
    (next: RouteKey) => {
      setTeamsAction(undefined);
      setRoute(next);
      if (next === route) setResetNonce((value) => value + 1);
    },
    [route],
  );

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

  // Tapping a goal reminder drops the user straight on Home. Guarded because
  // Expo Go no longer supports this module and the failure is a hard client
  // exit rather than a catchable error.
  useEffect(() => {
    if (!notificationsSupported()) return;
    try {
      const sub = Notifications.addNotificationResponseReceivedListener(() => setRoute('home'));
      return () => sub.remove();
    } catch {
      return;
    }
  }, []);

  const meta = ROUTES[route];

  // Held back rather than flashed: the shell would otherwise render for a
  // frame behind the question.
  if (intent === undefined) return <View style={styles.root} />;
  if (intent === null) {
    return <IntentScreen name={user?.name ?? ''} onChoose={handleIntent} onSkip={skipIntent} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Header
        title={meta.title}
        subtitle={meta.subtitle}
        streak={streak}
        syncStatus={sync.status}
        onSync={sync.syncNow}
      />

      {/* Keyed so each route gets a fresh mount + entrance animation. */}
      <Animated.View
        key={`${route}:${resetNonce}`}
        entering={FadeIn.duration(220)}
        style={styles.screen}
      >
        {route === 'home' ? (
          <HomeScreen bottomInset={bottomInset} onOpenTimer={() => navigate('train')} />
        ) : route === 'journey' ? (
          <SuccessJourneyScreen bottomInset={bottomInset} />
        ) : route === 'train' ? (
          <TrainScreen bottomInset={bottomInset} />
        ) : route === 'teams' ? (
          <TeamsScreen bottomInset={bottomInset} initialAction={teamsAction} />
        ) : (
          <ProfileScreen bottomInset={bottomInset} />
        )}
      </Animated.View>

      <TabBar active={route} onSelect={navigate} bottomInset={insets.bottom} />
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
