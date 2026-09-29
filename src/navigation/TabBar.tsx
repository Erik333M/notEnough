import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { memo, useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion, radius, shadow } from '../theme/theme';
import { PressableScale } from '../ui/Touchable';
import { ROUTES, TAB_ROUTES, type RouteKey } from './routes';
import type { Theme } from '../theme/tokens';
import { useStyles, useTheme } from '../theme/ThemeContext';

export const TAB_BAR_HEIGHT = 74;

/**
 * Bottom bar with a spring-tracked pill indicator.
 *
 * Real backdrop blur is used on iOS only. On Android `expo-blur` has to
 * re-capture and blur the content behind it on every frame, which is exactly
 * the kind of continuous work that makes a scrolling screen drop frames, so
 * Android gets a translucent fill instead — visually near-identical here.
 */
export const TabBar = memo(function TabBar({
  active,
  onSelect,
  bottomInset,
}: {
  active: RouteKey;
  onSelect: (key: RouteKey) => void;
  bottomInset: number;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  // -1 on the routes that live only in the slide-out menu. Clamping that to 0
  // would park the pill under Today and tell you that you are somewhere you
  // are not, so the indicator is hidden instead and no tab reads as current.
  const index = TAB_ROUTES.indexOf(active);
  const onATab = index >= 0;
  const pos = useSharedValue(Math.max(0, index));

  useEffect(() => {
    if (onATab) pos.value = withSpring(index, motion.spring);
  }, [index, onATab, pos]);

  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const itemWidth = width > 0 ? (width - 12) / TAB_ROUTES.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: itemWidth,
    transform: [{ translateX: pos.value * itemWidth }],
  }));

  return (
    <View
      style={[styles.wrap, { pointerEvents: 'box-none', bottom: Math.max(bottomInset, 10) }]}
      onLayout={onLayout}
    >
      {/* The blur follows the theme; a dark blur under a light page is a bug. */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={38}
          tint={theme.name === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[styles.tint, { pointerEvents: 'none' }]} />
      {itemWidth > 0 && onATab ? <Animated.View style={[styles.indicator, indicator]} /> : null}

      {TAB_ROUTES.map((key) => (
        <TabItem key={key} routeKey={key} active={key === active} onSelect={onSelect} />
      ))}
    </View>
  );
});

const TabItem = memo(function TabItem({
  routeKey,
  active,
  onSelect,
}: {
  routeKey: RouteKey;
  active: boolean;
  onSelect: (key: RouteKey) => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const meta = ROUTES[routeKey];
  const lift = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(active ? 1 : 0, motion.spring);
  }, [active, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 2 }, { scale: 1 + lift.value * 0.08 }],
  }));

  const handlePress = useCallback(() => onSelect(routeKey), [onSelect, routeKey]);

  return (
    <PressableScale
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.94}
      style={styles.item}
      hitSlop={4}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={active ? meta.iconActive : meta.icon}
          size={21}
          color={active ? theme.text : theme.textFaint}
        />
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {meta.label}
      </Text>
    </PressableScale>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.borderStrong,
    overflow: 'hidden',
    ...(shadow.float as object),
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    /*
     * iOS lets the blur do the work; Android has no usable blur here, so the
     * bar is a solid surface. Either way it is the theme's surface rather
     * than a fixed navy, which was still dark behind a light page.
     */
    backgroundColor: Platform.OS === 'ios' ? theme.surfaceElevated : theme.surface,
  },
  indicator: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: radius.lg,
    backgroundColor: theme.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
  },
  labelActive: {
    color: theme.text,
  },
});
