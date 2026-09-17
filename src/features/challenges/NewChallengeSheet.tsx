import { useCallback, useEffect, useMemo, useState } from 'react';
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

import type { ChallengeScope } from '../../api/teams';
import { dayKey, longDateLabel } from '../../lib/time';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader, Segmented, Stepper } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { dayCount, fullScore, suggestPeriod } from './period';

/**
 * Set a challenge for the squad.
 *
 * Length comes first, because it decides everything else: the window, the
 * suggested title and what a full score is worth. Picking "this month" then
 * fills in September and a target of ninety — three victories a day, every
 * day — which a coach can pull down to something humane.
 *
 * The reward is free text and the app awards nothing itself. A coach knows
 * what will actually motivate their squad; a generic trophy does not.
 */
const SCOPES: { value: ChallengeScope; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
];

const TITLE_HINT: Record<ChallengeScope, string> = {
  daily: 'Three today',
  weekly: 'A full week',
  monthly: 'The month',
};

export function NewChallengeSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    scope: ChallengeScope;
    title: string;
    description: string;
    reward: string;
    target: number;
    periodStart: string;
    periodEnd: string;
  }) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<ChallengeScope>('monthly');
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('');
  const [target, setTarget] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const period = useMemo(() => suggestPeriod(scope, dayKey()), [scope]);
  const full = fullScore(period.from, period.to);

  useEffect(() => {
    if (!open) return;
    setScope('monthly');
    setTitle('');
    setReward('');
    setError(null);
  }, [open]);

  // The old target means nothing in a new window: ninety is a month, not a day.
  useEffect(() => {
    setTarget(fullScore(period.from, period.to));
  }, [period.from, period.to]);

  const submit = useCallback(async () => {
    const clean = title.trim() || TITLE_HINT[scope];
    if (clean.length < 2) {
      setError('Give the challenge a name.');
      return;
    }
    setBusy(true);
    const ok = await onCreate({
      scope,
      title: clean,
      description: '',
      reward: reward.trim(),
      target,
      periodStart: period.from,
      periodEnd: period.to,
    });
    setBusy(false);
    if (ok) onClose();
  }, [onClose, onCreate, period.from, period.to, reward, scope, target, title]);

  const days = dayCount(period.from, period.to);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.grabber} />

              <SectionHeader
                title="New challenge"
                meta="Scored from 3 Victories — nought to three a day"
                action={
                  <RoundIconButton icon="close" size={34} onPress={onClose} accessibilityLabel="Close" />
                }
              />

              <View style={styles.block}>
                <Text style={styles.label}>HOW LONG</Text>
                <Segmented options={SCOPES} value={scope} onChange={setScope} />
                <Text style={styles.window}>
                  {days === 1
                    ? longDateLabel(period.from)
                    : `${longDateLabel(period.from)} → ${longDateLabel(period.to)} · ${days} days`}
                </Text>
              </View>

              <Field
                label="Name"
                value={title}
                onChangeText={(next) => {
                  setTitle(next);
                  if (error) setError(null);
                }}
                placeholder={TITLE_HINT[scope]}
                icon="trophy-outline"
                error={error}
                autoCapitalize="sentences"
              />

              <Stepper
                label={`Target — a perfect run is ${full}`}
                value={target}
                display={`${target} victories`}
                onChange={setTarget}
                min={1}
                max={full}
                step={days === 1 ? 1 : 3}
              />

              <Field
                label="Reward (optional)"
                value={reward}
                onChangeText={setReward}
                placeholder="Whatever you have promised them"
                icon="gift-outline"
                autoCapitalize="sentences"
              />

              <Button label="Set the challenge" icon="flag" loading={busy} onPress={submit} />

              <Text style={styles.note}>
                Nobody is entered automatically. Each person chooses to join, and only their total
                is shared — never what it was made of.
              </Text>
            </View>
          </ScrollView>
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
  window: { fontSize: 12, fontWeight: '700', color: palette.textMuted },
  note: { fontSize: 11.5, lineHeight: 16.5, fontWeight: '600', color: palette.textFaint },
});
