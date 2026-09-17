import type { MuscleGroup } from '../../state/journey/muscles';

/**
 * The figure, as data.
 *
 * Two decisions worth stating, because both are the difference between this
 * being maintainable and being a pile of path strings.
 *
 * First, male and female are one drawing with different proportions rather
 * than two drawings. Shoulder width, waist and hip width are numbers; every
 * shape is derived from them. A change to how a shoulder is drawn lands on
 * both figures, and neither can drift away from the other.
 *
 * Second, the shapes are ellipses and rounded rectangles rather than traced
 * anatomy. That is an honest limit: this reads clearly at the size it is used
 * and is unmistakably a stylised figure, not a textbook plate. The region keys
 * are the contract — real anatomical artwork can replace the shapes here
 * without a single caller changing, as long as it answers to the same keys.
 *
 * Coordinates are in a 100 × 210 viewBox, origin top-left, figure centred on
 * x = 50.
 */
export type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number };

/** A region the map can shade, or the neutral body beneath them. */
export type Region = { key: MuscleGroup | 'body'; shapes: Shape[] };

export type BodyForm = 'male' | 'female';
export type BodyView = 'front' | 'back';

export const VIEW_BOX = { width: 100, height: 210 };

type Proportions = {
  shoulder: number;
  waist: number;
  hip: number;
  thigh: number;
  arm: number;
};

/**
 * The only difference between the two figures.
 *
 * Deliberately modest: a narrower shoulder, a smaller waist, a wider hip. The
 * point of offering both is that people recognise themselves in the diagram,
 * not that the app has an opinion about what a body should look like.
 */
const FORM: Record<BodyForm, Proportions> = {
  male: { shoulder: 19, waist: 11.5, hip: 13.5, thigh: 7.5, arm: 4.4 },
  female: { shoulder: 15.5, waist: 9.5, hip: 15, thigh: 7.2, arm: 3.8 },
};

const mirror = (shapes: Shape[]): Shape[] =>
  shapes.map((s) =>
    s.kind === 'ellipse'
      ? { ...s, cx: 100 - s.cx }
      : { ...s, x: 100 - s.x - s.w },
  );

/** A region and its mirror image, which is most of them. */
const pair = (key: Region['key'], shapes: Shape[]): Region => ({
  key,
  shapes: [...shapes, ...mirror(shapes)],
});

