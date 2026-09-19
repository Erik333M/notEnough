import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ChatMessage } from '../api/chat';
import { ChatBubble } from '../features/events/ChatBubble';
import { formatDay } from '../features/events/eventCopy';
import { useChat } from '../features/events/useChat';
import { dayKey } from '../lib/time';
import { accentColor, palette, radius } from '../theme/theme';
import { RoundIconButton } from '../ui/Controls';
import { StackHeaderBar } from '../ui/StackHeaderBar';
import { useToast } from '../ui/Toast';

/**
 * The event's channel.
 *
 * Staff post and everybody at the event reads, so a camper gets the same
 * screen with the box replaced by a line saying why. Hiding the input without
 * explanation would read as a bug.
 *
 * Inverted list, newest at the bottom, which is how every messaging app works
 * and also how the scroll stays put when history is loaded above.
 */
export default function EventChatScreen({
  eventId,
  eventName,
  bottomInset,
  onBack,
}: {
  eventId: string;
  eventName: string;
  bottomInset: number;
  onBack: () => void;
}) {
  const chat = useChat(eventId);
  const { notify } = useToast();
  const [draft, setDraft] = useState('');
  const lastTyped = useRef(0);

  /**
   * Newest first for the inverted list, with the day stamps worked out in the
   * original order so "grouped" means "the one before it in time".
   */
  const rows = useMemo(() => {
    const out: ({ kind: 'day'; key: string; label: string } | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      grouped: boolean;
    })[] = [];

    let lastDay = '';
    let lastAuthor = '';
    let lastAt = 0;

    for (const message of chat.messages) {
      const day = message.createdAt.slice(0, 10);
      const at = Date.parse(message.createdAt);
      if (day !== lastDay) {
        out.push({ kind: 'day', key: `day-${day}`, label: labelFor(day) });
        lastDay = day;
        lastAuthor = '';
      }
      // Same person, within five minutes: one continuous turn of speech.
      const grouped = message.userId === lastAuthor && at - lastAt < 5 * 60 * 1000;
      out.push({ kind: 'message', key: message.id, message, grouped });
      lastAuthor = message.userId;
      lastAt = at;
    }

    return out.reverse();
  }, [chat.messages]);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const result = await chat.send(body);
    if (!result.ok) {
      // Give it back rather than losing what they typed.
      setDraft(body);
      if (result.message) notify(result.message, 'error');
    }
  }, [chat, draft, notify]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <StackHeaderBar
        title={eventName}
        meta={chat.typing ? `${chat.typing} is typing…` : chat.connected ? 'Live' : 'Connecting…'}
        onBack={onBack}
        backLabel="Back to the event"
        action={
          <View style={[styles.dot, chat.connected && styles.dotLive]} accessibilityLabel={
            chat.connected ? 'Connected' : 'Reconnecting'
          } />
        }
      />

      <FlatList
        data={rows}
        inverted
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        keyboardDismissMode="interactive"
        onEndReachedThreshold={0.4}
        onEndReached={() => void chat.loadOlder()}
        ListEmptyComponent={
          chat.loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={22} color={palette.textFaint} />
              <Text style={styles.emptyText}>
                Nothing posted yet. {chat.canPost ? 'Say something.' : 'Staff will post here.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <View style={styles.dayWrap}>
              <Text style={styles.day}>{item.label}</Text>
            </View>
          ) : (
            <ChatBubble
              message={item.message}
              mine={item.message.userId === chat.myId}
              grouped={item.grouped}
              canRemove={item.message.userId === chat.myId || chat.canPost}
              onRemove={() => void chat.remove(item.message.id)}
            />
          )
        }
      />

      {chat.canPost ? (
        <View style={[styles.bar, { paddingBottom: bottomInset || 10 }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={(next) => {
              setDraft(next);
              // At most one typing frame every two seconds — it is a hint, and
              // one per keystroke would be a flood for no extra information.
              const now = Date.now();
              if (now - lastTyped.current > 2000) {
                lastTyped.current = now;
                chat.notifyTyping();
              }
            }}
            placeholder="Message the camp"
            placeholderTextColor={palette.textFaint}
            multiline
            maxLength={2000}
            accessibilityLabel="Message"
          />
          <RoundIconButton
            icon="arrow-up"
            size={40}
            onPress={submit}
            accessibilityLabel="Send"
          />
        </View>
      ) : (
        <View style={[styles.readOnly, { paddingBottom: bottomInset || 12 }]}>
          <Ionicons name="lock-closed-outline" size={13} color={palette.textFaint} />
          <Text style={styles.readOnlyText}>Only the event staff post here.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function labelFor(day: string): string {
  const today = dayKey();
  if (day === today) return 'Today';
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dayKey(yesterday)) return 'Yesterday';
  return formatDay(day);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, flexGrow: 1 },
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  day: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.glass,
    fontSize: 10.5,
    fontWeight: '800',
    color: palette.textFaint,
    textTransform: 'uppercase',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 12.5, fontWeight: '600', color: palette.textMuted },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: palette.glass,
    fontSize: 14.5,
    fontWeight: '500',
    color: palette.text,
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  readOnlyText: { fontSize: 11.5, fontWeight: '600', color: palette.textFaint },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.textFaint },
  dotLive: { backgroundColor: accentColor.lime },
});
