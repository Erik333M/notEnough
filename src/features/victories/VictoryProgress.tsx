import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { VictoryDay } from '../../state/types';
import { TOTAL_VICTORY_GOALS, VICTORIES, isVictoryWon } from '../../state/victories';
import { motion, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { ProgressBar, ProgressRing } from '../../ui/Progress';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

type Props = {
  day: VictoryDay;
  score: number;
  victoriesWon: number;
  streak: number;
};

/**
 * The day's total: 0 / 9 with a ring, a bar, and the three victory marks.
 *
 * This is the bottom of the hierarchy the feature is built around —
 * 9 goals → 3 victories → 1 stronger day — so it deliberately reads as a
 * summary of the cards above rather than another place to tap.
 */
export const VictoryProgress = memo(function VictoryProgress({
  day,
  score,
  victoriesWon,
  streak,
}: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const complete = score === TOTAL_VICTORY_GOALS;
  const ratio = score / TOTAL_VICTORY_GOALS;

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!complete) {
      pulse.value = withTiming(0, { duration: motion.base });
      return;
    }
    // A slow breath rather than a bounce — the day is won, not a slot machine.
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [complete, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.03 }],
  }));

  return (
    <GlassCard
      style={[styles.card, complete && styles.cardWon]}
      elevated
      tone={complete ? 'strong' : 'default'}
    >
      {complete ? (
        <Animated.View style={[styles.glow, { pointerEvents: 'none' }, glowStyle]} />
      ) : null}

      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>TODAY&apos;S VICTORY</Text>
          <Text style={styles.score}>
            {score} <Text style={styles.scoreTotal}>/ {TOTAL_VICTORY_GOALS}</Text>
          </Text>
          <Text style={styles.sub}>
            {victoriesWon} of {VICTORIES.length} victories won
            {streak > 0 ? ` • ${streak} day${streak === 1 ? '' : 's'} perfect` : ''}
          </Text>
        </View>

        <ProgressRing progress={ratio} size={92} stroke={9} accent="spirit">
          <Text style={styles.ringValue}>{score}</Text>
          <Text style={styles.ringLabel}>of {TOTAL_VICTORY_GOALS}</Text>
        </ProgressRing>
      </View>

      <ProgressBar progress={ratio} accent={complete ? 'body' : 'spirit'} height={8} />

      <View style={styles.marks}>
        {VICTORIES.map((victory) => {
          const won = isVictoryWon(day, victory.key);
          return (
            <View
              key={victory.key}
              style={[
                styles.mark,
                won && {
                  borderColor: theme.accent[victory.accent],
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Text style={styles.markGlyph}>{victory.mark}</Text>
              <Text
                style={[styles.markLabel, won && { color: theme.accent[victory.accent] }]}
                numberOfLines={1}
              >
                {victory.label}
              </Text>
            </View>
          );
        })}
      </View>

      {complete ? <DayWonBanner /> : null}
    </GlassCard>
  );
});

/** The 9 / 9 payoff. Strong, but it holds still once it has landed. */
const DayWonBanner = memo(function DayWonBanner() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withSpring(1, motion.springSoft);
  }, [enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.9 + enter.value * 0.1 }],
  }));

  return (
    <Animated.View style={[styles.banner, style]}>
      <Ionicons name="flame" size={17} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>3 VICTORIES WON</Text>
        <Text style={styles.bannerCopy}>Body, mind and spirit. One stronger day.</Text>
      </View>
    </Animated.View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    gap: 14,
    overflow: 'hidden',
  },
  cardWon: {
    borderColor: 'rgba(184,242,124,0.45)',
  },
  glow: {
    position: 'absolute',
    top: -70,
    left: -40,
    right: -40,
    height: 200,
    borderRadius: 200,
    backgroundColor: theme.primarySoft,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: theme.textFaint,
  },
  score: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    color: theme.text,
    fontVariant: ['tabular-nums'],
  },
  scoreTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textFaint,
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  ringValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
  },
  ringLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textFaint,
  },
  marks: {
    flexDirection: 'row',
    gap: 8,
  },
  mark: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSunken,
  },
  markGlyph: {
    fontSize: 15,
  },
  markLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: theme.textFaint,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: 'rgba(184,242,124,0.13)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(184,242,124,0.42)',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: theme.primary,
  },
  bannerCopy: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    marginTop: 2,
  },
});
