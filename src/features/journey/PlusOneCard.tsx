import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PLUS_ONE_KEYS } from '../../state/journey/factory';
import type { PlusOne, PlusOneKey } from '../../state/journey/types';
import { accentColor, motion, palette } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { InfoTip } from './InfoTip';
import { PLUS_ONE_HINT, PLUS_ONE_LABEL } from './journeyCopy';

/**
 * The six Plus One dimensions.
 *
 * The single fastest thing on the screen: six taps, no typing, no numbers. It
 * is the one card a brand-new user can complete without understanding anything
 * about the rest of the workbook, which is why it sits on the home screen from
 * day one.
 *
 * There is no total and no percentage. One tick is a complete answer — showing
 * "1/6" would quietly turn a note into a score to fall short of.
 */
const Dimension = memo(function Dimension({
  dimension,
  done,
  onToggle,
}: {
  dimension: PlusOneKey;
  done: boolean;
  onToggle: (key: PlusOneKey) => void;
}) {
  const t = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    t.value = withSpring(done ? 1 : 0, motion.spring);
  }, [done, t]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 1],
      [palette.glassSunken, accentColor.cyan],
    ),
    borderColor: interpolateColor(t.value, [0, 1], [palette.hairlineStrong, accentColor.cyan]),
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.4 + t.value * 0.6 }],
  }));

  const handlePress = useCallback(() => onToggle(dimension), [dimension, onToggle]);

  return (
    <PressableScale
      onPress={handlePress}
      haptic={done ? 'light' : 'medium'}
      scaleTo={0.98}
      accessibilityRole="switch"
      accessibilityLabel={`${PLUS_ONE_LABEL[dimension]}. ${PLUS_ONE_HINT[dimension]}`}
      style={styles.row}
    >
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={tickStyle}>
          <Ionicons name="add" size={17} color={palette.onAccent} />
        </Animated.View>
      </Animated.View>

      <View style={styles.text}>
        <Text style={styles.label}>{PLUS_ONE_LABEL[dimension]}</Text>
        <Text style={styles.hint} numberOfLines={1}>
          {PLUS_ONE_HINT[dimension]}
        </Text>
      </View>
    </PressableScale>
  );
});

export const PlusOneCard = memo(function PlusOneCard({
  plusOne,
  onToggle,
}: {
  plusOne: PlusOne;
  onToggle: (key: PlusOneKey) => void;
}) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>PLUS ONE</Text>
        <InfoTip topic="plusOne" />
      </View>
      <Text style={styles.lede}>Tick anything you gave something to today.</Text>

      <View style={styles.list}>
        {PLUS_ONE_KEYS.map((dimension) => (
          <Dimension
            key={dimension}
            dimension={dimension}
            done={plusOne[dimension]}
            onToggle={onToggle}
          />
        ))}
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: accentColor.cyan,
  },
  lede: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textMuted,
    marginBottom: 6,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Keeps every dimension a 44pt target even at the default font size.
    minHeight: 44,
    paddingVertical: 2,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  hint: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 1,
  },
});
