import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients, motion, palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { PressableScale } from '../ui/Touchable';
import { MENU_ROUTES, ROUTES, type RouteKey } from './routes';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MENU_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

type Props = {
  open: boolean;
  active: RouteKey;
  userName: string;
  userEmail: string;
  streak: number;
  onSelect: (key: RouteKey) => void;
  onClose: () => void;
  onLogout: () => void;
};

/**
 * Slide-out menu. Position is a shared value driven by both the `open` prop and
 * a pan gesture, so dragging it closed tracks the finger at 60fps without any
 * React state churn — state only changes once, when the gesture settles.
 */
export const SideMenu = memo(function SideMenu({
  open,
  active,
  userName,
  userEmail,
  streak,
  onSelect,
  onClose,
  onLogout,
}: Props) {
  const insets = useSafeAreaInsets();
  const x = useSharedValue(-MENU_WIDTH);
  const progress = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(open ? 0 : -MENU_WIDTH, motion.spring);
    progress.value = withTiming(open ? 1 : 0, { duration: motion.base });
  }, [open, x, progress]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      x.value = Math.min(0, Math.max(-MENU_WIDTH, event.translationX));
      progress.value = 1 + x.value / MENU_WIDTH;
    })
    .onEnd((event) => {
      const shouldClose = event.translationX < -MENU_WIDTH * 0.3 || event.velocityX < -600;
      if (shouldClose) {
        x.value = withSpring(-MENU_WIDTH, motion.spring);
        progress.value = withTiming(0, { duration: motion.fast });
        runOnJS(onClose)();
      } else {
        x.value = withSpring(0, motion.spring);
        progress.value = withTiming(1, { duration: motion.fast });
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.7,
  }));

  const handleSelect = useCallback(
    (key: RouteKey) => {
      onSelect(key);
      onClose();
    },
    [onClose, onSelect],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.panel,
            { width: MENU_WIDTH, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 },
            panelStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(28,23,64,0.98)', 'rgba(10,16,36,0.98)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.profile}>
            <LinearGradient
              colors={gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials(userName)}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          <View style={styles.streakCard}>
            <Ionicons name="flame" size={18} color={palette.amber} />
            <Text style={styles.streakText}>
              <Text style={styles.streakValue}>{streak}</Text>
              {streak === 1 ? ' day streak' : ' day streak'}
            </Text>
          </View>

          <View style={styles.nav}>
            {MENU_ROUTES.map((key) => (
              <MenuRow
                key={key}
                routeKey={key}
                active={key === active}
                onSelect={handleSelect}
              />
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <Button label="Sign out" icon="log-out-outline" variant="glass" onPress={onLogout} />
          <Text style={styles.version}>NOTenough • v1.1</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const MenuRow = memo(function MenuRow({
  routeKey,
  active,
  onSelect,
}: {
  routeKey: RouteKey;
  active: boolean;
  onSelect: (key: RouteKey) => void;
}) {
  const meta = ROUTES[routeKey];
  return (
    <PressableScale
      onPress={() => onSelect(routeKey)}
      haptic="selection"
      scaleTo={0.97}
      style={[styles.navRow, active && styles.navRowActive]}
    >
      <View style={[styles.navIcon, active && styles.navIconActive]}>
        <Ionicons
          name={active ? meta.iconActive : meta.icon}
          size={17}
          color={active ? palette.onAccent : palette.textMuted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{meta.title}</Text>
        <Text style={styles.navSub} numberOfLines={1}>
          {meta.subtitle}
        </Text>
      </View>
      {active ? <View style={styles.activeDot} /> : null}
    </PressableScale>
  );
});

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#02030A',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 16,
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: palette.hairlineStrong,
    overflow: 'hidden',
    gap: 14,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.onAccent,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  email: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.amberSoft,
  },
  streakText: {
    fontSize: 13,
    color: palette.text,
    fontWeight: '600',
  },
  streakValue: {
    fontWeight: '800',
    fontSize: 15,
    color: palette.amber,
  },
  nav: {
    gap: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
  },
  navRowActive: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: palette.hairline,
  },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  navIconActive: {
    backgroundColor: palette.violet,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textMuted,
  },
  navLabelActive: {
    color: palette.text,
  },
  navSub: {
    fontSize: 11,
    color: palette.textFaint,
    marginTop: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.violet,
  },
  version: {
    fontSize: 11,
    color: palette.textFaint,
    textAlign: 'center',
    marginTop: Platform.OS === 'ios' ? 4 : 8,
  },
});
