import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { gradients, palette, radius } from '../theme/theme';
import type { IconName } from '../state/types';
import { GlassCard } from './Glass';

/** Shimmering placeholder block used while persisted state hydrates. */
export const Skeleton = memo(function Skeleton({
  width = '100%',
  height = 16,
  rounded = radius.sm,
  delay = 0,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  delay?: number;
}) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [delay, shimmer]);

  const style = useAnimatedStyle(() => ({ opacity: 0.28 + shimmer.value * 0.34 }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: 'rgba(255,255,255,0.16)' },
        style,
      ]}
    />
  );
});

export const SkeletonCard = memo(function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <GlassCard style={{ gap: 12 }}>
      <Skeleton width="45%" height={12} delay={delay} />
      <Skeleton width="80%" height={22} delay={delay + 80} />
      <Skeleton width="100%" height={8} rounded={999} delay={delay + 160} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Skeleton width="30%" height={46} rounded={radius.md} delay={delay + 220} />
        <Skeleton width="30%" height={46} rounded={radius.md} delay={delay + 280} />
        <Skeleton width="30%" height={46} rounded={radius.md} delay={delay + 340} />
      </View>
    </GlassCard>
  );
});

/**
 * Boot splash. Runs while credentials + persisted state load; the pulse is a
 * repeating UI-thread animation so a slow disk read never freezes it.
 */
export const BootSplash = memo(function BootSplash({ label = 'Warming up' }: { label?: string }) {
  const pulse = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 720, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 720, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse, glow]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.09 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + glow.value * 0.34,
    transform: [{ scale: 1 + glow.value * 0.28 }],
  }));

  return (
    <View style={styles.splash}>
      <View style={styles.splashMarkWrap}>
        <Animated.View style={[styles.splashHalo, haloStyle]} />
        <Animated.View style={markStyle}>
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.splashMark}
          >
            <Ionicons name="flash" size={30} color={palette.onAccent} />
          </LinearGradient>
        </Animated.View>
      </View>
      <Animated.Text entering={FadeIn.delay(180)} style={styles.splashBrand}>
        NOTenough
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(300)} style={styles.splashLabel}>
        {label}
      </Animated.Text>
      <LoadingBar />
    </View>
  );
});

const LoadingBar = memo(function LoadingBar() {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.cubic) }), -1, false);
  }, [t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -110 + t.value * 220 }],
  }));

  return (
    <View style={styles.loaderTrack}>
      <Animated.View style={[styles.loaderThumb, style]}>
        <LinearGradient
          colors={gradients.cyan}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  copy,
}: {
  icon: IconName;
  title: string;
  copy: string;
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [float]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: float.value * -6 }] }));

  return (
    <View style={styles.empty}>
      <Animated.View style={[styles.emptyIcon, style]}>
        <Ionicons name={icon} size={26} color={palette.textMuted} />
      </Animated.View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashMarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  splashHalo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: palette.violet,
  },
  splashMark: {
    width: 74,
    height: 74,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBrand: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: 0.4,
  },
  splashLabel: {
    fontSize: 13,
    color: palette.textFaint,
    fontWeight: '600',
  },
  loaderTrack: {
    marginTop: 14,
    width: 140,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  loaderThumb: {
    width: 60,
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 26,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.textFaint,
    textAlign: 'center',
    maxWidth: 260,
  },
});
