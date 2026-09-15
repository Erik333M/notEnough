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

import type { TaskKind } from '../../api/teams';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader, Segmented, Stepper } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { TASK_KIND_HINT, TASK_KIND_LABEL, TASK_KINDS, TASK_KIND_UNIT } from './taskCopy';

/**
 * Add one task to a session.
 *
 * The kind decides whether a target is asked for at all: a plain tick-off has
 * nothing to count, so showing it a target field would be asking a question
 * with no useful answer. Defaults are the common case for each kind, so most
 * tasks are a title and one tap.
 */
const DEFAULT_TARGET: Record<TaskKind, number> = {
  check: 1,
  reps: 20,
  minutes: 10,
  distance: 400,
};

const STEP: Record<TaskKind, number> = { check: 1, reps: 5, minutes: 1, distance: 100 };

export function AddTaskSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: { title: string; detail: string; kind: TaskKind; target: number }) => Promise<void> | void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [kind, setKind] = useState<TaskKind>('check');
  const [target, setTarget] = useState(DEFAULT_TARGET.check);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDetail('');
    setKind('check');
    setTarget(DEFAULT_TARGET.check);
    setError(null);
  }, [open]);

  const changeKind = useCallback((next: TaskKind) => {
    setKind(next);
    // The old number means nothing in the new unit — 20 reps is not 20 metres.
    setTarget(DEFAULT_TARGET[next]);
  }, []);

  const handleAdd = useCallback(async () => {
    const clean = title.trim();
    if (clean.length < 2) {
      setError('Give the task a name.');
      return;
    }
    setBusy(true);
    await onAdd({ title: clean, detail: detail.trim(), kind, target });
    setBusy(false);
  }, [detail, kind, onAdd, target, title]);

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
              title="Add a task"
              meta="One line of the session"
              action={<RoundIconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />}
            />

            <Field
              label="Task"
              value={title}
              onChangeText={(next) => {
                setTitle(next);
                if (error) setError(null);
              }}
              placeholder="e.g. 2k row"
              icon="barbell-outline"
              error={error}
              autoCapitalize="sentences"
            />

            <Field
              label="Notes (optional)"
              value={detail}
              onChangeText={setDetail}
              placeholder="Anything they need to know"
              icon="document-text-outline"
              autoCapitalize="sentences"
            />

            <View style={styles.block}>
              <Text style={styles.label}>HOW IS IT COUNTED?</Text>
              <Segmented
                options={TASK_KINDS.map((value) => ({ value, label: TASK_KIND_LABEL[value] }))}
                value={kind}
                onChange={changeKind}
              />
            </View>

            {kind === 'check' ? (
              <Text style={styles.note}>{TASK_KIND_HINT.check}</Text>
            ) : (
              <Stepper
                label={TASK_KIND_HINT[kind]}
                value={target}
                display={`${target} ${TASK_KIND_UNIT[kind]}`}
                onChange={setTarget}
                min={STEP[kind]}
                max={100000}
                step={STEP[kind]}
              />
            )}

            <Button label="Add task" icon="add" loading={busy} onPress={handleAdd} />
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
  block: { gap: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: palette.textFaint },
  note: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
});
