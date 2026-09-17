import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMyWork } from '../features/teams/useMyWork';
import type { IconName } from '../state/types';
import { useAppState, useStats } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useCapabilities } from '../state/TeamsContext';
import { activeDayCount, bestStreak } from '../state/selectors';
import { totalDaysWon } from '../state/victories';
import { accentColor, gradients, palette, radius } from '../theme/theme';
import { Appear, SectionHeader } from '../ui/Controls';
import { GlassCard } from '../ui/Glass';
import { PressableScale } from '../ui/Touchable';

/**
 * You: who you are, what you have done, and everything about your account.
 *
 * The app had no such screen — your name lived in a slide-out menu and your
 * history lived in a tab called Progress, which is a word about numbers rather
 * than about you. Gathering them here is what lets the tab bar drop to five,
 * and it gives the friends feature somewhere to live that is not bolted on.
 */
type Row = { key: string; icon: IconName; title: string; copy: string };

export default function ProfileHomeScreen({
  bottomInset,
  onOpen,
}: {
  bottomInset: number;
  onOpen: (key: 'progress' | 'friends' | 'settings' | 'privacy') => void;
}) {
  const { user } = useAuth();
  const state = useAppState();
  const stats = useStats();
  const capabilities = useCapabilities();
  const work = useMyWork();

  const figures = useMemo(() => {
    if (!state) return { streak: 0, best: 0, days: 0, victories: 0 };
    return {
      streak: stats?.streak ?? 0,
      best: bestStreak(state),
      days: activeDayCount(state),
      victories: totalDaysWon(state.victories.log),
    };
  }, [state, stats]);

  const rows: Row[] = [
    {
      key: 'friends',
      icon: 'people-circle-outline',
      title: 'Friends',
      copy: 'People you train alongside',
    },
    {
      key: 'progress',
      icon: 'stats-chart-outline',
      title: 'Progress and achievements',
      copy: 'Streaks, history and what you have earned',
    },
    {
      key: 'settings',
      icon: 'settings-outline',
      title: 'Settings',
      copy: 'Account, reminders and sync',
    },
    {
      key: 'privacy',
      icon: 'lock-closed-outline',
      title: 'Privacy',
      copy: 'What this app knows, and what it shares',
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
    >
      <Appear>
        <GlassCard style={styles.head} elevated>
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.initials}>{initialsOf(user?.name ?? '')}</Text>
          </LinearGradient>

          <Text style={styles.name} numberOfLines={1}>
            {user?.name ?? 'Athlete'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email ?? ''}
          </Text>

          <View style={styles.figures}>
            <Figure value={figures.streak} label="day streak" accent="amber" />
            <Figure value={figures.victories} label="days won" accent="lime" />
            <Figure value={figures.days} label="days logged" accent="cyan" />
          </View>

          {figures.best > figures.streak ? (
            <Text style={styles.best}>Best run so far: {figures.best} days</Text>
          ) : null}
        </GlassCard>
      </Appear>

      {capabilities.hasTeams ? (
        <Appear delay={50}>
          <GlassCard style={styles.teamCard}>
            <Ionicons name="clipboard-outline" size={16} color={accentColor.violet} />
            <Text style={styles.teamCopy}>
              {capabilities.isCoach
                ? 'You coach a squad. Your teams are under the Teams tab.'
                : `${work.completed} session${work.completed === 1 ? '' : 's'} finished for your coach.`}
            </Text>
          </GlassCard>
        </Appear>
      ) : null}

      <Appear delay={100}>
        <SectionHeader title="Your account" />
        <View style={styles.rows}>
          {rows.map((row) => (
            <PressableScale
              key={row.key}
              haptic="light"
              onPress={() => onOpen(row.key as 'progress' | 'friends' | 'settings' | 'privacy')}
              accessibilityLabel={row.title}
            >
              <GlassCard style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name={row.icon} size={17} color={palette.text} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowCopy}>{row.copy}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
              </GlassCard>
            </PressableScale>
          ))}
        </View>
      </Appear>
    </ScrollView>
  );
}

const Figure = memo(function Figure({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: 'amber' | 'lime' | 'cyan';
}) {
  return (
    <View style={styles.figure}>
      <Text style={[styles.figureValue, { color: accentColor[accent] }]}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
});

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16 },
  head: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  initials: { fontSize: 26, fontWeight: '800', color: palette.onAccent },
  name: { fontSize: 20, fontWeight: '800', color: palette.text },
  email: { fontSize: 12.5, fontWeight: '600', color: palette.textMuted },
  figures: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  figure: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  figureValue: { fontSize: 20, fontWeight: '800' },
  figureLabel: { fontSize: 10.5, fontWeight: '700', color: palette.textMuted },
  best: { marginTop: 10, fontSize: 11.5, fontWeight: '700', color: palette.textFaint },
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamCopy: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  rowCopy: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
});
