import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Team, TeamRole } from '../../api/teams';
import { accentColor, palette, radius } from '../../theme/theme';
import { Pill } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

/**
 * One squad on the Teams tab.
 *
 * Split out of the list screen on length. The icon and the pill both say which
 * side of the roster you are on, because being a coach here and an athlete in
 * the next row down is an ordinary situation, not an edge case.
 */
export const TeamRow = memo(function TeamRow({
  team,
  role,
  onOpen,
}: {
  team: Team;
  role: TeamRole;
  onOpen: () => void;
}) {
  const coach = role === 'coach';

  return (
    <PressableScale haptic="light" onPress={onOpen} accessibilityLabel={`Open ${team.name}`}>
      <GlassCard style={styles.row}>
        <View style={styles.icon}>
          <Ionicons
            name={coach ? 'clipboard' : 'barbell'}
            size={18}
            color={coach ? accentColor.violet : accentColor.cyan}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {team.name}
          </Text>
          {team.notes ? (
            <Text style={styles.copy} numberOfLines={1}>
              {team.notes}
            </Text>
          ) : null}
        </View>
        <Pill label={coach ? 'Coach' : 'Athlete'} accent={coach ? 'violet' : 'cyan'} />
        <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
      </GlassCard>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  copy: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
});
