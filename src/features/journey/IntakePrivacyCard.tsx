import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { intakeHasAnswers } from '../../state/journey/intake';
import type { Intake } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { GlassCard } from '../../ui/Glass';

/**
 * Review or withdraw the baseline answers.
 *
 * Shown even when there is nothing stored, because the promise made during
 * onboarding — that this can be deleted — has to be findable *after*
 * onboarding, not only in the moment it was made. When nothing was answered it
 * says so plainly rather than disappearing, which is the difference between
 * "you have no data here" and "we hid the control".
 *
 * Deletion is two taps: it is irreversible, and this is the one place in the
 * feature where that is true of something the user cannot re-derive.
 */
export const IntakePrivacyCard = memo(function IntakePrivacyCard({
  intake,
  onWithdraw,
}: {
  intake: Intake;
  onWithdraw: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const hasAnswers = intakeHasAnswers(intake);

  return (
    <GlassCard tone="sunken" style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="lock-closed-outline" size={15} color={palette.textFaint} />
        <Text style={styles.title}>Your answers</Text>
      </View>

      <Text style={styles.copy}>
        {hasAnswers
          ? 'The questions you answered when you started are kept on this phone only, and are never synced.'
          : 'You skipped the starting questions. Nothing about your health is stored.'}
      </Text>

      {hasAnswers ? (
        confirming ? (
          <View style={styles.row}>
            <Button
              label="Delete them"
              icon="trash-outline"
              variant="danger"
              onPress={onWithdraw}
              style={styles.button}
            />
            <Button
              label="Keep"
              variant="ghost"
              onPress={() => setConfirming(false)}
              style={styles.button}
            />
          </View>
        ) : (
          <Button
            label="Delete my answers"
            icon="trash-outline"
            variant="glass"
            onPress={() => setConfirming(true)}
          />
        )
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    borderRadius: radius.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
  copy: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textMuted,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
