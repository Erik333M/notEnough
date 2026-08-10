import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { SyncStatus } from '../state/sync';
import { accentColor, palette, radius, type AccentName } from '../theme/theme';
import { PressableScale } from '../ui/Touchable';

export const Header = memo(function Header({
  title,
  subtitle,
  streak,
  syncStatus,
  onMenu,
  onSync,
}: {
  title: string;
  subtitle: string;
  streak: number;
  syncStatus: SyncStatus;
  onMenu: () => void;
  onSync: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={onMenu}
        haptic="light"
        scaleTo={0.9}
        style={styles.menuButton}
        accessibilityLabel="Open menu"
      >
        <Ionicons name="menu" size={20} color={palette.text} />
      </PressableScale>

      <Animated.View key={title} entering={FadeIn.duration(200)} style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </Animated.View>

      <SyncBadge status={syncStatus} onPress={onSync} />

      <View style={styles.streak}>
        <Ionicons name="flame" size={14} color={palette.amber} />
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    </View>
  );
});

const SYNC_META: Record<SyncStatus, { icon: 'cloud-done' | 'cloud-offline' | 'sync' | 'warning'; accent: AccentName; label: string }> = {
  idle: { icon: 'sync', accent: 'cyan', label: 'Sync' },
  syncing: { icon: 'sync', accent: 'cyan', label: 'Syncing' },
  synced: { icon: 'cloud-done', accent: 'lime', label: 'Synced' },
  offline: { icon: 'cloud-offline', accent: 'amber', label: 'Offline' },
  error: { icon: 'warning', accent: 'rose', label: 'Sync failed' },
};

/** Tappable sync state. Spins only while a request is actually in flight. */
const SyncBadge = memo(function SyncBadge({
  status,
  onPress,
}: {
  status: SyncStatus;
  onPress: () => void;
}) {
  const meta = SYNC_META[status];
  const spin = useSharedValue(0);

  useEffect(() => {
    if (status === 'syncing') {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
      spin.value = 0;
    }
  }, [status, spin]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.88}
      accessibilityLabel={meta.label}
      style={[styles.sync, { borderColor: `${accentColor[meta.accent]}55` }]}
    >
      <Animated.View style={style}>
        <Ionicons name={meta.icon} size={14} color={accentColor[meta.accent]} />
      </Animated.View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
    fontWeight: '600',
  },
  sync: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: palette.amberSoft,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.amber,
  },
});
