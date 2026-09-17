import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FriendCodeCard } from '../features/friends/FriendCodeCard';
import { FriendRow } from '../features/friends/FriendRow';
import { useFriends } from '../features/friends/useFriends';
import { levelName } from '../features/friends/level';
import { useAuth } from '../state/AuthContext';
import { palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, SectionHeader } from '../ui/Controls';
import { EmptyState, SkeletonCard } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

/**
 * Friends: your code, the requests either way, and the people you train
 * alongside.
 *
 * The card at the top says plainly what a friend can see, because this is the
 * screen where somebody decides to let another person see anything at all.
 * Three numbers and a name is a small thing to share, but it is still the
 * first time this app sends any figure of yours to another person, and
 * burying that would be the wrong call.
 */
export default function FriendsScreen({
  bottomInset,
  pendingCode,
  onCodeUsed,
}: {
  bottomInset: number;
  /** Arrives from a shared link — see the deep link handler in the shell. */
  pendingCode?: string;
  onCodeUsed?: () => void;
}) {
  const { user } = useAuth();
  const { notify } = useToast();
  const friends = useFriends();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // A link fills the box rather than acting on its own: adding somebody
  // because a URL was tapped would be a decision made by whoever sent it.
  useEffect(() => {
    if (!pendingCode) return;
    setCode(pendingCode);
    onCodeUsed?.();
  }, [onCodeUsed, pendingCode]);

  const add = useCallback(async () => {
    setBusy(true);
    const result = await friends.requestByCode(code);
    setBusy(false);
    if (result.ok) {
      setCode('');
      notify('Request sent.', 'success');
    } else {
      notify(result.message, 'error');
    }
  }, [code, friends, notify]);

  const figures = friends.figures;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await friends.reload();
              setRefreshing(false);
            }}
            tintColor={palette.textMuted}
          />
        }
      >
        <Appear>
          <FriendCodeCard code={friends.code} name={user?.name ?? 'Someone'} />
        </Appear>

        <Appear delay={50}>
          <GlassCard style={styles.shared}>
            <Text style={styles.sharedTitle}>What a friend sees</Text>
            <Text style={styles.sharedCopy}>
              Your name, your streak, and your level
              {figures ? ` — right now that is ${figures.streak} days and level ${figures.level}, ${levelName(figures.level).toLowerCase()}` : ''}
              . Nothing else: not your journal, your goals, your measurements, or anything your
              coach sets you.
            </Text>
          </GlassCard>
        </Appear>

        <Appear delay={100}>
          <SectionHeader title="Add someone" meta="With the code they gave you" />
          <GlassCard style={styles.add}>
            <Field
              label="Their code"
              value={code}
              onChangeText={setCode}
              placeholder="e.g. 7KDP2M"
              icon="key-outline"
              autoCapitalize="characters"
              returnKeyType="go"
              onSubmitEditing={add}
            />
            <Button
              label="Send request"
              icon="person-add-outline"
              loading={busy}
              disabled={code.trim().length < 6}
              onPress={add}
            />
            <Text style={styles.hint}>
              You can also add people straight from a team roster you share.
            </Text>
          </GlassCard>
        </Appear>

        {friends.loading ? <SkeletonCard /> : null}

        {friends.incoming.length > 0 ? (
          <Appear delay={140}>
            <SectionHeader title="Wants to add you" meta={`${friends.incoming.length} waiting`} />
            <View style={styles.list}>
              {friends.incoming.map((row) => (
                <FriendRow
                  key={row.id}
                  friendship={row}
                  kind="incoming"
                  onAccept={() => void friends.accept(row.id)}
                  onRemove={() => void friends.remove(row.id)}
                />
              ))}
            </View>
          </Appear>
        ) : null}

        <Appear delay={180}>
          <SectionHeader
            title="Friends"
            meta={friends.friends.length === 0 ? 'Nobody yet' : `${friends.friends.length} in total`}
          />
          {friends.friends.length === 0 && !friends.loading ? (
            <GlassCard style={styles.emptyCard}>
              <EmptyState
                icon="people-circle-outline"
                title="No friends yet"
                copy="Share your code, or add someone from a team you are both in. Nothing of yours is shared until you do."
              />
            </GlassCard>
          ) : (
            <View style={styles.list}>
              {friends.friends.map((row) => (
                <FriendRow
                  key={row.id}
                  friendship={row}
                  kind="friend"
                  onRemove={() => void friends.remove(row.id)}
                />
              ))}
            </View>
          )}
        </Appear>

        {friends.outgoing.length > 0 ? (
          <Appear delay={220}>
            <SectionHeader title="Waiting on them" meta={`${friends.outgoing.length} sent`} />
            <View style={styles.list}>
              {friends.outgoing.map((row) => (
                <FriendRow
                  key={row.id}
                  friendship={row}
                  kind="outgoing"
                  onRemove={() => void friends.remove(row.id)}
                />
              ))}
            </View>
          </Appear>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, gap: 16 },
  shared: { gap: 6 },
  sharedTitle: { fontSize: 14, fontWeight: '800', color: palette.text },
  sharedCopy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  add: { gap: 12 },
  hint: { fontSize: 11.5, fontWeight: '600', color: palette.textFaint },
  list: { gap: 10 },
  emptyCard: { paddingVertical: 8, borderRadius: radius.lg },
});
