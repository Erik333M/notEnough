import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { gradients, palette, radius } from '../../theme/theme';

/**
 * How an athlete gets in.
 *
 * The code is set large and widely spaced because it is read aloud across a
 * gym as often as it is typed, and its alphabet already excludes the pairs
 * that get misheard — no O or 0, no I or 1.
 *
 * There is no "copy" button: clipboard access would be a new dependency for
 * something a coach usually says out loud or types into their own group chat.
 */
export const InviteCard = memo(function InviteCard({ code }: { code: string }) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradients.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none', opacity: 0.16 }]}
      />
      <View style={styles.head}>
        <Ionicons name="key-outline" size={15} color={palette.violet} />
        <Text style={styles.label}>INVITE CODE</Text>
      </View>

      <Text style={styles.code} accessibilityLabel={`Invite code ${code.split('').join(' ')}`}>
        {code}
      </Text>

      <Text style={styles.copy}>
        Athletes enter this once to join. They keep their own account and their own training —
        you only ever see the work you set them.
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 18,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: palette.textFaint },
  code: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 8,
    color: palette.text,
  },
  copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
});
