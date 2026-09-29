import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IntakeForm } from '../features/journey/IntakeForm';
import type { Intake } from '../state/journey/types';
import { radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear } from '../ui/Controls';
import { GlassCard } from '../ui/Glass';
import type { Theme } from '../theme/tokens';
import { useStyles, useTheme } from '../theme/ThemeContext';

/**
 * Three screens, every one skippable.
 *
 * The rule this is built around is "under 60 seconds to a first entry", so
 * skipping is never buried: each step carries its own skip, and skipping any
 * of them lands you straight on today. Nobody is held behind a questionnaire
 * to reach the thing they downloaded the app for.
 *
 * Step two is the "why we ask" gate. No sensitive question appears until the
 * user has been told what is collected, where it is kept, and that they can
 * decline — and declining is presented as a normal answer, not a refusal.
 */
type Step = 'welcome' | 'why' | 'questions';

export default function OnboardingFlow({
  intake,
  bottomInset,
  onSave,
  onSkip,
}: {
  intake: Intake;
  bottomInset: number;
  onSave: (next: Intake) => void;
  onSkip: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const [draft, setDraft] = useState<Intake>(intake);

  const handleSave = useCallback(() => onSave(draft), [draft, onSave]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.dots}>
          {(['welcome', 'why', 'questions'] as Step[]).map((key) => (
            <View key={key} style={[styles.dot, step === key && styles.dotActive]} />
          ))}
        </View>

        {step === 'welcome' ? (
          <Appear>
            <GlassCard style={styles.card} elevated>
              <Ionicons name="book-outline" size={26} color={theme.accent.spirit} />
              <Text style={styles.title}>One page a day.</Text>
              <Text style={styles.copy}>
                Write as little as you like — a single ticked box is a finished day. Nothing
                here is required, and nothing is scored.
              </Text>
            </GlassCard>
          </Appear>
        ) : null}

        {step === 'why' ? (
          <Appear>
            <GlassCard style={styles.card} elevated>
              <Ionicons name="lock-closed-outline" size={26} color={theme.accent.mind} />
              <Text style={styles.title}>Why we ask</Text>
              <Text style={styles.copy}>
                A few optional questions about your training, any injuries, and who to call if
                something goes wrong.
              </Text>

              <View style={styles.points}>
                <Point text="Kept on this phone, in its secure storage." />
                <Point text="Never uploaded, and never part of any sync." />
                <Point text="Every question is optional, and you can delete it all later." />
              </View>

              <Text style={styles.copy}>
                Skipping is a perfectly normal answer. You will not be asked again.
              </Text>
            </GlassCard>
          </Appear>
        ) : null}

        {step === 'questions' ? (
          <Appear>
            <GlassCard style={styles.card}>
              <Text style={styles.title}>A few questions</Text>
              <Text style={styles.copy}>Answer what you want. Leave the rest blank.</Text>
              <IntakeForm value={draft} onChange={setDraft} />
            </GlassCard>
          </Appear>
        ) : null}

        <View style={styles.actions}>
          {step === 'welcome' ? (
            <Button label="Next" icon="arrow-forward" onPress={() => setStep('why')} />
          ) : null}
          {step === 'why' ? (
            <Button
              label="Answer them"
              icon="arrow-forward"
              onPress={() => setStep('questions')}
            />
          ) : null}
          {step === 'questions' ? (
            <Button label="Save and start" icon="checkmark" onPress={handleSave} />
          ) : null}

          <Button
            label={step === 'welcome' ? 'Skip, take me to today' : 'Skip this'}
            variant="ghost"
            onPress={onSkip}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Point({ text }: { text: string }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.point}>
      <Ionicons name="checkmark-circle" size={15} color={theme.accent.body} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.surfaceElevated,
  },
  dotActive: {
    backgroundColor: theme.accent.spirit,
  },
  card: {
    gap: 12,
    borderRadius: radius.lg,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: theme.text,
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: theme.textMuted,
  },
  points: {
    gap: 9,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: theme.text,
  },
  actions: {
    gap: 10,
  },
});
