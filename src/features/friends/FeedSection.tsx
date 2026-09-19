import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FeedPost } from '../../api/friends';
import type { IconName } from '../../state/types';
import { accentColor, palette, radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { RoundIconButton, SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { useFeed } from './useFeed';

/**
 * What the people you train alongside have been doing.
 *
 * Under today rather than above it. Home is first a place to log your own day
 * and only second a place to read about everybody else's — a feed at the top
 * would make opening the app an act of comparison, which is the opposite of
 * what the rest of this app is for.
 *
 * Every post is a snapshot somebody chose to publish. There is no way from
 * here into anybody's training, because the server has no route that would
 * answer such a question.
 */
const KIND_ICON: Record<FeedPost['kind'], IconName> = {
  streak: 'flame',
  personalBest: 'trophy',
  habit: 'leaf',
  work: 'barbell',
};

const KIND_ACCENT: Record<FeedPost['kind'], string> = {
  streak: accentColor.amber,
  personalBest: accentColor.lime,
  habit: accentColor.cyan,
  work: accentColor.violet,
};

export const FeedSection = memo(function FeedSection({
  onOpenFriends,
}: {
  onOpenFriends: () => void;
}) {
  const { feed, friendCount, loading, myId, remove } = useFeed();

  // Nothing at all to say yet, and no friends to say it to: stay out of the way.
  if (loading || (feed.length === 0 && friendCount === 0)) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="Friends"
        meta={friendCount > 0 ? `${friendCount} ${friendCount === 1 ? 'person' : 'people'}` : undefined}
      />

      {feed.length === 0 ? (
        <PressableScale haptic="light" onPress={onOpenFriends}>
          <GlassCard style={styles.quiet}>
            <Ionicons name="people-outline" size={16} color={palette.textFaint} />
            <Text style={styles.quietText}>
              Nothing shared yet. Anything you earn can be posted here from your achievements.
            </Text>
          </GlassCard>
        </PressableScale>
      ) : (
        feed.map((post) => (
          <GlassCard key={post.id} style={styles.post}>
            <View style={styles.head}>
              <Avatar name={post.authorName} uri={post.avatarUrl} size={32} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>
                  {post.userId === myId ? 'You' : post.authorName}
                </Text>
                <Text style={styles.when}>{agoOf(post.createdAt)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${KIND_ACCENT[post.kind]}22` }]}>
                <Ionicons name={KIND_ICON[post.kind]} size={13} color={KIND_ACCENT[post.kind]} />
              </View>
              {post.userId === myId ? (
                <RoundIconButton
                  icon="close"
                  size={28}
                  onPress={() => void remove(post.id)}
                  accessibilityLabel="Take this post down"
                />
              ) : null}
            </View>

            <Text style={styles.title}>{post.title}</Text>
            {post.detail ? <Text style={styles.detail}>{post.detail}</Text> : null}
            {post.note ? <Text style={styles.note}>“{post.note}”</Text> : null}
          </GlassCard>
        ))
      )}
    </View>
  );
});

/** Rough, and deliberately so: nobody needs a feed timed to the minute. */
function agoOf(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  quietText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  post: { gap: 6, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, gap: 1 },
  name: { fontSize: 13.5, fontWeight: '800', color: palette.text },
  when: { fontSize: 10.5, fontWeight: '600', color: palette.textFaint },
  badge: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  detail: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  note: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textFaint, fontStyle: 'italic' },
});
