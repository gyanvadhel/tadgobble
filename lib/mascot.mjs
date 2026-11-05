// The original soft, four-lobed blob silhouette. Keep the mascot tailless.
export const blobPath =
  'M48 12C65 0 88 13 86 34C103 49 93 76 72 77C61 94 36 90 27 75C7 77-1 59 11 45C0 26 15 8 34 13C38 11 44 10 48 12Z';

// Moods for the intro story. `calm` and `hungry` are exactly what Gobble has always drawn.
// `closedEye` is the index of an eye drawn shut (a wink); `eyeScaleY` stretches the eye height.
export const expressions = {
  calm: { mouth: { d: 'M37 63Q50 75 65 61' }, eyeScaleY: 1 },
  hungry: { mouth: { ellipse: { cx: 50, cy: 65, rx: 12, ry: 10 } }, eyeScaleY: 1 },
  happy: { mouth: { d: 'M33 59Q50 84 69 57' }, eyeScaleY: 1 },
  surprised: { mouth: { ellipse: { cx: 50, cy: 68, rx: 6, ry: 7 } }, eyeScaleY: 1.12 },
  wink: { mouth: { d: 'M35 62Q50 78 67 60' }, eyeScaleY: 1, closedEye: 1 },
};
