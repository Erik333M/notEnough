import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../../theme/theme';
import { Pill, StatTile } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { ProgressRing } from '../../ui/Progress';

/**
 * The first thing on the first screen: where today stands.
 *
 * Deliberately says "still open" rather than a percentage shortfall. The
 * number is there in the ring for anyone who wants it, but the sentence is
 * about the day being unfinished, not about you being behind — this app
 * raises targets when you meet them, so a guilt-first greeting would be
 * relentless.
 */
export const TodayHero = memo(function TodayHero({
  name,
  goalCount,
  closed,
  streak,
  completion,
}: {
  name: string | undefined;
  goalCount: number;
  closed: number;
  streak: number;
  completion: number;
}) {
  const percent = Math.round(completion * 100);

  return (
    <GlassCard style={styles.hero} elevated>
      <View style={styles.heroTop}>
        <View style={{ flex: 1, gap: 6 }}>
          <Pill label={greeting()} icon="sunny-outline" accent="amber" />
          <Text style={styles.heroTitle} numberOfLines={2}>
            {firstName(name)}, today is {percent >= 100 ? 'closed out' : 'still open'}.
          </Text>
          <Text style={styles.heroCopy}>
            {closed} of {goalCount} goals complete • {streak} day streak
          </Text>
        </View>

        <ProgressRing progress={completion} size={96} accent="violet">
          <Text style={styles.ringValue}>{percent}%</Text>
          <Text style={styles.ringLabel}>today</Text>
        </ProgressRing>
      </View>

      <View style={styles.statRow}>
        <StatTile value={`${closed}`} label="Closed" accent="lime" />
        <StatTile value={`${goalCount - closed}`} label="Open" />
        <StatTile value={`${streak}d`} label="Streak" accent="amber" />
      </View>
    </GlassCard>
  );
});

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string | undefined): string {
  if (!name) return 'Athlete';
  return name.trim().split(/\s+/)[0];
}

const styles = StyleSheet.create({
  hero: { gap: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800', color: palette.text },
  heroCopy: { fontSize: 12.5, fontWeight: '600', color: palette.textMuted },
  ringValue: { fontSize: 20, fontWeight: '800', color: palette.text },
  ringLabel: { fontSize: 10, fontWeight: '700', color: palette.textMuted },
  statRow: { flexDirection: 'row', gap: 10 },
});
