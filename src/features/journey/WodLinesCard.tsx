import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { JourneyState, WodLine } from '../../state/journey/types';
import { movementLabel } from '../../state/journey/movements';
import { radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { GlassCard } from '../../ui/Glass';
import { WodLineRow } from './WodLineRow';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * The list of movement lines.
 *
 * Empty, it says what the lines are for and points out they can be skipped
 * entirely — the result box alone is a complete record of a workout, and a
 * beginner should not think the app needs a full breakdown before it will
 * accept that they trained.
 */
type Props = {
  journey: JourneyState;
  lines: WodLine[];
  onAdd: () => void;
  onPickMovement: (id: string) => void;
  onChange: (id: string, patch: Partial<WodLine>) => void;
  onRemove: (id: string) => void;
};

export const WodLinesCard = memo(function WodLinesCard({
  journey,
  lines,
  onAdd,
  onPickMovement,
  onChange,
  onRemove,
}: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.label}>MOVEMENTS</Text>

      {lines.length === 0 ? (
        <Text style={styles.hint}>
          Add a line for each exercise, or skip this and just write the result below.
        </Text>
      ) : (
        <View style={styles.lines}>
          {lines.map((line) => (
            <WodLineRow
              key={line.id}
              line={line}
              label={movementLabel(journey, line.movementId, line.freeText)}
              units={journey.units}
              onPickMovement={onPickMovement}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </View>
      )}

      <Button label="Add a line" icon="add" variant="glass" onPress={onAdd} />
    </GlassCard>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    gap: 10,
    borderRadius: radius.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.textMuted,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: theme.textFaint,
  },
  lines: {
    gap: 8,
  },
});
