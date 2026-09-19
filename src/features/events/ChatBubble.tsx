import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '../../api/chat';
import { palette, radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { PressableScale } from '../../ui/Touchable';

/**
 * One message.
 *
 * Yours on the right in the accent colour, everybody else's on the left with
 * their face — the arrangement every messaging app has settled on, and not
 * worth being original about: people read a channel by shape before they read
 * a word of it.
 *
 * `grouped` is set when the message above is from the same person within a few
 * minutes. It drops the name and the avatar and tightens the gap, which is
 * what turns four separate cards into one person talking.
 */
export const ChatBubble = memo(function ChatBubble({
  message,
  mine,
  grouped,
  canRemove,
  onRemove,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, grouped && styles.tight]}>
      {!mine ? (
        <View style={styles.gutter}>
          {grouped ? null : <Avatar name={message.name} uri={message.avatarUrl} size={28} />}
        </View>
      ) : null}

      <PressableScale
        haptic="light"
        onPress={canRemove ? onRemove : undefined}
        accessibilityLabel={canRemove ? `Message from ${message.name}. Tap to delete.` : undefined}
      >
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          {!mine && !grouped ? <Text style={styles.name}>{message.name}</Text> : null}
          <Text style={[styles.body, mine && styles.bodyMine]}>{message.body}</Text>
          <Text style={[styles.time, mine && styles.timeMine]}>{clockOf(message.createdAt)}</Text>
        </View>
      </PressableScale>
    </View>
  );
});

/** Local 24-hour time. A channel is read on the day it is written. */
function clockOf(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  tight: { marginTop: 3 },
  rowMine: { justifyContent: 'flex-end', paddingLeft: 48 },
  rowTheirs: { justifyContent: 'flex-start', paddingRight: 48 },
  gutter: { width: 28 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg, gap: 2 },
  theirs: { backgroundColor: palette.glassStrong, borderBottomLeftRadius: 4 },
  mine: { backgroundColor: palette.violet, borderBottomRightRadius: 4 },
  name: { fontSize: 11.5, fontWeight: '800', color: palette.violet },
  body: { fontSize: 14.5, lineHeight: 20, fontWeight: '500', color: palette.text },
  bodyMine: { color: palette.onAccent },
  time: { alignSelf: 'flex-end', fontSize: 9.5, fontWeight: '700', color: palette.textFaint },
  timeMine: { color: 'rgba(255,255,255,0.72)' },
});
