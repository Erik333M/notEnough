import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { VictoryDay, VictoryGoalKey } from '../../state/types';
import { isGoalDone, victoryScore, type VictoryDef } from '../../state/victories';
import { accentColor, accentSoft, motion, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { VictoryGoalDot, VictoryGoalItem } from './VictoryGoalItem';

type Props = {
  victory: VictoryDef;
  day: VictoryDay;
  targets: Record<VictoryGoalKey, string>;
  onToggle: (goal: VictoryGoalKey) => void;
  onEditTarget: (goal: VictoryGoalKey) => void;
};

/**
 * One victory: three goals, a count, and the banner it earns at 3 / 3.
 *
 * Memoised against the day record so tapping a goal in PHYSICAL does not
 * repaint MIND or SPIRIT.
 */
export const VictoryCard = memo(function VictoryCard({
  victory,
  day,
  targets,
  onToggle,
  onEditTarget,
}: Props) {
  const score = victoryScore(day, victory.key);
  const total = victory.goals.length;
  const won = score === total;

  const glow = useSharedValue(won ? 1 : 0);

  useEffect(() => {
    glow.value = won
      ? withSpring(1, motion.springSoft)
      : withTiming(0, { duration: motion.base });
  }, [won, glow]);

  // Scale only. The border lives on the card itself — animating it on this
  // wrapper would set a colour on a view that has no border to paint.
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + glow.value * 0.006 }],
  }));

  return (
    <Animated.View style={liftStyle}>
      <GlassCard
        style={[
          styles.card,
          won && {
            backgroundColor: accentSoft[victory.accent],
            borderColor: accentColor[victory.accent],
          },
        ]}
        tone={won ? 'strong' : 'default'}
        elevated={won}
      >
        <View style={styles.head}>
          <View style={[styles.mark, { backgroundColor: accentSoft[victory.accent] }]}>
            <Text style={styles.markText}>{victory.mark}</Text>
          </View>

          <View style={styles.headText}>
            <Text style={[styles.label, { color: accentColor[victory.accent] }]} numberOfLines={1}>
              {victory.label}
            </Text>
            <Text style={styles.purpose} numberOfLines={1}>
              {victory.purpose}
            </Text>
          </View>

          <Text style={[styles.score, won && { color: accentColor[victory.accent] }]}>
            {score} / {total}
          </Text>
        </View>

        <View style={styles.dots}>
          {victory.goals.map((goal) => (
            <VictoryGoalDot
              key={goal.key}
              done={isGoalDone(day, goal.key)}
              accent={victory.accent}
            />
          ))}
        </View>

        <View style={styles.goals}>
          {victory.goals.map((goal) => (
            <VictoryGoalItem
              key={goal.key}
              goal={goal}
              target={targets[goal.key]}
              done={isGoalDone(day, goal.key)}
              accent={victory.accent}
              onToggle={onToggle}
              onEditTarget={onEditTarget}
            />
          ))}
        </View>

        {won ? (
          <Animated.View
            entering={FadeIn.duration(motion.base)}
            style={[
              styles.banner,
              {
                backgroundColor: accentSoft[victory.accent],
                borderColor: accentColor[victory.accent],
              },
            ]}
          >
            <Ionicons name="flame" size={14} color={accentColor[victory.accent]} />
            <Text style={[styles.bannerText, { color: accentColor[victory.accent] }]}>
              {victory.label} VICTORY WON
            </Text>
          </Animated.View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 19,
  },
  headText: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  purpose: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 3,
  },
  score: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  goals: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: palette.hairline,
    paddingTop: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});
