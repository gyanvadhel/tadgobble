// One deliberate identity: the dark "Highlighter" look. Yellow is the highlight, not the page.
export const sitePalette = {
  bg: '#160b26',
  surface: '#22133a',
  text: '#f6f1ff',
  muted: '#b8a9d6',
  line: '#3a2a55',
  yellow: '#ffe600',
  onYellow: '#160b26',
  violet: '#7b4dff',
  onViolet: '#ffffff',
  violetText: '#a98bff',
  lilac: '#c5b5f5',
  orange: '#ff7547',
};

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export const paletteStyle = Object.fromEntries(
  Object.entries(sitePalette).map(([key, value]) => [`--${kebab(key)}`, value]),
);

// WCAG 2.1 contrast ratio between two #rrggbb colours.
export function contrastRatio(a, b) {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Light pastels for cover art; they sit on the dark page and carry dark text.
export const productTints = {
  rose: '#efdae6',
  lilac: '#e2d6f5',
  mint: '#dae8dc',
  lime: '#e8edcf',
  peach: '#f4dfd1',
  blue: '#dce5f3',
};
