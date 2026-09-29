import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { wodIsEmpty } from '../../state/journey/entries';
import { movementLabel } from '../../state/journey/movements';
import type { DayKey, JourneyState, Wod } from '../../state/journey/types';
import { radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { InfoTip } from './InfoTip';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * The workout, summarised on the day's page.
 *
 * Empty, it is a single quiet line inviting a tap — not an inline form. That
 * is the progressive-disclosure rule: the builder's dozen controls only exist
 * once someone has said they want them.
 */
type Props = {
  date: DayKey;
  wod: Wod | null;
  journey: JourneyState;
  onOpen: (date: DayKey) => void;
};

export const WodCard = memo(function WodCard({ date, wod, journey, onOpen }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const handleOpen = useCallback(() => onOpen(date), [date, onOpen]);
  const empty = wodIsEmpty(wod);

  const lines = wod?.lines ?? [];
  const filled = lines.filter((line) => line.movementId !== null || line.freeText.trim());

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>WORKOUT</Text>
        <InfoTip topic="wod" />
      </View>

      <PressableScale
        onPress={handleOpen}
        haptic="light"
        scaleTo={0.99}
        accessibilityLabel={
          empty ? 'Log a workout for this day' : 'Open the workout for this day'
        }
        style={styles.body}
      >
        {empty ? (
          <View style={styles.emptyRow}>
            <Ionicons name="add-circle-outline" size={19} color={theme.accent.mind} />
            <Text style={styles.emptyText}>Log a workout</Text>
          </View>
        ) : (
          <View style={styles.summary}>
            <View style={styles.metaRow}>
              {wod?.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {wod?.rounds ? (
                <Text style={styles.rounds}>
                  {wod.rounds} {wod.rounds === 1 ? 'round' : 'rounds'}
                </Text>
              ) : null}
            </View>

            {wod?.structure ? (
              <Text style={styles.structure} numberOfLines={1}>
                {wod.structure}
              </Text>
            ) : null}

            {filled.slice(0, 3).map((line) => (
              <Text key={line.id} style={styles.line} numberOfLines={1}>
                {line.reps !== null ? `${line.reps} × ` : ''}
                {movementLabel(journey, line.movementId, line.freeText)}
              </Text>
            ))}
            {filled.length > 3 ? (
              <Text style={styles.more}>+{filled.length - 3} more</Text>
            ) : null}

            {wod?.result ? (
              <Text style={styles.result} numberOfLines={1}>
                {wod.result}
              </Text>
            ) : null}
          </View>
        )}

        <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
      </PressableScale>
    </GlassCard>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.accent.mind,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  emptyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textMuted,
  },
  summary: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: theme.accentSoft.mind,
    alignItems: 'center',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.accent.mind,
  },
  rounds: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
  },
  structure: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  line: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  more: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
  },
  result: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.accent.body,
    marginTop: 2,
  },
});
