import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, dayKey, longDateLabel } from '../../lib/time';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';

/**
 * Name a session and say when it is.
 *
 * The date is a row of the next fortnight rather than a calendar: a coach is
 * planning this week or next, and two taps beats a date picker for that. It
 * defaults to today, which is the most common answer by a wide margin.
 */
const DAYS_OFFERED = 14;

export function NewSessionSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, date: string) => Promise<void> | void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [date, setDate] = useState(dayKey());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDate(dayKey());
    setError(null);
  }, [open]);

  const handleCreate = useCallback(async () => {
    const clean = name.trim();
    if (clean.length < 2) {
      setError('Give the session a name.');
      return;
    }
    setBusy(true);
    await onCreate(clean, date);
    setBusy(false);
  }, [date, name, onCreate]);

  const days = Array.from({ length: DAYS_OFFERED }, (_, index) => dayKey(addDays(new Date(), index)));

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            <SectionHeader
              title="New session"
              meta="Add tasks next, then hand it out"
              action={<RoundIconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />}
            />

            <Field
              label="What is it?"
              value={name}
              onChangeText={(next) => {
                setName(next);
                if (error) setError(null);
              }}
              placeholder="e.g. Tuesday conditioning"
              icon="calendar-outline"
              error={error}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <View style={styles.dates}>
              <Text style={styles.label}>WHEN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {days.map((day) => (
                  <Chip
                    key={day}
                    label={day === dayKey() ? 'Today' : shortLabel(day)}
                    active={day === date}
                    onPress={() => setDate(day)}
                  />
                ))}
              </ScrollView>
              <Text style={styles.chosen}>{longDateLabel(date)}</Text>
            </View>

            <Button label="Create session" icon="add" loading={busy} onPress={handleCreate} />

            <Text style={styles.note}>
              Nothing is sent to anyone until you hand it out.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** "Tue 23" — enough to pick from without the year taking up the chip. */
function shortLabel(key: string): string {
  const label = longDateLabel(key);
  const parts = label.split(' ');
  return parts.slice(0, 2).join(' ');
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,3,10,0.72)' },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    gap: 14,
    padding: 18,
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  dates: { gap: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: palette.textFaint },
  chips: { gap: 8, paddingRight: 8 },
  chosen: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  note: { fontSize: 11.5, fontWeight: '600', color: palette.textFaint, textAlign: 'center' },
});
