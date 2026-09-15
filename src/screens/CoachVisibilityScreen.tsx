import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CANNOT_SEE,
  CAN_SEE,
  VISIBILITY_NOTES,
  type VisibilityLine,
} from '../features/teams/visibilityCopy';
import { accentColor, palette, radius } from '../theme/theme';
import { Appear } from '../ui/Controls';
import { GlassCard } from '../ui/Glass';
import { StackHeaderBar } from '../ui/StackHeaderBar';

/**
 * What your coach can see — the whole answer, on one screen.
 *
 * The privacy policy covers this properly, but nobody joining a squad in a gym
 * is going to read a policy. The two lists are deliberately side by side and
 * the second is longer, because the reassuring half is the part people
 * actually want and the part a policy buries.
 *
 * Reachable from the team itself rather than from Settings: the question comes
 * up while looking at the team, not while looking for it.
 */
export default function CoachVisibilityScreen({
  teamName,
  bottomInset,
  onBack,
}: {
  teamName: string;
  bottomInset: number;
  onBack: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
    >
      <StackHeaderBar
        title="What your coach sees"
        meta={teamName}
        onBack={onBack}
        backLabel="Back to the team"
      />

      <Appear>
        <GlassCard style={styles.card}>
          <View style={styles.head}>
            <Ionicons name="eye-outline" size={17} color={accentColor.violet} />
            <Text style={styles.title}>They can see</Text>
          </View>
          <View style={styles.lines}>
            {CAN_SEE.map((line) => (
              <Line key={line.text} line={line} tint={accentColor.violet} />
            ))}
          </View>
          <Text style={styles.footnote}>
            All of it comes from work they set you. Nothing else reaches them.
          </Text>
        </GlassCard>
      </Appear>

      <Appear delay={70}>
        <GlassCard style={styles.card}>
          <View style={styles.head}>
            <Ionicons name="lock-closed-outline" size={17} color={accentColor.lime} />
            <Text style={styles.title}>They can never see</Text>
          </View>
          <View style={styles.lines}>
            {CANNOT_SEE.map((line) => (
              <Line key={line.text} line={line} tint={accentColor.lime} />
            ))}
          </View>
        </GlassCard>
      </Appear>

      {VISIBILITY_NOTES.map((note, index) => (
        <Appear key={note.title} delay={140 + index * 50}>
          <GlassCard style={styles.note}>
            <Text style={styles.noteTitle}>{note.title}</Text>
            <Text style={styles.noteBody}>{note.body}</Text>
          </GlassCard>
        </Appear>
      ))}
    </ScrollView>
  );
}

const Line = memo(function Line({ line, tint }: { line: VisibilityLine; tint: string }) {
  return (
    <View style={styles.line}>
      <View style={[styles.lineIcon, { backgroundColor: `${tint}1F` }]}>
        <Ionicons name={line.icon} size={13} color={tint} />
      </View>
      <Text style={styles.lineText}>{line.text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15.5, fontWeight: '800', color: palette.text },
  lines: { gap: 10 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lineIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: palette.text },
  footnote: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: palette.textMuted },
  note: { gap: 6 },
  noteTitle: { fontSize: 13.5, fontWeight: '800', color: palette.text },
  noteBody: { fontSize: 12.5, lineHeight: 18.5, fontWeight: '600', color: palette.textMuted },
});
