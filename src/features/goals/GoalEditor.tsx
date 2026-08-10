import { Ionicons } from '@expo/vector-icons';
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

import { clockLabel } from '../../lib/time';
import { GOAL_ICONS } from '../../state/defaults';
import type { GoalDraft } from '../../state/DataContext';
import { GOAL_UNIT, type Goal, type GoalKind, type IconName } from '../../state/types';
import { accentColor, palette, radius, type AccentName } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader, Segmented, Toggle } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

const KINDS: { value: GoalKind; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'reps', label: 'Reps' },
  { value: 'distance', label: 'Distance' },
  { value: 'check', label: 'Check' },
];

const ACCENTS: AccentName[] = ['violet', 'cyan', 'lime', 'amber', 'rose'];

const TARGET_STEP: Record<GoalKind, number> = {
  minutes: 5,
  reps: 5,
  distance: 250,
  check: 1,
};

const DEFAULT_TARGET: Record<GoalKind, number> = {
  minutes: 20,
  reps: 40,
  distance: 3000,
  check: 1,
};

type Props = {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSave: (draft: GoalDraft) => void;
  onDelete?: (id: string) => void;
};

export function GoalEditor({ visible, goal, onClose, onSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [kind, setKind] = useState<GoalKind>('minutes');
  const [target, setTarget] = useState(20);
  const [accent, setAccent] = useState<AccentName>('violet');
  const [icon, setIcon] = useState<IconName>('flame');
  const [remind, setRemind] = useState(true);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the sheet opens so a cancelled edit never leaks
  // into the next one.
  useEffect(() => {
    if (!visible) return;
    setTitle(goal?.title ?? '');
    setDetail(goal?.detail ?? '');
    setKind(goal?.kind ?? 'minutes');
    setTarget(goal?.target ?? DEFAULT_TARGET.minutes);
    setAccent(goal?.accent ?? 'violet');
    setIcon(goal?.icon ?? 'flame');
    setRemind(goal?.reminder.enabled ?? true);
    setHour(goal?.reminder.hour ?? 18);
    setMinute(goal?.reminder.minute ?? 0);
    setError(null);
  }, [visible, goal]);

  const handleKind = useCallback((next: GoalKind) => {
    setKind(next);
    setTarget(DEFAULT_TARGET[next]);
  }, []);

  const targetLabel = useMemo(() => {
    if (kind === 'check') return 'Done once a day';
    if (kind === 'distance') return `${(target / 1000).toFixed(2)} km`;
    return `${target} ${GOAL_UNIT[kind]}`;
  }, [kind, target]);

  const handleSave = useCallback(() => {
    const clean = title.trim();
    if (clean.length < 2) {
      setError('Give the goal a name.');
      return;
    }
    onSave({
      title: clean,
      detail: detail.trim() || 'Daily target',
      kind,
      target: kind === 'check' ? 1 : Math.max(1, target),
      accent,
      icon,
      reminder: { enabled: remind, hour, minute },
    });
    onClose();
  }, [accent, detail, hour, icon, kind, minute, onClose, onSave, remind, target, title]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
            >
              <SectionHeader
                title={goal ? 'Edit goal' : 'New daily goal'}
                meta={goal ? 'Changes apply from today' : 'It starts counting today'}
                action={<RoundIconButton icon="close" size={34} onPress={onClose} />}
              />

              <Field
                label="Name"
                value={title}
                onChangeText={(v) => {
                  setTitle(v);
                  if (error) setError(null);
                }}
                placeholder="Easy run"
                icon="create-outline"
                error={error}
                autoCapitalize="sentences"
              />

              <Field
                label="Note"
                value={detail}
                onChangeText={setDetail}
                placeholder="Zone 2 pace, nose breathing"
                icon="document-text-outline"
                autoCapitalize="sentences"
              />

              <View style={styles.group}>
                <Text style={styles.groupLabel}>Measured in</Text>
                <Segmented options={KINDS} value={kind} onChange={handleKind} />
              </View>

              {kind === 'check' ? null : (
                <View style={styles.targetRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupLabel}>Daily target</Text>
                    <Text style={styles.targetValue}>{targetLabel}</Text>
                  </View>
                  <View style={styles.targetControls}>
                    <RoundIconButton
                      icon="remove"
                      size={38}
                      disabled={target <= TARGET_STEP[kind]}
                      onPress={() => setTarget((t) => Math.max(TARGET_STEP[kind], t - TARGET_STEP[kind]))}
                    />
                    <RoundIconButton
                      icon="add"
                      size={38}
                      onPress={() => setTarget((t) => t + TARGET_STEP[kind])}
                    />
                  </View>
                </View>
              )}

              <View style={styles.group}>
                <Text style={styles.groupLabel}>Colour</Text>
                <View style={styles.accentRow}>
                  {ACCENTS.map((name) => (
                    <PressableScale
                      key={name}
                      haptic="selection"
                      scaleTo={0.88}
                      onPress={() => setAccent(name)}
                    >
                      <View
                        style={[
                          styles.accentDot,
                          { backgroundColor: accentColor[name] },
                          accent === name && styles.accentDotActive,
                        ]}
                      />
                    </PressableScale>
                  ))}
                </View>
              </View>

              <View style={styles.group}>
                <Text style={styles.groupLabel}>Icon</Text>
                <View style={styles.iconRow}>
                  {GOAL_ICONS.map((name) => (
                    <PressableScale
                      key={name}
                      haptic="selection"
                      scaleTo={0.9}
                      onPress={() => setIcon(name as IconName)}
                    >
                      <View style={[styles.iconTile, icon === name && styles.iconTileActive]}>
                        <Ionicons
                          name={name as IconName}
                          size={18}
                          color={icon === name ? palette.text : palette.textFaint}
                        />
                      </View>
                    </PressableScale>
                  ))}
                </View>
              </View>

              <GlassCard tone="sunken" sheen={false} style={styles.reminderCard}>
                <View style={styles.reminderTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle}>Daily reminder</Text>
                    <Text style={styles.reminderCopy}>
                      A local notification at the same time every day.
                    </Text>
                  </View>
                  <Toggle value={remind} onChange={setRemind} accent={accent} />
                </View>

                {remind ? (
                  <View style={styles.timeRow}>
                    <TimeUnit
                      label="Hour"
                      value={hour}
                      onChange={(v) => setHour((v + 24) % 24)}
                    />
                    <Text style={styles.timeColon}>:</Text>
                    <TimeUnit
                      label="Minute"
                      value={minute}
                      step={5}
                      onChange={(v) => setMinute((v + 60) % 60)}
                    />
                    <View style={{ flex: 1 }} />
                    <Text style={styles.timePreview}>{clockLabel(hour, minute)}</Text>
                  </View>
                ) : null}
              </GlassCard>

              <Button label={goal ? 'Save changes' : 'Create goal'} icon="checkmark" onPress={handleSave} />

              {goal && onDelete ? (
                <Button
                  label="Delete goal"
                  icon="trash-outline"
                  variant="danger"
                  onPress={() => {
                    onDelete(goal.id);
                    onClose();
                  }}
                />
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function TimeUnit({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
}) {
  return (
    <View style={styles.timeUnit}>
      <Text style={styles.timeUnitLabel}>{label}</Text>
      <View style={styles.timeUnitControls}>
        <RoundIconButton icon="chevron-down" size={30} onPress={() => onChange(value - step)} />
        <Text style={styles.timeUnitValue}>{`${value}`.padStart(2, '0')}</Text>
        <RoundIconButton icon="chevron-up" size={30} onPress={() => onChange(value + step)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,3,10,0.72)',
  },
  sheetWrap: {
    maxHeight: '92%',
  },
  sheet: {
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
    marginBottom: 12,
  },
  sheetContent: {
    gap: 16,
    paddingBottom: 12,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
    marginLeft: 2,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  targetValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginTop: 4,
  },
  targetControls: {
    flexDirection: 'row',
    gap: 10,
  },
  accentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  accentDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accentDotActive: {
    borderColor: '#FFFFFF',
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  iconTileActive: {
    backgroundColor: palette.glassStrong,
    borderColor: palette.violet,
  },
  reminderCard: {
    gap: 14,
  },
  reminderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
  reminderCopy: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  timeColon: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.textFaint,
    marginBottom: 8,
  },
  timeUnit: {
    gap: 6,
  },
  timeUnitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
    textAlign: 'center',
  },
  timeUnitControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeUnitValue: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  timePreview: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.violet,
    fontVariant: ['tabular-nums'],
  },
});
