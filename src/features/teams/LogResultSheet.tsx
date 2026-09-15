import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Assignment } from '../../api/teams';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader, Stepper } from '../../ui/Controls';
import { TextArea } from '../../ui/Field';
import { TASK_KIND_UNIT } from './taskCopy';

/**
 * Record what you actually did.
 *
 * Falling short is a first-class answer here, not a failure state. Someone who
 * rowed 18 of 20 should be able to say 18 and still mark the task done — a
 * session cut short by a tweaked hamstring is a session that happened, and the
 * app has no business overruling that. `done` is stored, never inferred from
 * whether the number reached the target.
 */
const STEP: Record<string, number> = { reps: 1, minutes: 1, distance: 50, check: 1 };

export function LogResultSheet({
  assignment,
  onClose,
  onSave,
}: {
  assignment: Assignment | null;
  onClose: () => void;
  onSave: (input: { amount: number; done: boolean; notes: string }) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    // Opens on what you already logged, or on the target — the number you are
    // most likely to be confirming rather than correcting.
    setAmount(assignment.result?.amount ?? assignment.target);
    setNotes(assignment.result?.notes ?? '');
  }, [assignment]);

  const save = useCallback(
    async (done: boolean) => {
      setBusy(true);
      const ok = await onSave({ amount, done, notes: notes.trim() });
      setBusy(false);
      if (ok) onClose();
    },
    [amount, notes, onClose, onSave],
  );

  const unit = assignment ? TASK_KIND_UNIT[assignment.kind] : '';
  const short = assignment ? amount < assignment.target : false;

  return (
    <Modal
      visible={assignment != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            {assignment ? (
              <>
                <SectionHeader
                  title={assignment.title}
                  meta={
                    assignment.kind === 'check'
                      ? 'Tick it off when it is done'
                      : `Your coach asked for ${assignment.target} ${unit}`
                  }
                  action={
                    <RoundIconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />
                  }
                />

                {assignment.detail ? <Text style={styles.detail}>{assignment.detail}</Text> : null}

                {assignment.kind === 'check' ? null : (
                  <Stepper
                    label="What you did"
                    value={amount}
                    display={`${amount} ${unit}`}
                    onChange={setAmount}
                    min={0}
                    max={100000}
                    step={STEP[assignment.kind] ?? 1}
                  />
                )}

                {short ? (
                  <Text style={styles.short}>
                    Short of the target is still worth logging. Mark it done if that was the
                    session — your coach sees the number, not a verdict.
                  </Text>
                ) : null}

                <TextArea
                  label="Notes for your coach (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="How it felt, anything that got in the way"
                />

                <Button
                  label={assignment.result?.done ? 'Save changes' : 'Mark done'}
                  icon="checkmark"
                  loading={busy}
                  onPress={() => void save(true)}
                />

                {assignment.result?.done ? (
                  <Button
                    label="Mark as not done"
                    icon="arrow-undo-outline"
                    variant="ghost"
                    onPress={() => void save(false)}
                  />
                ) : (
                  <Button
                    label="Save without finishing"
                    variant="ghost"
                    onPress={() => void save(false)}
                  />
                )}
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
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
  detail: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  short: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: palette.textFaint },
});
