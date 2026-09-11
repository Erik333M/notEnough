import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Path,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';

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

/**
 * A point on a trend line.
 *
 * Deliberately has no id: points are positional and two readings can share a
 * date (a benchmark tested twice in one session, a weight logged morning and
 * evening), so anything date-derived would collide as a React key.
 */
export type LinePoint = { value: number };

/**
 * Trend line for a dated series.
 *
 * Deliberately unopinionated about direction: it plots the values it is given
 * and says nothing about whether up is good. A faster 400 m and a heavier
 * deadlift move opposite ways on the axis, so the *caller* labels what better
 * means — a chart that quietly inverted itself per metric would be impossible
 * to read across two screens.
 *
 * A flat series (every value identical) draws through the middle rather than
 * collapsing onto the floor, which is what a naive min/max scale would do.
 */
export const LineChart = memo(function LineChart({
  points,
  accent = 'violet',
  height = 150,
  formatValue = (value: number) => `${value}`,
}: {
  points: LinePoint[];
  accent?: AccentName;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    [],
  );

  const plot = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;

    const values = points.map((p) => p.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    // Guard the flat case: without this every point lands on the same edge.
    const span = high - low || 1;
    const flat = high === low;

    const padY = 14;
    const usableH = height - padY * 2;
    const stepX = width / (points.length - 1);

    const coords = points.map((point, index) => ({
      x: index * stepX,
      y: flat
        ? padY + usableH / 2
        : padY + usableH - ((point.value - low) / span) * usableH,
    }));

    const d = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(' ');

    return { coords, d, low, high, flat };
  }, [points, width, height]);

  return (
    <View style={[styles.lineWrap, { height }]} onLayout={onLayout}>
      {plot ? (
        <>
          <Svg width={width} height={height}>
            <Path
              d={plot.d}
              stroke={accentColor[accent]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {plot.coords.map((c, i) => (
              <Circle
                // Index is the correct key here — the series is ordered and
                // positional, and values are free to repeat.
                key={i}
                cx={c.x}
                cy={c.y}
                // The most recent reading is the one people look for.
                r={i === plot.coords.length - 1 ? 4.5 : 2.5}
                fill={
                  i === plot.coords.length - 1 ? accentColor[accent] : palette.bg1
                }
                stroke={accentColor[accent]}
                strokeWidth={1.5}
              />
            ))}
          </Svg>

          {plot.flat ? null : (
            <>
              <Text style={[styles.lineAxis, styles.lineAxisTop]}>
                {formatValue(plot.high)}
              </Text>
              <Text style={[styles.lineAxis, styles.lineAxisBottom]}>
                {formatValue(plot.low)}
              </Text>
            </>
          )}
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  lineWrap: {
    width: '100%',
    justifyContent: 'center',
  },
  lineAxis: {
    position: 'absolute',
    right: 0,
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
    backgroundColor: palette.bg1,
    paddingHorizontal: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  lineAxisTop: {
    top: 0,
  },
  lineAxisBottom: {
    bottom: 0,
  },
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
