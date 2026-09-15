import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { accentColor, palette } from '../../theme/theme';
import { Toggle } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';

/**
 * Whether the squad can see each other's results for this one session.
 *
 * Per session rather than per team or per result: "everyone can see Tuesday's
 * conditioning" and "1RM testing stays private" are both reasonable, only the
 * coach knows which is which, and asking them about every individual result
 * would be twenty decisions where one will do.
 *
 * The copy states the limits plainly, because a sharing switch that overstates
 * its reach is how people get surprised by what they exposed.
 */
export const ShareResultsCard = memo(function ShareResultsCard({
  shared,
  onChange,
}: {
  shared: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="eye-outline" size={16} color={accentColor.cyan} />
        <Text style={styles.title}>Let the squad see each other</Text>
      </View>

      <Text style={styles.copy}>
        Off by default. Turning this on lets everyone in the team see the results for this session
        only — no other session, and nothing else anyone tracks.
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>
          {shared ? 'Visible to the team' : 'Private to each athlete'}
        </Text>
        <Toggle value={shared} onChange={onChange} accent="cyan" />
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1, fontSize: 13, fontWeight: '700', color: palette.text },
});
