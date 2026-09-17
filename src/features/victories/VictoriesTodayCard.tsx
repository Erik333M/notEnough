import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dayKey } from '../../lib/time';
import { useAppState } from '../../state/DataContext';
import { VICTORIES, dayScore, isVictoryWon, victoryDay } from '../../state/victories';
import { accentColor, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

/**
 * Today's three victories, small enough to live under the hero.
 *
 * 3 Victories lost its tab in the move to five, so it needs a presence on the
 * first screen or it stops being daily. This is a summary rather than a second
 * set of controls: three marks and a count, and the real board one tap away.
 * Two places to tick the same box is how they drift apart.
 */
export const VictoriesTodayCard = memo(function VictoriesTodayCard({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const state = useAppState();
  if (!state) return null;

  const today = victoryDay(state.victories.log, dayKey());
  const score = dayScore(today);
  const won = VICTORIES.filter((victory) => isVictoryWon(today, victory.key)).length;

  return (
    <PressableScale haptic="light" onPress={onOpen} accessibilityLabel="Open 3 Victories">
      <GlassCard style={styles.card}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name="shield-half-outline" size={15} color={accentColor.violet} />
          </View>
          <View style={styles.headBody}>
            <Text style={styles.title}>3 Victories</Text>
            <Text style={styles.meta}>
              {won === 3
                ? 'All three won today.'
                : won === 0
                  ? `${score} of 9 goals closed`
                  : `${won} of 3 won · ${score} of 9 goals`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={palette.textFaint} />
        </View>

        <View style={styles.marks}>
          {VICTORIES.map((victory) => {
            const done = isVictoryWon(today, victory.key);
            return (
              <View
                key={victory.key}
                style={[
                  styles.mark,
                  done && { backgroundColor: `${accentColor[victory.accent]}26` },
                ]}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : victory.icon}
                  size={14}
                  color={done ? accentColor[victory.accent] : palette.textFaint}
                />
                <Text style={[styles.markText, done && { color: accentColor[victory.accent] }]}>
                  {victory.label}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violetSoft,
  },
  headBody: { flex: 1, gap: 1 },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  meta: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
  marks: { flexDirection: 'row', gap: 8 },
  mark: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  markText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, color: palette.textMuted },
});
