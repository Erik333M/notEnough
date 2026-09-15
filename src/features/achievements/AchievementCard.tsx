import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { longDateLabel } from '../../lib/time';
import { accentColor, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';
import type { Achievement } from './derive';

/**
 * One achievement.
 *
 * The share affordance is present only when there is somewhere to share it —
 * a solo user gets the card without a button rather than a button that opens
 * an empty list. Already-shared cards say so instead of offering again.
 */
export const AchievementCard = memo(function AchievementCard({
  achievement,
  shared = false,
  onShare,
}: {
  achievement: Achievement;
  shared?: boolean;
  onShare?: () => void;
}) {
  const tint = accentColor[achievement.accent];

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[`${tint}22`, `${tint}00`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none', borderRadius: radius.lg }]}
      />

      <View style={[styles.icon, { backgroundColor: `${tint}26` }]}>
        <Ionicons name={achievement.icon} size={18} color={tint} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {achievement.title}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {achievement.detail}
        </Text>
        <Text style={styles.date}>{longDateLabel(achievement.achievedAt)}</Text>
      </View>

      {shared ? (
        <View style={styles.sharedTag}>
          <Ionicons name="checkmark" size={12} color={palette.textFaint} />
          <Text style={styles.sharedText}>Shared</Text>
        </View>
      ) : onShare ? (
        <PressableScale
          haptic="light"
          scaleTo={0.94}
          onPress={onShare}
          accessibilityLabel={`Share: ${achievement.title}`}
        >
          <View style={[styles.shareButton, { borderColor: `${tint}55` }]}>
            <Ionicons name="share-outline" size={14} color={tint} />
            <Text style={[styles.shareText, { color: tint }]}>Share</Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  detail: { fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: palette.textMuted },
  date: { fontSize: 11, fontWeight: '700', color: palette.textFaint },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  shareText: { fontSize: 12, fontWeight: '800' },
  sharedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sharedText: { fontSize: 11.5, fontWeight: '700', color: palette.textFaint },
});
