import { memo, useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dayOfMonth, weekdayLabel } from '../../lib/time';
import type { DayDot } from '../../state/journey/entries';
import { accentColor, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * The last ~14 days as a row of dots.
 *
 * Deliberately unjudgemental. An unfilled day is a faint outline, never red and
 * never marked "missed" — the strip is there so you can see your own shape over
 * a fortnight and jump back to fix a day, not to be told off. A filled dot
 * varies in opacity with how much the day holds, so a rich day reads as
 * brighter without a blank day reading as a failure.
 */
const DayCell = memo(function DayCell({
  dot,
  onPress,
}: {
  dot: DayDot;
  onPress: (date: string) => void;
}) {
  const handlePress = useCallback(() => onPress(dot.key), [dot.key, onPress]);

  // Never fully transparent: a logged day is always visibly logged.
  const fillOpacity = dot.filled ? 0.55 + dot.intensity * 0.45 : 0;

  return (
    <PressableScale
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.9}
      accessibilityLabel={`${weekdayLabel(dot.key)} ${dayOfMonth(dot.key)}, ${
        dot.filled ? 'logged' : 'nothing logged'
      }${dot.isToday ? ', today' : ''}`}
      style={styles.cell}
    >
      <Text style={[styles.weekday, dot.isToday && styles.todayText]}>
        {weekdayLabel(dot.key).slice(0, 1)}
      </Text>

      <View style={[styles.dot, dot.isToday && styles.todayDot]}>
        {dot.filled ? (
          <View
            style={[
              styles.dotFill,
              { backgroundColor: accentColor.violet, opacity: fillOpacity },
            ]}
          />
        ) : null}
      </View>

      <Text style={[styles.date, dot.isToday && styles.todayText]}>{dayOfMonth(dot.key)}</Text>
    </PressableScale>
  );
});

export const CalendarStrip = memo(function CalendarStrip({
  days,
  onSelect,
}: {
  days: DayDot[];
  onSelect: (date: string) => void;
}) {
  const scroller = useRef<ScrollView>(null);

  // Today is the rightmost cell, so the strip opens showing it. Without this
  // the user lands on a fortnight-old Monday.
  const scrollToToday = useCallback(() => {
    scroller.current?.scrollToEnd({ animated: false });
  }, []);

  useEffect(scrollToToday, [scrollToToday]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      onContentSizeChange={scrollToToday}
      accessibilityLabel="Last fourteen days"
    >
      {days.map((dot) => (
        <DayCell key={dot.key} dot={dot} onPress={onSelect} />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: 4,
    paddingHorizontal: 2,
  },
  cell: {
    // 44pt minimum target, as required for every tappable thing in the feature.
    width: 44,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.md,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
    letterSpacing: 0.4,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    backgroundColor: palette.glassSunken,
    overflow: 'hidden',
  },
  todayDot: {
    borderColor: accentColor.violet,
  },
  dotFill: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  date: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
  },
  todayText: {
    color: palette.text,
  },
});
