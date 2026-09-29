import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EventSummary } from '../../api/events';

import { Pill } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { ageLabel, formatRange, phaseLabel, phaseOf } from './eventCopy';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';
import type { AccentName } from '../../theme/tokens';

/**
 * One event on the list.
 *
 * Says when it is before it says anything else. A camp three weeks away and a
 * camp on its fourth day want completely different attention, and the phase is
 * the fastest way to tell them apart at a glance.
 */
/** A role, not a colour — a module constant cannot read the theme. */
const PHASE_ACCENT: Record<'upcoming' | 'running' | 'finished', AccentName | 'faint'> = {
  upcoming: 'mind',
  running: 'body',
  finished: 'faint',
};

export const EventCard = memo(function EventCard({
  summary,
  onOpen,
}: {
  summary: EventSummary;
  onOpen: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const { event, team, counts, days, role } = summary;
  const phase = phaseOf(event.startDate, event.endDate);
  const ages = ageLabel(event.ageMin, event.ageMax);

  return (
    <PressableScale haptic="light" onPress={onOpen} accessibilityLabel={`Open ${team.name}`}>
      <GlassCard style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {team.name}
          </Text>
          {role === 'coach' ? <Pill label="Staff" icon="clipboard-outline" accent="spirit" /> : null}
        </View>

        <Text
          style={[
            styles.phase,
            {
              color:
                PHASE_ACCENT[phase] === 'faint'
                  ? theme.textFaint
                  : theme.accent[PHASE_ACCENT[phase] as AccentName],
            },
          ]}
        >
          {phaseLabel(event.startDate, event.endDate)}
        </Text>

        <View style={styles.facts}>
          <Fact icon="calendar-outline" text={`${formatRange(event.startDate, event.endDate)} · ${days}d`} />
          <Fact
            icon="people-outline"
            text={`${counts.campers}/${event.capacity}`}
            warn={counts.campers >= event.capacity}
          />
          <Fact
            icon="clipboard-outline"
            text={`${counts.staff}/${event.staffTarget} staff`}
            warn={counts.staff < event.staffTarget}
          />
          {ages ? <Fact icon="person-outline" text={ages} /> : null}
        </View>
      </GlassCard>
    </PressableScale>
  );
});

const Fact = memo(function Fact({
  icon,
  text,
  warn = false,
}: {
  icon: 'calendar-outline' | 'people-outline' | 'clipboard-outline' | 'person-outline';
  text: string;
  warn?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const tint = warn ? theme.accent.warning : theme.textMuted;
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={12} color={tint} />
      <Text style={[styles.factText, { color: tint }]}>{text}</Text>
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: { gap: 8, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15.5, fontWeight: '800', color: theme.text },
  phase: { fontSize: 12, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factText: { fontSize: 11.5, fontWeight: '700' },
});
