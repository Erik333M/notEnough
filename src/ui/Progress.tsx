import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { accentColor, motion, palette, radius, type AccentName } from '../theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  accent?: AccentName;
  children?: React.ReactNode;
  delay?: number;
};

/**
 * Circular progress. The sweep is animated through `useAnimatedProps`, so the
 * stroke updates on the UI thread without a single React re-render.
 */
export const ProgressRing = memo(function ProgressRing({
  progress,
  size = 96,
  stroke = 9,
  accent = 'violet',
  children,
  delay = 0,
}: RingProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    value.value = withDelay(delay, withSpring(clamped, motion.springSoft));
  }, [progress, delay, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  const gradientId = useMemo(() => `ring-${accent}-${size}-${stroke}`, [accent, size, stroke]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accentColor[accent]} />
            <Stop offset="1" stopColor={palette.cyan} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>{children}</View> : null}
    </View>
  );
});

/**
 * Ring bound directly to a shared value — for readouts that change every frame
 * (the interval timer), where re-rendering React 60×/s would be wasteful.
 */
export const LiveProgressRing = memo(function LiveProgressRing({
  progress,
  size = 240,
  stroke = 14,
  accent = 'cyan',
  children,
}: {
  progress: SharedValue<number>;
  size?: number;
  stroke?: number;
  accent?: AccentName;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const gradientId = `live-ring-${accent}-${size}`;

  const animatedProps = useAnimatedProps(() => {
    const clamped = progress.value < 0 ? 0 : progress.value > 1 ? 1 : progress.value;
    return { strokeDashoffset: circumference * (1 - clamped) };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accentColor[accent]} />
            <Stop offset="1" stopColor={palette.violet} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>{children}</View> : null}
    </View>
  );
});

type BarProps = {
  progress: number;
  accent?: AccentName;
  height?: number;
  delay?: number;
};

export const ProgressBar = memo(function ProgressBar({
  progress,
  accent = 'violet',
  height = 8,
  delay = 0,
}: BarProps) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withDelay(
      delay,
      withTiming(Math.max(0, Math.min(1, progress)), { duration: motion.slow }),
    );
  }, [progress, delay, value]);

  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View style={[styles.barTrack, { height, borderRadius: height }]}>
      <Animated.View
        style={[
          styles.barFill,
          { backgroundColor: accentColor[accent], borderRadius: height },
          fill,
        ]}
      />
    </View>
  );
});

export type BarDatum = { key: string; label: string; value: number; highlight?: boolean };

/**
 * Compact weekly column chart. Bars are plain views with a height animation —
 * cheaper than an SVG path and it keeps the whole chart under one draw pass.
 */
export const ColumnChart = memo(function ColumnChart({
  data,
  height = 118,
  accent = 'violet',
}: {
  data: BarDatum[];
  height?: number;
  accent?: AccentName;
}) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);

  return (
    <View style={[styles.chart, { height }]}>
      {data.map((d, i) => (
        <Column
          key={d.key}
          ratio={d.value / max}
          label={d.label}
          highlight={d.highlight}
          accent={accent}
          delay={i * 45}
          maxHeight={height - 26}
        />
      ))}
    </View>
  );
});

const Column = memo(function Column({
  ratio,
  label,
  highlight,
  accent,
  delay,
  maxHeight,
}: {
  ratio: number;
  label: string;
  highlight?: boolean;
  accent: AccentName;
  delay: number;
  maxHeight: number;
}) {
  const h = useSharedValue(0);

  useEffect(() => {
    h.value = withDelay(delay, withSpring(Math.max(0.04, ratio), motion.springSoft));
  }, [ratio, delay, h]);

  const style = useAnimatedStyle(() => ({ height: h.value * maxHeight }));

  return (
    <View style={styles.column}>
      <View style={styles.columnTrack}>
        <Animated.View
          style={[
            styles.columnFill,
            {
              backgroundColor: highlight ? accentColor[accent] : 'rgba(255,255,255,0.22)',
            },
            style,
          ]}
        />
      </View>
      <Text style={[styles.columnLabel, highlight && { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  columnTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  columnFill: {
    width: '100%',
    borderRadius: radius.sm,
    minHeight: 4,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
});
