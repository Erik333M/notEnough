import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayKey, longDateLabel } from '../../lib/time';
import type { DayKey } from '../../state/journey/types';
import { accentColor, palette, radius } from '../../theme/theme';

/**
 * The date a logged thing belongs to.
 *
 * Defaults to today and stays editable, because results and readings are
 * usually written up afterwards rather than on the spot. When the date has
 * drifted off today it offers one tap back, which is the only correction
 * anyone actually makes here.
 */
export const DatePickRow = memo(function DatePickRow({
  date,
  onChange,
}: {
  date: DayKey;
  onChange: (date: DayKey) => void;
}) {
  const useToday = useCallback(() => onChange(dayKey()), [onChange]);
  const isToday = date === dayKey();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{longDateLabel(date)}</Text>
      {isToday ? (
        <Text style={styles.today}>Today</Text>
      ) : (
        <Pressable
          onPress={useToday}
          accessibilityRole="button"
          accessibilityLabel="Change the date to today"
          style={styles.reset}
        >
          <Text style={styles.resetText}>Use today</Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  today: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: accentColor.lime,
  },
  reset: {
    minHeight: 44,
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
    color: accentColor.cyan,
  },
});
