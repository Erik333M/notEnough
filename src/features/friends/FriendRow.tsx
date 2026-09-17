import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Friendship } from '../../api/friends';
import { accentColor, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { GlassCard } from '../../ui/Glass';
import { levelName } from './level';

/**
 * One person, as much of them as you are allowed to see.
 *
 * A name, a streak, a level. Somebody who has not opened the app since this
 * feature existed shows no figures at all rather than zeroes — a zero reads
 * as a judgement, and the truth is that they simply have not published.
 */
export const FriendRow = memo(function FriendRow({
  friendship,
  kind,
  busy = false,
  onAccept,
  onRemove,
}: {
  friendship: Friendship;
  kind: 'friend' | 'incoming' | 'outgoing';
  busy?: boolean;
  onAccept?: () => void;
  onRemove: () => void;
}) {
  const { profile } = friendship;
  const published = profile.updatedAt !== null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initialsOf(profile.name)}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          {published ? (
            <Text style={styles.meta}>
              Level {profile.level} · {levelName(profile.level)}
            </Text>
          ) : (
            <Text style={styles.quiet}>Nothing published yet</Text>
          )}
        </View>

        {published && kind === 'friend' ? (
          <View style={styles.streak}>
            <Ionicons name="flame" size={13} color={accentColor.amber} />
            <Text style={styles.streakText}>{profile.streak}</Text>
          </View>
        ) : null}
      </View>

      {kind === 'incoming' ? (
        <View style={styles.actions}>
          <Button label="Accept" icon="checkmark" loading={busy} onPress={onAccept} style={styles.grow} />
          <Button label="Decline" variant="ghost" onPress={onRemove} style={styles.grow} />
        </View>
      ) : null}

      {kind === 'outgoing' ? (
        <View style={styles.actions}>
          <Text style={styles.waiting}>Waiting for them to accept</Text>
          <Button label="Cancel" variant="ghost" onPress={onRemove} />
        </View>
      ) : null}
    </GlassCard>
  );
});

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violetSoft,
  },
  initials: { fontSize: 13.5, fontWeight: '800', color: palette.violet },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  meta: { fontSize: 12, fontWeight: '600', color: palette.textMuted },
  quiet: { fontSize: 12, fontWeight: '600', color: palette.textFaint },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 13, fontWeight: '800', color: accentColor.amber },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  waiting: { flex: 1, fontSize: 12, fontWeight: '600', color: palette.textMuted },
});
