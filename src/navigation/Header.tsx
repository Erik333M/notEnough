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
import { radius } from '../theme/theme';
import { PressableScale } from '../ui/Touchable';
import type { AccentName } from '../theme/tokens';
import type { Theme } from '../theme/tokens';
import { useStyles, useTheme } from '../theme/ThemeContext';

export const Header = memo(function Header({
  title,
  subtitle,
  streak,
  syncStatus,
  onSync,
}: {
  title: string;
  subtitle: string;
  streak: number;
  syncStatus: SyncStatus;
  onSync: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
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
        <Ionicons name="flame" size={14} color={theme.warning} />
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    </View>
  );
});

const SYNC_META: Record<SyncStatus, { icon: 'cloud-done' | 'cloud-offline' | 'sync' | 'warning'; accent: AccentName; label: string }> = {
  idle: { icon: 'sync', accent: 'mind', label: 'Sync' },
  syncing: { icon: 'sync', accent: 'mind', label: 'Syncing' },
  synced: { icon: 'cloud-done', accent: 'body', label: 'Synced' },
  offline: { icon: 'cloud-offline', accent: 'warning', label: 'Offline' },
  error: { icon: 'warning', accent: 'danger', label: 'Sync failed' },
};

/** Tappable sync state. Spins only while a request is actually in flight. */
const SyncBadge = memo(function SyncBadge({
  status,
  onPress,
}: {
  status: SyncStatus;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
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
      style={[styles.sync, { borderColor: `${theme.accent[meta.accent]}55` }]}
    >
      <Animated.View style={style}>
        <Ionicons name={meta.icon} size={14} color={theme.accent[meta.accent]} />
      </Animated.View>
    </PressableScale>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
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
    backgroundColor: theme.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.borderStrong,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  subtitle: {
    fontSize: 12,
    color: theme.textFaint,
    marginTop: 2,
    fontWeight: '600',
  },
  sync: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: theme.warningSoft,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.warning,
  },
});
