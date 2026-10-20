// One deliberate identity. Palette exploration is no longer part of the public UI.
export const sitePalette = {
  cream: '#f9f4a7',
  ink: '#39245a',
  muted: '#665578',
  acid: '#d5f568',
  purple: '#c5b5f5',
  accent: '#ff7547',
  pond: '#bfdcf5',
  surface: '#ffffff',
  dark: '#39245a',
  darkText: '#f9f4a7',
  line: '#bfb78a',
};

export const paletteStyle = Object.fromEntries(
  Object.entries(sitePalette).map(([key, value]) => [`--${key}`, value]),
);

export const productTints = {
  rose: '#efdae6',
  lilac: '#e2d6f5',
  mint: '#dae8dc',
  lime: '#e8edcf',
  peach: '#f4dfd1',
  blue: '#dce5f3',
};