export function bodyRegions(form: BodyForm, view: BodyView): Region[] {
  const p = FORM[form];
  const armX = 50 - p.shoulder - p.arm + 1;

  /** Head, neck, hands and feet — drawn, never shaded. */
  const body: Region = {
    key: 'body',
    shapes: [
      { kind: 'ellipse', cx: 50, cy: 17, rx: 10.5, ry: 12 },
      { kind: 'rect', x: 45.5, y: 24, w: 9, h: 18, r: 4 },
      // Hands
      { kind: 'ellipse', cx: armX, cy: 112, rx: p.arm - 0.4, ry: 5 },
      { kind: 'ellipse', cx: 100 - armX, cy: 112, rx: p.arm - 0.4, ry: 5 },
      // Feet
      { kind: 'ellipse', cx: 50 - p.hip * 0.55, cy: 201, rx: 5, ry: 4.5 },
      { kind: 'ellipse', cx: 50 + p.hip * 0.55, cy: 201, rx: 5, ry: 4.5 },
      /*
       * The body beneath the regions. Every piece overlaps its neighbour by
       * several units on purpose: a two-unit gap between a hip and a thigh
       * reads as a figure made of parts, which is exactly what this is trying
       * not to look like.
       */
      // Chest and ribcage, wider than the waist below it
      { kind: 'rect', x: 50 - p.waist - 2.5, y: 38, w: (p.waist + 2.5) * 2, h: 34, r: 13 },
      // Waist
      { kind: 'rect', x: 50 - p.waist, y: 62, w: p.waist * 2, h: 40, r: 10 },
      // Hips, overlapping the waist above and the thighs below
      { kind: 'rect', x: 50 - p.hip, y: 92, w: p.hip * 2, h: 32, r: 13 },
      // Upper arms, tucked under the shoulders
      { kind: 'rect', x: armX - p.arm, y: 44, w: p.arm * 2, h: 36, r: p.arm },
      { kind: 'rect', x: 100 - armX - p.arm, y: 44, w: p.arm * 2, h: 36, r: p.arm },
      // Thighs, overlapping the hips
      { kind: 'rect', x: 50 - p.hip * 0.62 - p.thigh / 2, y: 112, w: p.thigh, h: 50, r: 7 },
      { kind: 'rect', x: 50 + p.hip * 0.62 - p.thigh / 2, y: 112, w: p.thigh, h: 50, r: 7 },
      // Shins
      { kind: 'rect', x: 50 - p.hip * 0.55 - 4.5, y: 154, w: 9, h: 46, r: 4.5 },
      { kind: 'rect', x: 50 + p.hip * 0.55 - 4.5, y: 154, w: 9, h: 46, r: 4.5 },
    ],
  };

  const shoulders = pair('shoulders', [
    { kind: 'ellipse', cx: 50 - p.shoulder, cy: 46, rx: 7.5, ry: 7 },
  ]);

  const forearms = pair('forearms', [
    { kind: 'rect', x: armX - p.arm, y: 80, w: p.arm * 2, h: 30, r: p.arm },
  ]);

  if (view === 'front') {
    return [
      body,
      shoulders,
      pair('chest', [{ kind: 'ellipse', cx: 50 - p.waist * 0.52, cy: 52, rx: p.waist * 0.62, ry: 9 }]),
      pair('biceps', [{ kind: 'rect', x: armX - p.arm, y: 48, w: p.arm * 2, h: 28, r: p.arm }]),
      forearms,
      {
        key: 'abs',
        shapes: [{ kind: 'rect', x: 50 - p.waist * 0.58, y: 66, w: p.waist * 1.16, h: 30, r: 5 }],
      },
      pair('obliques', [
        { kind: 'rect', x: 50 - p.waist - 0.5, y: 68, w: 5, h: 26, r: 3 },
      ]),
      pair('quads', [
        { kind: 'rect', x: 50 - p.hip * 0.62 - p.thigh / 2, y: 118, w: p.thigh, h: 40, r: 6 },
      ]),
      {
        key: 'adductors',
        shapes: [{ kind: 'rect', x: 50 - 4.5, y: 120, w: 9, h: 28, r: 4 }],
      },
    ];
  }

  return [
    body,
    shoulders,
    {
      key: 'traps',
      shapes: [{ kind: 'rect', x: 50 - p.shoulder * 0.7, y: 38, w: p.shoulder * 1.4, h: 18, r: 7 }],
    },
    pair('lats', [
      { kind: 'ellipse', cx: 50 - p.waist * 0.6, cy: 68, rx: p.waist * 0.72, ry: 14 },
    ]),
    pair('triceps', [{ kind: 'rect', x: armX - p.arm, y: 48, w: p.arm * 2, h: 28, r: p.arm }]),
    forearms,
    {
      key: 'lowerBack',
      shapes: [{ kind: 'rect', x: 50 - p.waist * 0.6, y: 84, w: p.waist * 1.2, h: 16, r: 5 }],
    },
    pair('glutes', [
      { kind: 'ellipse', cx: 50 - p.hip * 0.5, cy: 108, rx: p.hip * 0.55, ry: 11 },
    ]),
    pair('hamstrings', [
      { kind: 'rect', x: 50 - p.hip * 0.62 - p.thigh / 2, y: 120, w: p.thigh, h: 38, r: 6 },
    ]),
    pair('calves', [
      { kind: 'rect', x: 50 - p.hip * 0.55 - 4.5, y: 160, w: 9, h: 26, r: 4.5 },
    ]),
  ];
}

/** Every muscle region the given view can shade. */
export function regionsInView(view: BodyView): MuscleGroup[] {
  return bodyRegions('male', view)
    .map((region) => region.key)
    .filter((key): key is MuscleGroup => key !== 'body');
}
