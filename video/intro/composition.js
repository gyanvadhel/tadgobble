const canvas = document.querySelector('#film'),
  ctx = canvas.getContext('2d', { alpha: false });
const [takes, captions] = await Promise.all(
  ['/data/intro/takes.json', '/data/intro/captions.json'].map((p) =>
    fetch(p).then((r) => r.json()),
  ),
);
await document.fonts.load('800 100px Bricolage');
await document.fonts.load('600 50px DM');
await document.fonts.ready;
const C = {
  plum: '#39245a',
  butter: '#f9f4a7',
  orange: '#ff7547',
  lilac: '#c5b5f5',
  sky: '#bfdcf5',
  lime: '#d5f568',
  paper: '#fffef6',
  pink: '#f2b8d3',
};
const blob = new Path2D(
  'M48 12C65 0 88 13 86 34C103 49 93 76 72 77C61 94 36 90 27 75C7 77-1 59 11 45C0 26 15 8 34 13C38 11 44 10 48 12Z',
);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  lerp = (a, b, t) => a + (b - a) * t,
  ease = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  },
  out = (t) => 1 - (1 - clamp(t)) ** 3;
const spring = (t) => (t < 0 ? 0 : 1 - Math.exp(-t * 12) * Math.cos(t * 17));
const imageCache = new Map();
async function getImage(file) {
  if (!imageCache.has(file)) {
    const image = new Image();
    image.src = '/data/intro/' + file;
    imageCache.set(
      file,
      image.decode().then(() => image),
    );
    if (imageCache.size > 32) imageCache.delete(imageCache.keys().next().value);
  }
  return imageCache.get(file);
}
const take = (n) => takes.find((t) => t.name === n);
const event = (n, e) => take(n).events.find((x) => x.name === e)?.t ?? 0;
const end = (n) => take(n).duration - 0.22;
const scenes = [
  { a: 0, b: 4, id: 'opening', bg: C.plum, fg: C.butter },
  {
    a: 4,
    b: 8,
    id: 'hello',
    bg: C.butter,
    fg: C.plum,
    clip: 'hero',
    label: 'A VERY GOOD CORNER OF THE INTERNET',
    lines: ['A BETTER', 'RABBIT HOLE.'],
  },
  {
    a: 8,
    b: 13,
    id: 'gobble',
    bg: C.lilac,
    fg: C.plum,
    clip: 'hero',
    label: '01 / FOLLOW YOUR CURIOSITY',
    lines: ['FEED YOUR', 'CURIOSITY.'],
  },
  {
    a: 13,
    b: 16,
    id: 'previews',
    bg: C.paper,
    fg: C.plum,
    clip: 'drawers',
    label: '02 / ACTUAL WEBSITE PREVIEWS',
    lines: ['LOOK BEFORE', 'YOU TAB.'],
  },
  {
    a: 16,
    b: 18,
    id: 'category',
    bg: C.pink,
    fg: C.plum,
    clip: 'discover',
    label: 'FIND YOUR CORNER',
    lines: ['YOUR NEXT', '“OH, NICE.”'],
  },
  {
    a: 18,
    b: 21,
    id: 'stash',
    bg: C.lime,
    fg: C.plum,
    clip: 'discover',
    label: 'THE GOOD STUFF, SAVED',
    lines: ['THAT ONE?', 'KEEP IT.'],
  },
  {
    a: 21,
    b: 26,
    id: 'maker',
    bg: C.plum,
    fg: C.butter,
    clip: 'basics',
    label: '03 / MADE SOMETHING?',
    lines: ['BECOME A', 'GOBBLER.'],
  },
  {
    a: 26,
    b: 28.2,
    id: 'people',
    bg: C.butter,
    fg: C.plum,
    clip: 'people',
    label: 'GIVE YOUR PRODUCT A PLACE',
    lines: ['YOUR KIND', 'OF PEOPLE.'],
  },
  {
    a: 28.2,
    b: 30,
    id: 'details',
    bg: C.sky,
    fg: C.plum,
    clip: 'details',
    label: 'A LITTLE MORE YOU',
    lines: ['MAKE IT', 'YOURS.'],
  },
  {
    a: 30,
    b: 32,
    id: 'review',
    bg: C.lilac,
    fg: C.plum,
    clip: 'review',
    label: 'READY FOR ITS FIRST BITE',
    lines: ['YOU COOKED.', 'WE’LL LOOK.'],
  },
  { a: 32, b: 35, id: 'payoff', bg: C.plum, fg: C.butter },
  { a: 35, b: 40, id: 'end', bg: C.butter, fg: C.plum },
];
function interpolate(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (t < keys[i][0])
      return lerp(keys[i - 1][1], keys[i][1], (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
  return keys.at(-1)[1];
}
function sourceTime(s, t) {
  const raw = {
    hero: [
      [4, 0],
      [8, event('hero', 'feed-move')],
      [8.85, event('hero', 'feed-click')],
      [9.75, event('hero', 'preview-open')],
      [13, end('hero')],
    ],
    drawers: [
      [13, 0],
      [13.65, event('drawers', 'open-drawer-move')],
      [14, event('drawers', 'open-drawer-click')],
      [16, end('drawers')],
    ],
    discover: [
      [16, 0],
      [16.4, event('discover', 'category-move')],
      [16.75, event('discover', 'category-click')],
      [18, event('discover', 'save-move')],
      [18.65, event('discover', 'save-click')],
      [19.3, event('discover', 'stash-move')],
      [19.85, event('discover', 'stash-click')],
      [21, end('discover')],
    ],
    basics: [
      [21, 0],
      [21.4, event('basics', 'share-click')],
      [21.7, event('basics', 'form-open')],
      [22.3, event('basics', 'type-Product name-click')],
      [22.8, event('basics', 'typed-Product name')],
      [23.25, event('basics', 'type-Product website-click')],
      [23.9, event('basics', 'typed-Product website')],
      [24.7, event('basics', 'typed-One sentence that says it all')],
      [25.35, event('basics', 'basics-next-click')],
      [25.6, event('basics', 'cover-ready')],
      [26, end('basics')],
    ],
    people: [
      [26, 0],
      [26.65, event('people', 'maker-category-click')],
      [27.25, event('people', 'audience-click')],
      [27.95, event('people', 'people-next-click')],
      [28.2, end('people')],
    ],
    details: [
      [28.2, 0],
      [28.7, event('details', 'color-click')],
      [29.65, event('details', 'details-next-click')],
      [30, end('details')],
    ],
    review: [
      [30, 0],
      [30.25, event('review', 'ownership-click')],
      [30.75, event('review', 'submit-click')],
      [31.0, event('review', 'receipt')],
      [32, end('review')],
    ],
  };
  return interpolate(raw[s.clip], t);
}
function camera(s, t) {
  const key = (times) => {
    let a = times[0];
    for (let i = 1; i < times.length; i++) {
      const b = times[i];
      if (t <= b[0]) {
        let f = ease((t - a[0]) / (b[0] - a[0]));
        return { x: lerp(a[1], b[1], f), y: lerp(a[2], b[2], f), z: lerp(a[3], b[3], f) };
      }
      a = b;
    }
    return { x: a[1], y: a[2], z: a[3] };
  };
  const target = (clip, name) => {
    const e = take(clip).events.find((e) => e.name === name);
    return [e?.x ?? 720, e?.y ?? 550];
  };
  const cp = target('discover', 'category-click'),
    sv = target('discover', 'save-click'),
    st = target('discover', 'stash-click'),
    cat = target('people', 'maker-category-click'),
    aud = target('people', 'audience-click'),
    color = target('details', 'color-click'),
    sub = target('review', 'submit-click');
  switch (s.id) {
    case 'hello':
      return key([
        [4, 760, 530, 1.13],
        [4.7, 740, 470, 1.02],
        [6.0, 775, 560, 1.1],
        [7.6, 790, 590, 1.35],
        [8, 560, 640, 1.7],
      ]);
    case 'gobble':
      return key([
        [8, 560, 640, 1.7],
        [8.45, 270, 670, 2.2],
        [8.9, 280, 670, 2.2],
        [9.35, 795, 590, 1.9],
        [9.78, 770, 570, 1.55],
        [10.2, 720, 540, 1.25],
        [12.6, 720, 540, 1.28],
        [13, 720, 530, 1.08],
      ]);
    case 'previews':
      return key([
        [13, 720, 540, 1.02],
        [13.7, 650, 500, 1.3],
        [14.25, 720, 620, 1.12],
        [15.4, 1010, 740, 1.52],
        [16, 920, 650, 1.25],
      ]);
    case 'category':
      return key([
        [16, 720, 500, 1.08],
        [16.4, ...cp, 2.05],
        [16.85, ...cp, 2.05],
        [17.5, 720, 650, 1.22],
        [18, 920, 670, 1.35],
      ]);
    case 'stash':
      return key([
        [18, 920, 670, 1.35],
        [18.4, ...sv, 2.25],
        [18.8, ...sv, 2.25],
        [19.2, 720, 500, 1.1],
        [19.6, ...st, 2.05],
        [20, 720, 490, 1.1],
        [21, 720, 540, 1.12],
      ]);
    case 'maker':
      return key([
        [21, 1020, 200, 1.65],
        [21.5, 720, 550, 1.17],
        [22.25, 930, 545, 1.85],
        [23.6, 930, 610, 1.8],
        [24, 420, 590, 1.65],
        [25.0, 660, 580, 1.18],
        [26, 720, 550, 1.1],
      ]);
    case 'people':
      return key([
        [26, 850, 540, 1.12],
        [26.5, ...cat, 1.75],
        [27.1, ...aud, 1.7],
        [27.6, 720, 550, 1.12],
        [28.2, 720, 550, 1.12],
      ]);
    case 'details':
      return key([
        [28.2, 720, 600, 1.1],
        [28.55, ...color, 1.85],
        [29.1, 420, 530, 1.65],
        [29.5, 720, 550, 1.14],
        [30, 720, 550, 1.12],
      ]);
    case 'review':
      return key([
        [30, 720, 550, 1.12],
        [30.5, ...sub, 1.85],
        [30.8, ...sub, 1.85],
        [31.15, 720, 520, 1.23],
        [32, 720, 520, 1.25],
      ]);
    default:
      return { x: 720, y: 550, z: 1 };
  }
}
function rect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
function text(value, x, y, size, color = C.plum, align = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px Bricolage`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}
function label(value, x, y, color = C.plum, size = 24, align = 'left') {
  ctx.font = `600 ${size}px DM`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function mascot(x, y, size, t, fill = C.plum) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2.2) * 0.045);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -45);
  ctx.fillStyle = fill;
  ctx.fill(blob);
  ctx.fillStyle = C.paper;
  for (const ex of [34, 61]) {
    ctx.beginPath();
    ctx.ellipse(ex, 40, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#191a1c';
  for (const ex of [37, 64]) {
    ctx.beginPath();
    ctx.ellipse(ex + Math.sin(t) * 1.5, 42, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#191a1c';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(37, 63);
  ctx.quadraticCurveTo(50, 75, 65, 61);
  ctx.stroke();
  ctx.restore();
}
function star(x, y, r, rotation, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.13;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  }
  ctx.restore();
}
function branding(s, t) {
  mascot(92, 156, 62, t, s.fg);
  text('tadgobble.', 142, 171, 42, s.fg, 'left', 750);
  label('A BETTER RABBIT HOLE', 1008, 168, s.fg, 20, 'right');
}
const screen = document.createElement('canvas');
screen.width = 1040;
screen.height = 795;
const sc = screen.getContext('2d', { alpha: false });
// The UI is a single textured WebGL plane. Perspective-correct interpolation
// avoids the antialias seams of a canvas triangle mesh.
const plane = document.createElement('canvas');
plane.width = 1080;
plane.height = 1920;
const gl = plane.getContext('webgl', {
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
  premultipliedAlpha: false,
});
if (!gl) throw new Error('WebGL is required for the cinematic screen plane.');
function shader(kind, source) {
  const s = gl.createShader(kind);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
gl.attachShader(
  program,
  shader(
    gl.VERTEX_SHADER,
    'attribute vec4 position;attribute vec2 uv;varying vec2 tex;void main(){gl_Position=position;tex=uv;}',
  ),
);
gl.attachShader(
  program,
  shader(
    gl.FRAGMENT_SHADER,
    'precision mediump float;uniform sampler2D image;varying vec2 tex;void main(){gl_FragColor=texture2D(image,tex);}',
  ),
);
gl.linkProgram(program);
gl.useProgram(program);
const vertices = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
for (const [name, size, offset] of [
  ['position', 4, 0],
  ['uv', 2, 16],
]) {
  const a = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, size, gl.FLOAT, false, 24, offset);
}
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.viewport(0, 0, 1080, 1920);
function renderPlane(cx, cy, rx, ry, rz) {
  const data = [];
  for (const [x, y, u, v] of [
    [-520, -397.5, 0, 0],
    [-520, 397.5, 0, 1],
    [520, -397.5, 1, 0],
    [520, 397.5, 1, 1],
  ]) {
    const yy = y * Math.cos(rx),
      zz = y * Math.sin(rx),
      xx = x * Math.cos(ry) + zz * Math.sin(ry),
      z = -x * Math.sin(ry) + zz * Math.cos(ry),
      w = (2200 - z) / 2200;
    const dx = xx * Math.cos(rz) - yy * Math.sin(rz),
      dy = xx * Math.sin(rz) + yy * Math.cos(rz);
    data.push((cx / 540 - 1) * w + dx / 540, (1 - cy / 960) * w - dy / 960, 0, w, u, v);
  }
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screen);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  ctx.drawImage(plane, 0, 0);
}
function project(x, y, cx, cy, rx, ry, rz) {
  const yy = y * Math.cos(rx),
    zz = y * Math.sin(rx),
    xx = x * Math.cos(ry) + zz * Math.sin(ry),
    z = -x * Math.sin(ry) + zz * Math.cos(ry),
    persp = 2200 / (2200 - z);
  return {
    x: cx + (xx * Math.cos(rz) - yy * Math.sin(rz)) * persp,
    y: cy + (xx * Math.sin(rz) + yy * Math.cos(rz)) * persp,
  };
}
function drawCard(img, cam, s, t, offset = 0, alpha = 1) {
  const enter = s.id === 'gobble' || s.id === 'stash' ? 1 : spring((t - s.a) * 1.2),
    cx = 540 + offset,
    cy = 1040 + (1 - enter) * 180;
  let sw = 1440 / cam.z,
    sh = 1100 / cam.z,
    sx = clamp(cam.x - sw / 2, 0, 1440 - sw),
    sy = clamp(cam.y - sh / 2, 0, 1100 - sh);
  sc.fillStyle = s.bg;
  sc.fillRect(0, 0, 1040, 795);
  sc.drawImage(img, sx, sy, sw, sh, 0, 0, 1040, 795);
  const rx = Math.sin(t * 0.8) * 0.055,
    ry = Math.sin(t * 0.55 + 1) * 0.085,
    rz = Math.sin(t * 0.7) * 0.022;
  const proj = (x, y) => project(x - 520, y - 397.5, cx, cy, rx, ry, rz);
  const corners = [proj(0, 0), proj(1040, 0), proj(1040, 795), proj(0, 795)];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.shadowColor = '#21112f35';
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  renderPlane(cx, cy, rx, ry, rz);
  ctx.restore();
}
function tab(x, y, w, title, color, rotation, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.shadowColor = '#170a3033';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 10;
  rect(-w / 2, -85, w, 170, 23, color);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  label('↗  ' + title, -w / 2 + 28, -25, C.plum, 27);
  ctx.strokeStyle = '#39245a29';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 25, -6);
  ctx.lineTo(w / 2 - 25, -6);
  ctx.stroke();
  text('wait, this exists?', -w / 2 + 28, 43, 31, C.plum);
  ctx.restore();
}
function opening(t) {
  const labels = [
    'the one with the thing',
    'saved for later',
    'wait where was it',
    'another good tab',
    'that app from a reel',
  ];
  for (let i = 0; i < 5; i++) {
    let pop = spring(t - i * 0.09),
      x = 540 + Math.sin(i * 2.9) * 280,
      y = 530 + i * 125;
    tab(
      x + (1 - pop) * 500,
      y,
      610,
      labels[i],
      [C.lilac, C.paper, C.sky, C.orange, C.butter][i],
      Math.sin(i) * 0.1 + Math.sin(t * 1.3 + i) * 0.025,
      pop,
    );
  }
  ctx.fillStyle = '#39245a94';
  ctx.fillRect(0, 400, 1080, 980);
  if (t < 1.2) {
    let p = spring(t);
    ctx.save();
    ctx.translate(540, 850);
    ctx.scale(p, p);
    text('40', 0, 0, 400, C.butter, 'center');
    text('TABS.', 0, 155, 155, C.paper, 'center');
    ctx.restore();
  } else if (t < 2.65) {
    let p = spring(t - 1.2);
    ctx.save();
    ctx.translate(540, 780);
    ctx.scale(p, p);
    text('12', 0, 0, 340, C.orange, 'center');
    text('SAVED REELS.', 0, 150, 110, C.paper, 'center');
    ctx.restore();
  } else {
    let p = spring(t - 2.65);
    ctx.save();
    ctx.translate(540, 760);
    ctx.scale(p, p);
    text('WHERE', 0, 0, 177, C.butter, 'center');
    text('WAS IT?', 0, 180, 177, C.butter, 'center');
    ctx.restore();
    star(885, 1140, 85, t, C.orange);
  }
  label('YOUR INTERNET IS GETTING A LITTLE LOUD.', 540, 1330, C.lilac, 25, 'center');
}
function header(s, t) {
  label(s.label, 66, 286, s.fg, 23);
  s.lines.forEach((line, i) => {
    let p = spring(t - s.a - i * 0.05);
    ctx.save();
    ctx.translate(65, 400 + i * 116 + (1 - p) * 70);
    ctx.scale(1 + (1 - p) * 0.02, 1);
    text(line, 0, 0, line.length > 12 ? 105 : 122, s.fg);
    ctx.restore();
  });
  star(970, 490, 35, t * 0.45, C.orange);
}
function kinetic(t, s) {
  if (!window.showCaptions) return;
  const cap = captions.find((c) => t >= c.start && t < c.end);
  if (!cap) return;
  let font = 66;
  ctx.font = `800 ${font}px Bricolage`;
  let total = cap.words.reduce((v, w) => v + ctx.measureText(w.word).width + 17, 0) - 17;
  if (total > 906) {
    font *= 906 / total;
    ctx.font = `800 ${font}px Bricolage`;
    total = cap.words.reduce((v, w) => v + ctx.measureText(w.word).width + 17, 0) - 17;
  }
  const y = 1564;
  rect(540 - total / 2 - 30, y - font - 18, total + 60, font + 48, 25, C.plum);
  let x = 540 - total / 2;
  for (const w of cap.words) {
    const width = ctx.measureText(w.word).width;
    if (t >= w.start) {
      const age = t - w.start,
        p = spring(age * 1.4),
        active = t < w.end + 0.06;
      ctx.save();
      ctx.translate(x + width / 2, y);
      ctx.scale(0.82 + 0.18 * p, 0.82 + 0.18 * p);
      if (active) rect(-width / 2 - 8, -font + 4, width + 16, font + 13, 11, C.orange);
      text(w.word, 0, (1 - p) * 20, font, active ? C.plum : C.paper, 'center');
      ctx.restore();
    }
    x += width + 17;
  }
}
function payoff(t) {
  const u = t - 32;
  star(910, 520, 120, t, C.orange);
  if (u < 1.25) {
    let p = spring(u);
    ctx.save();
    ctx.translate(540, 780);
    ctx.scale(p, p);
    text('LESS', 0, 0, 230, C.butter, 'center');
    text('DOOMSCROLL.', 0, 155, 106, C.paper, 'center');
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(85, 895);
    ctx.lineTo(995, 895);
    ctx.stroke();
    ctx.restore();
  } else {
    let p = spring(u - 1.25);
    ctx.save();
    ctx.translate(540, 710);
    ctx.rotate(-0.035);
    ctx.scale(p, p);
    text('YO,', 0, 0, 270, C.orange, 'center');
    text('LOOK AT', 0, 190, 155, C.butter, 'center');
    text('THIS.', 0, 375, 240, C.butter, 'center');
    ctx.restore();
  }
  mascot(130, 1225, 130, t, C.lilac);
}
function ending(t) {
  const u = t - 35;
  let p = spring(u * 0.8);
  ctx.save();
  ctx.translate(540, 700 + (1 - p) * 180);
  ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p);
  ctx.fillStyle = C.lilac;
  ctx.beginPath();
  ctx.arc(0, 0, 290, 0, Math.PI * 2);
  ctx.fill();
  mascot(0, 0, 475, t);
  ctx.restore();
  star(900, 570, 70, t * 0.5, C.orange);
  text('YOUR NEXT', 540, 1120, 117, C.plum, 'center');
  text('OBSESSION.', 540, 1240, 132, C.plum, 'center');
  const q = spring(u - 0.65);
  ctx.save();
  ctx.translate(540, 1360 + (1 - q) * 50);
  ctx.scale(q, q);
  rect(-462, -65, 924, 122, 61, C.plum);
  text('tadgobble.web.app', 0, 15, 72, C.butter, 'center', 700);
  ctx.restore();
  label('DISCOVER SOMETHING GOOD. SHARE YOUR THING.', 540, 1480, C.plum, 25, 'center');
  label('AI-generated voiceover · Demo catalog', 540, 1680, C.plum, 25, 'center');
}
const grain = document.createElement('canvas');
grain.width = 240;
grain.height = 426;
const gc = grain.getContext('2d');
const noise = gc.createImageData(240, 426);
let seed = 42;
for (let i = 0; i < noise.data.length; i += 4) {
  seed = (seed * 16807) % 2147483647;
  noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = seed % 256;
  noise.data[i + 3] = 15;
}
gc.putImageData(noise, 0, 0);
window.showCaptions = true;
window.renderFrame = async function (frame) {
  const t = Math.min(39.999, frame / 60),
    s = scenes.find((s) => t >= s.a && t < s.b) || scenes.at(-1);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, 1080, 1920);
  branding(s, t);
  if (s.id === 'opening') opening(t);
  else if (s.id === 'payoff') payoff(t);
  else if (s.id === 'end') ending(t);
  else {
    header(s, t);
    const raw = sourceTime(s, t),
      clip = take(s.clip);
    let idx = 0;
    for (let i = 0; i < clip.frames.length; i++) {
      if (clip.frames[i].t <= raw) idx = i;
      else break;
    }
    const img = await getImage(clip.frames[idx].file),
      cam = camera(s, t),
      prior = camera(s, Math.max(s.a, t - 1 / 60));
    let velocity = Math.hypot(cam.x - prior.x, cam.y - prior.y) + Math.abs(cam.z - prior.z) * 250;
    // Temporal accumulation on fast camera moves, with a crisp final sample.
    if (velocity > 7) {
      drawCard(img, prior, s, t - 1 / 120, -Math.min(16, velocity * 0.35), 0.16);
      drawCard(img, cam, s, t, 0, 0.9);
    } else drawCard(img, cam, s, t);
    rect(72, 1380, 188, 42, 21, C.plum);
    label('Demo catalog', 166, 1408, C.paper, 22, 'center');
  }
  kinetic(t, s);
  ctx.globalAlpha = 0.45;
  ctx.drawImage(grain, 0, 0, 1080, 1920);
  ctx.globalAlpha = 1;
  // A fast diagonal brand wipe hides cuts while leaving held frames crisp.
  const dt = t - s.a;
  if (s.a > 0 && dt < 0.2) {
    const q = dt / 0.2;
    ctx.save();
    ctx.translate(lerp(-1500, 1800, q), 0);
    ctx.rotate(-0.16);
    ctx.fillStyle = C.orange;
    ctx.fillRect(-110, -200, 260, 2400);
    ctx.restore();
  }
  const barY = 1760;
  ctx.fillStyle = s.fg + '22';
  ctx.fillRect(66, barY, 948, 4);
  ctx.fillStyle = s.fg;
  ctx.fillRect(66, barY, (948 * t) / 40, 4);
  label('GOOD FINDS. QUESTIONABLE SCREEN TIME.', 66, 1810, s.fg, 21);
  label(
    String(Math.min(12, scenes.indexOf(s) + 1)).padStart(2, '0') + ' / 12',
    1014,
    1810,
    s.fg,
    21,
    'right',
  );
  return { time: t, scene: s.id };
};
const audio = document.querySelector('#audio'),
  button = document.querySelector('#play'),
  scrub = document.querySelector('#scrub'),
  display = document.querySelector('#time');
let playing = false,
  busy = false;
async function draw(t) {
  if (busy) return;
  busy = true;
  await window.renderFrame(Math.round(t * 60));
  scrub.value = t;
  display.textContent = '00:' + t.toFixed(2).padStart(5, '0');
  busy = false;
}
button.onclick = () => {
  playing = !playing;
  button.textContent = playing ? 'Pause' : 'Play the edit ↗';
  if (playing) audio.play();
  else audio.pause();
};
scrub.oninput = () => {
  audio.currentTime = +scrub.value;
  draw(+scrub.value);
};
document.querySelector('#captions').onchange = (e) => {
  window.showCaptions = e.target.checked;
  draw(+scrub.value);
};
for (const s of scenes) {
  const b = document.createElement('button');
  b.textContent = `${String(s.a).padStart(2, '0')}s  ${s.id}`;
  b.onclick = () => {
    audio.currentTime = s.a + 0.25;
    draw(s.a + 0.25);
  };
  document.querySelector('#scenes').append(b);
}
async function tick() {
  if (playing) {
    await draw(audio.currentTime);
    if (audio.ended) {
      playing = false;
      button.textContent = 'Play again ↗';
      audio.currentTime = 0;
    }
  }
  requestAnimationFrame(tick);
}
await draw(0);
window.ready = true;
tick();
