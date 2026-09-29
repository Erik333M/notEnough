import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SessionTask } from '../../api/teams';
import { radius } from '../../theme/theme';
import { RoundIconButton } from '../../ui/Controls';
import { targetLabel } from './taskCopy';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * One task in a session, as the coach building it sees it.
 *
 * The delete affordance is present only while the coach is looking, and it
 * says what it costs: removing a task withdraws it from everyone it was given
 * to, along with anything they logged against it.
 */
export const TaskRow = memo(function TaskRow({
  task,
  index,
  onRemove,
}: {
  task: SessionTask;
  index: number;
  onRemove?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const target = targetLabel(task.kind, task.target);

  return (
    <View style={styles.row}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{index + 1}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        {task.detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {task.detail}
          </Text>
        ) : null}
        {target ? <Text style={styles.target}>{target}</Text> : null}
      </View>

      {onRemove ? (
        <RoundIconButton
          icon="trash-outline"
          size={34}
          onPress={onRemove}
          accessibilityLabel={`Remove ${task.title}`}
        />
      ) : (
        <Ionicons name="ellipse-outline" size={15} color={theme.textFaint} />
      )}
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
  },
  number: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentSoft.spirit,
  },
  numberText: { fontSize: 11.5, fontWeight: '800', color: theme.accent.spirit },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: theme.text },
  detail: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  target: { fontSize: 11.5, fontWeight: '800', color: theme.accent.mind },
});
