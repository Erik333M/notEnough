import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * One number on an entry screen.
 *
 * Buttons and a typeable box, not a stepper. Most of what gets entered is a
 * small count where tapping + twice is fastest, but the fields are whatever
 * the organiser invented — possession of 62% is one of them, and nobody is
 * pressing a button sixty-two times.
 *
 * The text is held as a string while it is being edited so a half-typed value
 * is not rounded out from under the person typing it.
 */
export const StatInput = memo(function StatInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));

  // Follows the value when it changes from outside — a reset, or a reload.
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/[^\d.-]/g, ''));
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
    setText(String(next));
    onChange(next);
  };

  const nudge = (by: number) => {
    const next = Math.min(max, Math.max(min, value + by));
    setText(String(next));
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      <PressableScale haptic="light" onPress={() => nudge(-1)} accessibilityLabel={`One fewer ${label}`}>
        <View style={styles.button}>
          <Ionicons name="remove" size={15} color={palette.text} />
        </View>
      </PressableScale>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={label}
      />

      <PressableScale haptic="light" onPress={() => nudge(1)} accessibilityLabel={`One more ${label}`}>
        <View style={styles.button}>
          <Ionicons name="add" size={15} color={palette.text} />
        </View>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 12.5, fontWeight: '700', color: palette.textMuted },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
  },
  input: {
    width: 56,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: palette.glass,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
});
