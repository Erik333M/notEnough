import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Session } from '../../api/teams';
import { longDateLabel } from '../../lib/time';
import { accentColor, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

/**
 * A session in a list.
 *
 * The open-board state is shown here rather than only inside the session,
 * because whether teammates can see each other's results is the kind of thing
 * a coach wants to check at a glance across the whole list.
 */
export const SessionRow = memo(function SessionRow({
  session,
  onPress,
}: {
  session: Session;
  onPress: () => void;
}) {
  const count = session.taskCount ?? 0;

  return (
    <PressableScale haptic="light" onPress={onPress} accessibilityLabel={`Open ${session.name}`}>
      <GlassCard style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="calendar-outline" size={17} color={accentColor.violet} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {session.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {session.date ? longDateLabel(session.date) : 'Template'}
            {' · '}
            {count === 0 ? 'no tasks yet' : `${count} task${count === 1 ? '' : 's'}`}
          </Text>
        </View>

        {session.shareResults ? (
          <Ionicons
            name="eye-outline"
            size={15}
            color={accentColor.cyan}
            accessibilityLabel="Results are visible to the whole team"
          />
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
      </GlassCard>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violetSoft,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  meta: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
});
