import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Assignment } from '../../api/teams';
import { longDateLabel } from '../../lib/time';
import { accentColor, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { progressLabel, targetLabel } from './taskCopy';

/**
 * What your coach has set you, on Today.
 *
 * This is the whole point of the athlete's side. Work you have been given is
 * work for today, so it belongs beside your own goals rather than three taps
 * away behind a team and a session — an athlete should never have to go
 * looking to find out what was asked of them.
 *
 * Overdue comes first and is marked, because it is the part that needs a
 * decision. Nothing here nags: a missed day is stated once, not counted up.
 */
export const AssignedWorkCard = memo(function AssignedWorkCard({
  overdue,
  today,
  onOpen,
}: {
  overdue: Assignment[];
  today: Assignment[];
  onOpen: (assignment: Assignment) => void;
}) {
  if (overdue.length === 0 && today.length === 0) return null;

  const remaining = [...overdue, ...today].filter((row) => !row.result?.done).length;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="clipboard-outline" size={15} color={accentColor.violet} />
        </View>
        <View style={styles.headBody}>
          <Text style={styles.title}>From your coach</Text>
          <Text style={styles.meta}>
            {remaining === 0
              ? 'All done — nice work.'
              : `${remaining} left${overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}`}
          </Text>
        </View>
      </View>

      <View style={styles.rows}>
        {overdue.map((row) => (
          <WorkRow key={row.id} assignment={row} overdue onPress={() => onOpen(row)} />
        ))}
        {today.map((row) => (
          <WorkRow key={row.id} assignment={row} onPress={() => onOpen(row)} />
        ))}
      </View>
    </GlassCard>
  );
});

const WorkRow = memo(function WorkRow({
  assignment,
  overdue = false,
  onPress,
}: {
  assignment: Assignment;
  overdue?: boolean;
  onPress: () => void;
}) {
  const done = Boolean(assignment.result?.done);
  const detail = assignment.result
    ? progressLabel(assignment.kind, assignment.result.amount, assignment.target)
    : targetLabel(assignment.kind, assignment.target);

  return (
    <PressableScale
      haptic="light"
      scaleTo={0.98}
      onPress={onPress}
      accessibilityLabel={`Log ${assignment.title}`}
    >
      <View style={styles.row}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={19}
          color={done ? accentColor.lime : palette.textFaint}
        />
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, done && styles.rowTitleDone]} numberOfLines={1}>
            {assignment.title}
          </Text>
          {overdue && !done ? (
            <Text style={styles.overdue}>Was due {longDateLabel(assignment.dueDate)}</Text>
          ) : null}
        </View>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        <Ionicons name="chevron-forward" size={15} color={palette.textFaint} />
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violetSoft,
  },
  headBody: { flex: 1, gap: 1 },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  meta: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
  rows: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: palette.text },
  rowTitleDone: { color: palette.textMuted },
  overdue: { fontSize: 11, fontWeight: '700', color: palette.amber },
  detail: { fontSize: 11.5, fontWeight: '800', color: accentColor.cyan },
});
