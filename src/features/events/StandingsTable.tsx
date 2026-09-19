import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Leaderboard, StandingsRow } from '../../api/event-stats';
import { accentColor, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';

/**
 * The table, and who leads each thing being counted.
 *
 * Three points for a win and one for a draw, sorted on points then
 * difference then scored — the arrangement people will assume without being
 * told, which is the point of not inventing one.
 *
 * The table scrolls sideways inside itself. A phone is narrower than eight
 * columns and squeezing them in makes every one of them unreadable.
 */
export const StandingsTable = memo(function StandingsTable({
  standings,
  leaders,
  scoreLabel,
}: {
  standings: StandingsRow[];
  leaders: Leaderboard[];
  scoreLabel: string;
}) {
  const anyPlayed = standings.some((row) => row.played > 0);

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.row, styles.head]}>
              <Text style={[styles.cell, styles.name, styles.headText]}>Squad</Text>
              <Head label="P" />
              <Head label="W" />
              <Head label="D" />
              <Head label="L" />
              <Head label="F" />
              <Head label="A" />
              <Head label="+/-" wide />
              <Head label="Pts" wide />
            </View>

            {standings.map((row, index) => (
              <View key={row.teamId} style={styles.row}>
                <Text style={[styles.cell, styles.name]} numberOfLines={1}>
                  {index + 1}. {row.name}
                </Text>
                <Cell value={row.played} />
                <Cell value={row.won} />
                <Cell value={row.drawn} />
                <Cell value={row.lost} />
                <Cell value={row.for} />
                <Cell value={row.against} />
                <Cell value={row.difference} wide signed />
                <Cell value={row.points} wide strong />
              </View>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.footnote}>
          {anyPlayed
            ? `Three for a win, one for a draw. F and A count ${scoreLabel.toLowerCase()}.`
            : 'Nothing played yet. Record a result and the table fills itself in.'}
        </Text>
      </GlassCard>

      {leaders
        .filter((board) => board.rows.length > 0)
        .map((board) => (
          <GlassCard key={board.field.id} style={styles.card}>
            <Text style={styles.boardTitle}>{board.field.label}</Text>
            {board.rows.map((row, index) => (
              <View key={row.userId} style={styles.boardRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.boardName} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.boardValue}>{row.value}</Text>
              </View>
            ))}
          </GlassCard>
        ))}
    </View>
  );
});

const Head = memo(function Head({ label, wide = false }: { label: string; wide?: boolean }) {
  return <Text style={[styles.cell, wide && styles.wide, styles.headText]}>{label}</Text>;
});

const Cell = memo(function Cell({
  value,
  wide = false,
  strong = false,
  signed = false,
}: {
  value: number;
  wide?: boolean;
  strong?: boolean;
  signed?: boolean;
}) {
  return (
    <Text style={[styles.cell, wide && styles.wide, strong && styles.strong]}>
      {signed && value > 0 ? `+${value}` : value}
    </Text>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: { gap: 8, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  head: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  cell: {
    width: 30,
    paddingVertical: 5,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.textMuted,
  },
  wide: { width: 38 },
  name: { width: 120, textAlign: 'left', color: palette.text, fontWeight: '800' },
  headText: { fontSize: 10.5, fontWeight: '800', color: palette.textFaint, textTransform: 'uppercase' },
  strong: { color: accentColor.lime, fontWeight: '800' },
  footnote: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: palette.textFaint },
  boardTitle: { fontSize: 13, fontWeight: '800', color: palette.text },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.violetSoft,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 10.5,
    fontWeight: '800',
    color: palette.violet,
  },
  boardName: { flex: 1, fontSize: 13, fontWeight: '700', color: palette.text },
  boardValue: { fontSize: 14, fontWeight: '800', color: accentColor.lime },
});
