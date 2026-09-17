import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Rect } from 'react-native-svg';

import {
  MUSCLE_LABEL,
  emphasisOf,
  type MuscleEmphasis,
  type MuscleWork,
} from '../../state/journey/muscles';
import { palette } from '../../theme/theme';
import { VIEW_BOX, bodyRegions, type BodyForm, type BodyView } from './bodyGeometry';

/**
 * A figure with the working muscles shaded.
 *
 * Two intensities rather than one. If everything a movement touches were the
 * same red, a deadlift and a bicep curl would look equally like whole-body
 * work; the strong shade is what the movement is about and the faint one is
 * what comes along with it.
 *
 * The neutral body is drawn first and the regions over it, so a region that
 * is not working reads as part of a body rather than as a hole in one.
 */
/**
 * An unworked region is exactly the colour of the body beneath it.
 *
 * Any difference at all draws an outline around every region, and fifteen
 * outlines turn a figure into a diagram of its own parts. They should be
 * invisible until they light up.
 */
const BODY_FILL = 'rgba(255,255,255,0.085)';

const FILL: Record<MuscleEmphasis, string> = {
  primary: '#FF5A5F',
  secondary: 'rgba(255,90,95,0.36)',
  none: BODY_FILL,
};

export const BodyMap = memo(function BodyMap({
  work,
  form,
  view,
  height = 210,
}: {
  work: MuscleWork;
  form: BodyForm;
  view: BodyView;
  height?: number;
}) {
  const regions = bodyRegions(form, view);
  const width = (height * VIEW_BOX.width) / VIEW_BOX.height;

  const worked = regions
    .filter((region) => region.key !== 'body')
    .filter((region) => emphasisOf(work, region.key as never) !== 'none');

  return (
    <View style={styles.wrap}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
        accessibilityRole="image"
        accessibilityLabel={describe(work, view)}
      >
        {regions.map((region) => {
          const emphasis =
            region.key === 'body' ? 'none' : emphasisOf(work, region.key as never);
          const fill = region.key === 'body' ? BODY_FILL : FILL[emphasis];

          return (
            <G key={region.key}>
              {region.shapes.map((shape, index) =>
                shape.kind === 'ellipse' ? (
                  <Ellipse
                    key={index}
                    cx={shape.cx}
                    cy={shape.cy}
                    rx={shape.rx}
                    ry={shape.ry}
                    fill={fill}
                  />
                ) : (
                  <Rect
                    key={index}
                    x={shape.x}
                    y={shape.y}
                    width={shape.w}
                    height={shape.h}
                    rx={shape.r}
                    fill={fill}
                  />
                ),
              )}
            </G>
          );
        })}
      </Svg>

      <Text style={styles.caption}>
        {view === 'front' ? 'Front' : 'Back'}
        {worked.length === 0 ? ' · nothing here' : ''}
      </Text>
    </View>
  );
});

/**
 * What a screen reader hears.
 *
 * A diagram that says only "image" is useless to somebody who cannot see it,
 * and this one is carrying the whole point of the screen.
 */
function describe(work: MuscleWork, view: BodyView): string {
  const side = view === 'front' ? 'Front' : 'Back';
  const named = work.primary.map((group) => MUSCLE_LABEL[group].toLowerCase());
  if (named.length === 0) return `${side} view, nothing worked on this side`;
  return `${side} view. Works ${named.join(', ')}`;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  caption: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: palette.textFaint,
    textTransform: 'uppercase',
  },
});
