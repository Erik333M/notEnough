import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { memo, useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion, palette, radius, shadow } from '../theme/theme';
import { PressableScale } from '../ui/Touchable';
import { ROUTES, TAB_ROUTES, type RouteKey } from './routes';

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
  const [width, setWidth] = useState(0);
  const index = Math.max(0, TAB_ROUTES.indexOf(active));
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = withSpring(index, motion.spring);
  }, [index, pos]);

  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const itemWidth = width > 0 ? (width - 12) / TAB_ROUTES.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: itemWidth,
    transform: [{ translateX: pos.value * itemWidth }],
  }));

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(bottomInset, 10) }]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.tint} pointerEvents="none" />
      {itemWidth > 0 ? <Animated.View style={[styles.indicator, indicator]} /> : null}

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
          color={active ? palette.text : palette.textFaint}
        />
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {meta.label}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
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
    borderColor: palette.hairlineStrong,
    overflow: 'hidden',
    ...(shadow.float as object),
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(18,22,44,0.45)' : 'rgba(16,20,42,0.92)',
  },
  indicator: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
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
    color: palette.textFaint,
  },
  labelActive: {
    color: palette.text,
  },
});
