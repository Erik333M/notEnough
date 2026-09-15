import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Assignment } from '../../api/teams';
import { accentColor, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';
import { progressLabel, targetLabel } from './taskCopy';

/**
 * How one athlete is going in this session.
 *
 * Grouped by person rather than by task, because a coach reads a session one
 * athlete at a time — "did Bo do the work" — and a task-first grid makes that
 * the harder question of the two.
 *
 * Completion comes from the stored `done` flag rather than from comparing the
 * amount to the target. A coach can call short work finished, and recomputing
 * would quietly overrule them.
 */
export const AthleteProgressCard = memo(function AthleteProgressCard({
  name,
  isYou = false,
  assignments,
  onToggleDone,
}: {
  name: string;
  isYou?: boolean;
  assignments: Assignment[];
  /** Present only on your own rows — nobody logs for anyone else. */
  onToggleDone?: (assignment: Assignment) => void;
}) {
  const done = assignments.filter((row) => row.result?.done).length;
  const complete = done === assignments.length && assignments.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
          {isYou ? <Text style={styles.you}>  you</Text> : null}
        </Text>
        <View style={[styles.count, complete && styles.countDone]}>
          <Text style={[styles.countText, complete && styles.countTextDone]}>
            {done}/{assignments.length}
          </Text>
        </View>
      </View>

      <View style={styles.rows}>
        {assignments.map((row) => {
          const isDone = Boolean(row.result?.done);
          const amount = row.result?.amount ?? 0;
          const detail = row.result
            ? progressLabel(row.kind, amount, row.target)
            : targetLabel(row.kind, row.target);

          const line = (
            <View style={styles.row}>
              <Ionicons
                name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                size={17}
                color={isDone ? accentColor.lime : palette.textFaint}
              />
              <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={1}>
                {row.title}
              </Text>
              {detail ? <Text style={styles.detail}>{detail}</Text> : null}
            </View>
          );

          return onToggleDone ? (
            <PressableScale
              key={row.id}
              haptic="light"
              scaleTo={0.98}
              onPress={() => onToggleDone(row)}
              accessibilityLabel={`${isDone ? 'Undo' : 'Mark done'}: ${row.title}`}
            >
              {line}
            </PressableScale>
          ) : (
            <View key={row.id}>{line}</View>
          );
        })}
      </View>

      {onToggleDone ? <Text style={styles.hint}>Tap a task to mark it done.</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 14.5, fontWeight: '800', color: palette.text },
  you: { fontSize: 11, fontWeight: '700', color: palette.textFaint },
  count: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  countDone: { backgroundColor: palette.limeSoft },
  countText: { fontSize: 11.5, fontWeight: '800', color: palette.textMuted },
  countTextDone: { color: accentColor.lime },
  rows: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  title: { flex: 1, fontSize: 13, fontWeight: '600', color: palette.text },
  titleDone: { color: palette.textMuted },
  detail: { fontSize: 11.5, fontWeight: '800', color: accentColor.cyan },
  hint: { fontSize: 11, fontWeight: '600', color: palette.textFaint },
});
