// Generates the YourSpace social avatar and banner as pixel-art SVGs.
// Everything is drawn from a hand-defined 5x7 pixel font and pixel stamps,
// so the output looks like it came out of MS Paint circa 2004.
// Run: node branding/generate.mjs   (then rsvg-convert the SVGs to PNG)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- palette
const C = {
  purpleA: '#4A1D7A',
  purpleB: '#3E1568',
  navy: '#131A3A',
  navyBar: '#1B2350',
  navyEdge: '#0C1130',
  barHi: '#3A4A8C',
  pink: '#FF2D9E',
  orange: '#FF8A00',
  yellow: '#FFD400',
  lime: '#8FE800',
  cyan: '#00D9FF',
  blue: '#4D7CFF',
  violet: '#B14DFF',
  white: '#FFFFFF',
  lavender: '#D9C8FF',
  green: '#2EE86C',
  btnFace: '#C9CFE8',
  btnHi: '#F0F3FF',
  btnLo: '#6B7399',
};

// ---------------------------------------------------------------- pixel font
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.####'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '/': ['..#', '..#', '.#.', '.#.', '.#.', '#..', '#..'],
  '*': ['..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....', '.....'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  '\u2665': ['.#.#.', '#####', '#####', '.###.', '..#..', '.....', '.....'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

const charW = (ch) => (FONT[ch] ?? FONT[' '])[0].length;

// width in pixel-columns of a string (1 col gap between chars)
function textCols(text) {
  let w = 0;
  for (const ch of text) w += charW(ch) + 1;
  return w - 1;
}

// Draw one glyph as merged horizontal-run rects.
function glyphRects(ch, x, y, s, fill) {
  const rows = FONT[ch] ?? FONT[' '];
  let out = '';
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (row[c] === '#') {
        let run = c;
        while (run < row.length && row[run] === '#') run++;
        out += `<rect x="${x + c * s}" y="${y + r * s}" width="${(run - c) * s}" height="${s}" fill="${fill}"/>`;
        c = run;
      } else c++;
    }
  });
  return out;
}

// fills: a single color, or an array cycled per character.
// jitter: array of per-char dy offsets in px.
function pixelText(text, x, y, s, fills, jitter = []) {
  const palette = Array.isArray(fills) ? fills : [fills];
  let out = '';
  let cx = x;
  let i = 0;
  for (const ch of text) {
    const dy = jitter[i % (jitter.length || 1)] ?? 0;
    if (ch !== ' ') out += glyphRects(ch, cx, y + dy, s, palette[i % palette.length]);
    cx += (charW(ch) + 1) * s;
    if (ch !== ' ') i++;
  }
  return out;
}

// Outlined headline: black copies at 8 offsets + drop shadow, color on top.
function outlinedText(text, x, y, s, fills, jitter, o, shadowDx, shadowDy, shadowColor) {
  let out = pixelText(text, x + shadowDx, y + shadowDy, s, shadowColor, jitter);
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [-o, o], [o, -o], [o, o]]) {
    out += pixelText(text, x + dx, y + dy, s, '#000000', jitter);
  }
  out += pixelText(text, x, y, s, fills, jitter);
  return out;
}

// ---------------------------------------------------------------- stamps
// 4-point sparkle, size = full width in px
function sparkle(x, y, size, fill) {
  const h = size / 2;
  const q = size / 7;
  return `<path d="M ${x} ${y - h} Q ${x + q} ${y - q} ${x + h} ${y} Q ${x + q} ${y + q} ${x} ${y + h} Q ${x - q} ${y + q} ${x - h} ${y} Q ${x - q} ${y - q} ${x} ${y - h} Z" fill="${fill}"/>`;
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
function pixelHeart(x, y, s, fill) {
  let out = '';
  HEART.forEach((row, r) => {
    [...row].forEach((p, c) => {
      if (p === '#') out += `<rect x="${x + c * s}" y="${y + r * s}" width="${s}" height="${s}" fill="${fill}"/>`;
    });
  });
  return out;
}

function checker(x, y, w, h, cell, a, b) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${a}"/>`;
  for (let r = 0; r * cell < h; r++) {
    for (let c = 0; c * cell < w; c++) {
      if ((r + c) % 2 === 1) {
        const cw = Math.min(cell, w - c * cell);
        const ch = Math.min(cell, h - r * cell);
        out += `<rect x="${x + c * cell}" y="${y + r * cell}" width="${cw}" height="${ch}" fill="${b}"/>`;
      }
    }
  }
  return out;
}

// 16x16 pixel smiley face (yellow on transparent, features punched in `bg`)
const FACE_SPANS = [
  [5, 10], [3, 12], [2, 13], [1, 14], [1, 14], [0, 15], [0, 15], [0, 15],
  [0, 15], [0, 15], [0, 15], [1, 14], [1, 14], [2, 13], [3, 12], [5, 10],
];
function smiley(x, y, s, faceFill, featureFill) {
  let out = '';
  FACE_SPANS.forEach(([a, b], r) => {
    out += `<rect x="${x + a * s}" y="${y + r * s}" width="${(b - a + 1) * s}" height="${s}" fill="${faceFill}"/>`;
  });
  const px = (c, r, w = 1) =>
    `<rect x="${x + c * s}" y="${y + r * s}" width="${w * s}" height="${s}" fill="${featureFill}"/>`;
  // eyes
  out += px(4, 5, 2) + px(4, 6, 2) + px(10, 5, 2) + px(10, 6, 2);
  // smile
  out += px(3, 9) + px(12, 9) + px(4, 10) + px(11, 10) + px(5, 11, 6);
  return out;
}

// bevelled 90s window button
function winButton(x, y, size, glyph) {
  const e = Math.round(size / 7);
  let out = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${C.btnFace}"/>`;
  out += `<rect x="${x}" y="${y}" width="${size}" height="${e}" fill="${C.btnHi}"/>`;
  out += `<rect x="${x}" y="${y}" width="${e}" height="${size}" fill="${C.btnHi}"/>`;
  out += `<rect x="${x}" y="${y + size - e}" width="${size}" height="${e}" fill="${C.btnLo}"/>`;
  out += `<rect x="${x + size - e}" y="${y}" width="${e}" height="${size}" fill="${C.btnLo}"/>`;
  const g = C.navyEdge;
  const m = e * 2;
  if (glyph === '_') {
    out += `<rect x="${x + m}" y="${y + size - m - e}" width="${size - 2 * m}" height="${e}" fill="${g}"/>`;
  } else if (glyph === 'o') {
    out += `<rect x="${x + m}" y="${y + m}" width="${size - 2 * m}" height="${e}" fill="${g}"/>`;
    out += `<rect x="${x + m}" y="${y + size - m - e}" width="${size - 2 * m}" height="${e}" fill="${g}"/>`;
    out += `<rect x="${x + m}" y="${y + m}" width="${e}" height="${size - 2 * m}" fill="${g}"/>`;
    out += `<rect x="${x + size - m - e}" y="${y + m}" width="${e}" height="${size - 2 * m}" fill="${g}"/>`;
  } else if (glyph === 'x') {
    for (let i = 0; i < 4; i++) {
      out += `<rect x="${x + m + i * e}" y="${y + m + i * e}" width="${e}" height="${e}" fill="${g}"/>`;
      out += `<rect x="${x + size - m - (i + 1) * e}" y="${y + m + i * e}" width="${e}" height="${e}" fill="${g}"/>`;
    }
  }
  return out;
}

// jagged starburst polygon
function starburst(cx, cy, rOuter, rInner, points, fill, stroke, strokeW, rot = 0) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (Math.PI * i) / points;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
}

const svgOpen = (w, h) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">`;

// deterministic RNG so the background is reproducible
function lcg(seed) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ================================================================ AVATAR
function avatar() {
  const W = 1000;
  let s = svgOpen(W, W);
  s += checker(0, 0, W, W, 50, C.purpleA, C.purpleB);

  // framed box: pink outer, cyan inner, navy fill
  s += `<rect x="110" y="110" width="780" height="780" fill="${C.pink}"/>`;
  s += `<rect x="134" y="134" width="732" height="732" fill="${C.cyan}"/>`;
  s += `<rect x="152" y="152" width="696" height="696" fill="${C.navy}"/>`;

  // smiley: 16 cols * 40 = 640, centered
  s += smiley(180, 180, 40, C.yellow, C.navy);

  // corner sparkles inside the navy box
  s += sparkle(232, 238, 90, C.lime);
  s += sparkle(776, 748, 110, C.pink);
  s += sparkle(748, 226, 54, C.white);
  s += pixelHeart(184, 744, 14, C.pink);

  s += '</svg>';
  return s;
}

// ================================================================ BANNER
function banner() {
  const W = 1500;
  const H = 500;
  const BAR = 48;
  const MARQ = 48;
  let s = svgOpen(W, H);

  // ---- title bar (old browser chrome)
  s += `<rect x="0" y="0" width="${W}" height="${BAR}" fill="${C.navyBar}"/>`;
  s += `<rect x="0" y="0" width="${W}" height="4" fill="${C.barHi}"/>`;
  s += `<rect x="0" y="${BAR - 4}" width="${W}" height="4" fill="${C.navyEdge}"/>`;
  s += sparkle(34, BAR / 2, 26, C.yellow);
  s += pixelText('YOURSPACE.LIVE - UR SPACE ONLINE', 62, 10, 4, C.lavender);
  s += winButton(1354, 10, 28, '_');
  s += winButton(1390, 10, 28, 'o');
  s += winButton(1426, 10, 28, 'x');

  // ---- content: purple checker
  s += checker(0, BAR, W, H - BAR - MARQ, 28, C.purpleA, C.purpleB);

  // scattered deco (kept off the text)
  s += sparkle(60, 100, 44, C.white);
  s += sparkle(1080, 90, 36, C.yellow);
  s += sparkle(650, 400, 30, C.cyan);
  s += pixelHeart(1035, 330, 8, C.pink);
  s += pixelHeart(30, 330, 7, C.violet);

  // ---- headline: YOURSPACE, rainbow letters, jitter, black outline
  const HEAD = 'YOURSPACE';
  const hs = 20;
  const hx = 70;
  const hy = 120;
  const rainbow = [C.pink, C.orange, C.yellow, C.lime, C.cyan, C.blue, C.violet, C.pink, C.orange];
  const jitter = [0, -8, 6, 0, -6, 10, -10, 6, 0];
  s += outlinedText(HEAD, hx, hy, hs, rainbow, jitter, 6, 12, 14, C.navyEdge);

  // ---- tagline
  const TAG = "A HOME PAGE THAT'S ACTUALLY YOURS !!";
  const cols = textCols(TAG);
  const ts = Math.floor(1020 / cols) || 4; // fit under the headline
  const tagY = hy + 7 * hs + 40;
  // last 7 non-space chars ("YOURS!!") pink, rest white
  const nChars = TAG.replace(/ /g, '').length;
  const tagFills = Array.from({ length: nChars }, (_, i) => (i >= nChars - 7 ? C.pink : C.white));
  s += pixelText(TAG, hx + 4, tagY, ts, tagFills);

  // ---- ONLINE NOW! pill
  const pillY = 372;
  s += `<rect x="70" y="${pillY}" width="330" height="56" rx="28" fill="${C.navy}"/>`;
  s += `<circle cx="106" cy="${pillY + 28}" r="12" fill="${C.green}"/>`;
  s += pixelText('ONLINE NOW!', 132, pillY + 12, 4, C.lime);

  // ---- smiley sticker, tilted, right side
  s += `<g transform="rotate(6 1240 240)">`;
  s += `<rect x="1130" y="130" width="220" height="220" fill="${C.pink}"/>`;
  s += `<rect x="1138" y="138" width="204" height="204" fill="${C.cyan}"/>`;
  s += `<rect x="1144" y="144" width="192" height="192" fill="${C.navy}"/>`;
  s += smiley(1152, 152, 11, C.yellow, C.navy);
  s += `</g>`;

  // ---- NEW! starburst overlapping the sticker
  s += starburst(1390, 120, 78, 44, 9, C.yellow, C.navyEdge, 6, 0.3);
  s += `<g transform="rotate(-8 1390 120)">${pixelText('NEW!', 1390 - (textCols('NEW!') * 5) / 2, 120 - 17, 5, C.pink)}</g>`;

  // ---- made w/ heart sticker
  s += `<g transform="rotate(-4 1300 400)">`;
  s += `<rect x="1190" y="378" width="220" height="48" fill="${C.white}" stroke="${C.pink}" stroke-width="5" stroke-dasharray="10 6"/>`;
  s += pixelText('MADE W/ \u2665', 1212, 390, 4, C.pink);
  s += `</g>`;

  // ---- marquee strip
  s += `<rect x="0" y="${H - MARQ}" width="${W}" height="${MARQ}" fill="${C.navy}"/>`;
  const MARQUEE = '*.:* WELCOME 2 YOURSPACE *:. UR OWN HOME PAGE ON NOSTR .:*';
  const ms = Math.floor((W - 60) / textCols(MARQUEE)) || 4;
  const mw = textCols(MARQUEE) * ms;
  s += pixelText(MARQUEE, (W - mw) / 2, H - MARQ + (MARQ - 7 * ms) / 2, ms, C.lime);

  s += '</svg>';
  return s;
}

// ================================================================ OG IMAGE
// Same look as the banner, re-laid out for the taller 1200x630 card.
function og() {
  const W = 1200;
  const H = 630;
  const BAR = 48;
  const MARQ = 48;
  let s = svgOpen(W, H);

  // ---- title bar
  s += `<rect x="0" y="0" width="${W}" height="${BAR}" fill="${C.navyBar}"/>`;
  s += `<rect x="0" y="0" width="${W}" height="4" fill="${C.barHi}"/>`;
  s += `<rect x="0" y="${BAR - 4}" width="${W}" height="4" fill="${C.navyEdge}"/>`;
  s += sparkle(34, BAR / 2, 26, C.yellow);
  s += pixelText('YOURSPACE.LIVE - UR SPACE ONLINE', 62, 10, 4, C.lavender);
  s += winButton(1054, 10, 28, '_');
  s += winButton(1090, 10, 28, 'o');
  s += winButton(1126, 10, 28, 'x');

  // ---- content: purple checker
  s += checker(0, BAR, W, H - BAR - MARQ, 28, C.purpleA, C.purpleB);

  // scattered deco (kept off the text)
  s += sparkle(48, 100, 40, C.white);
  s += sparkle(200, 440, 36, C.yellow);
  s += sparkle(700, 410, 30, C.white);
  s += sparkle(640, 470, 24, C.cyan);
  s += pixelHeart(420, 420, 8, C.violet);
  s += pixelHeart(30, 340, 7, C.pink);

  // ---- headline
  const HEAD = 'YOURSPACE';
  const hs = 18;
  const hx = 70;
  const hy = 115;
  const rainbow = [C.pink, C.orange, C.yellow, C.lime, C.cyan, C.blue, C.violet, C.pink, C.orange];
  const jitter = [0, -8, 6, 0, -6, 10, -10, 6, 0];
  s += outlinedText(HEAD, hx, hy, hs, rainbow, jitter, 6, 11, 13, C.navyEdge);

  // ---- tagline
  const TAG = "A HOME PAGE THAT'S ACTUALLY YOURS !!";
  const ts = Math.floor(1020 / textCols(TAG)) || 4;
  const tagY = hy + 7 * hs + 36;
  const nChars = TAG.replace(/ /g, '').length;
  const tagFills = Array.from({ length: nChars }, (_, i) => (i >= nChars - 7 ? C.pink : C.white));
  s += pixelText(TAG, hx + 4, tagY, ts, tagFills);

  // ---- ONLINE NOW! pill
  const pillY = 500;
  s += `<rect x="70" y="${pillY}" width="330" height="56" rx="28" fill="${C.navy}"/>`;
  s += `<circle cx="106" cy="${pillY + 28}" r="12" fill="${C.green}"/>`;
  s += pixelText('ONLINE NOW!', 132, pillY + 12, 4, C.lime);

  // ---- smiley sticker, tilted, lower right
  s += `<g transform="rotate(6 1030 430)">`;
  s += `<rect x="930" y="330" width="200" height="200" fill="${C.pink}"/>`;
  s += `<rect x="937" y="337" width="186" height="186" fill="${C.cyan}"/>`;
  s += `<rect x="943" y="343" width="174" height="174" fill="${C.navy}"/>`;
  s += smiley(950, 350, 10, C.yellow, C.navy);
  s += `</g>`;

  // ---- NEW! starburst, top right
  s += starburst(1090, 118, 72, 40, 9, C.yellow, C.navyEdge, 6, 0.3);
  s += `<g transform="rotate(-8 1090 118)">${pixelText('NEW!', 1090 - (textCols('NEW!') * 5) / 2, 118 - 17, 5, C.pink)}</g>`;

  // ---- made w/ heart sticker
  s += `<g transform="rotate(-3 690 529)">`;
  s += `<rect x="580" y="505" width="220" height="48" fill="${C.white}" stroke="${C.pink}" stroke-width="5" stroke-dasharray="10 6"/>`;
  s += pixelText('MADE W/ \u2665', 602, 517, 4, C.pink);
  s += `</g>`;

  // ---- marquee strip
  s += `<rect x="0" y="${H - MARQ}" width="${W}" height="${MARQ}" fill="${C.navy}"/>`;
  const MARQUEE = '*.:* WELCOME 2 YOURSPACE *:. UR OWN HOME PAGE ON NOSTR .:*';
  const ms = Math.floor((W - 60) / textCols(MARQUEE)) || 4;
  const mw = textCols(MARQUEE) * ms;
  s += pixelText(MARQUEE, (W - mw) / 2, H - MARQ + (MARQ - 7 * ms) / 2, ms, C.lime);

  s += '</svg>';
  return s;
}

// generic bitmap stamp (merged horizontal runs)
function stamp(rows, x, y, s, fill) {
  let out = '';
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (row[c] === '#') {
        let run = c;
        while (run < row.length && row[run] === '#') run++;
        out += `<rect x="${x + c * s}" y="${y + r * s}" width="${(run - c) * s}" height="${s}" fill="${fill}"/>`;
        c = run;
      } else c++;
    }
  });
  return out;
}

const STAR5 = [
  '.....#.....',
  '....###....',
  '....###....',
  '...#####...',
  '###########',
  '.#########.',
  '..#######..',
  '..#######..',
  '.####.####.',
  '##.......##',
];

const NOTE = [
  '....##.',
  '....###',
  '....#.#',
  '....#..',
  '....#..',
  '..###..',
  '.####..',
  '..##...',
];

// pixel rainbow arch: 1px bands radiating from the bottom-center
function rainbowArch(x, y, s) {
  const colors = [C.pink, C.orange, C.yellow, C.lime, C.cyan, C.violet];
  let out = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 16; c++) {
      const d = Math.hypot(c + 0.5 - 8, r + 0.5 - 8);
      if (d < 8 && d >= 2) {
        const band = Math.floor(8 - d);
        if (band < 6) out += `<rect x="${x + c * s}" y="${y + r * s}" width="${s}" height="${s}" fill="${colors[band]}"/>`;
      }
    }
  }
  return out;
}

// classic pointer arrow, 8x12
const ARROW = [
  '#.......',
  '##......',
  '###.....',
  '####....',
  '#####...',
  '######..',
  '#######.',
  '########',
  '###.....',
  '#.##....',
  '..##....',
  '...#....',
];

// ordered-dither vertical gradient (Bayer 4x4), the 256-color-GIF way
function ditherSky(W, H, cell, ramp) {
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const rows = Math.ceil(H / cell);
  const cols = Math.ceil(W / cell);
  let out = '';
  for (let r = 0; r < rows; r++) {
    const t = (r / rows) * (ramp.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    let c = 0;
    while (c < cols) {
      const pick = (cc) => (f > bayer[r % 4][cc % 4] / 16 ? ramp[Math.min(i + 1, ramp.length - 1)] : ramp[i]);
      const color = pick(c);
      let run = c;
      while (run < cols && pick(run) === color) run++;
      out += `<rect x="${c * cell}" y="${r * cell}" width="${(run - c) * cell}" height="${cell}" fill="${color}"/>`;
      c = run;
    }
  }
  return out;
}

// hot-pink zebra ribbon (drawn horizontally, rotated by the caller)
function zebraBand(bx, by, len, h) {
  let out = `<rect x="${bx}" y="${by}" width="${len}" height="${h}" fill="${C.pink}"/>`;
  for (let x = bx; x < bx + len; x += 44) {
    out += `<polygon points="${x},${by} ${x + 26},${by} ${x + 10},${by + h * 0.62}" fill="${C.navy}"/>`;
    out += `<polygon points="${x + 22},${by + h} ${x + 48},${by + h} ${x + 34},${by + h * 0.38}" fill="${C.navy}"/>`;
  }
  out += `<rect x="${bx}" y="${by}" width="${len}" height="5" fill="${C.navyEdge}"/>`;
  out += `<rect x="${bx}" y="${by + h - 5}" width="${len}" height="5" fill="${C.navyEdge}"/>`;
  return out;
}

// marquee ribbon: navy band, checker trim, repeating pixel text
function marqueeBand(bx, by, len, text) {
  const h = 78;
  let out = `<rect x="${bx}" y="${by}" width="${len}" height="${h}" fill="${C.navy}"/>`;
  out += checker(bx, by, len, 10, 10, C.pink, C.white);
  out += checker(bx, by + h - 10, len, 10, 10, C.white, C.pink);
  let repeated = text;
  while (textCols(repeated) * 4 < len + 400) repeated += text;
  out += pixelText(repeated, bx + 10, by + 25, 4, C.lime);
  return out;
}

// 88x31-style web button, scaled 2x
function webBadge(x, y, line1, line2, c1, c2) {
  const w = 176;
  const h = 62;
  let out = `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" fill="${C.btnHi}"/>`;
  out += `<rect x="${x + 2}" y="${y + 2}" width="${w + 2}" height="${h + 2}" fill="${C.btnLo}"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.navy}"/>`;
  out += pixelText(line1, x + (w - textCols(line1) * 2) / 2, y + 12, 2, c1);
  out += pixelText(line2, x + (w - textCols(line2) * 2) / 2, y + 34, 2, c2);
  return out;
}

// pixel CD with rainbow sheen
function pixelCD(x, y, s) {
  let out = '';
  FACE_SPANS.forEach(([a, b], r) => {
    out += `<rect x="${x + a * s}" y="${y + r * s}" width="${(b - a + 1) * s}" height="${s}" fill="${C.btnFace}"/>`;
  });
  const sheen = [
    [C.cyan, 0, 8, true], [C.pink, 0, 8, false], [C.yellow, 8, 16, true], [C.violet, 8, 16, false],
  ];
  for (const [color, r0, r1, left] of sheen) {
    for (let r = r0; r < r1; r++) {
      const [a, b] = FACE_SPANS[r];
      const from = left ? a : 8;
      const to = left ? 7 : b;
      if (to >= from) {
        out += `<rect x="${x + from * s}" y="${y + r * s}" width="${(to - from + 1) * s}" height="${s}" opacity="0.25" fill="${color}"/>`;
      }
    }
  }
  // hub: white ring, navy hole
  for (let r = 6; r <= 9; r++) out += `<rect x="${x + 6 * s}" y="${y + r * s}" width="${4 * s}" height="${s}" fill="${C.white}"/>`;
  for (let r = 7; r <= 8; r++) out += `<rect x="${x + 7 * s}" y="${y + r * s}" width="${2 * s}" height="${s}" fill="${C.navy}"/>`;
  return out;
}

// ================================================================ BACKGROUND
// Wallpaper for the Ditto theme, built like a 2005 MySpace profile someone
// customized at 1am: a dithered purple sky, a "thanks 4 the add" marquee
// ribbon and a zebra ribbon crossing the page, glitter clusters, old-web
// stickers (hit counter, 88x31 badges, pixel cursor, CD, equalizer), a giant
// watermark smiley, the brand sparkle, and faint CRT scanlines over it all.
function background() {
  const W = 1920;
  const H = 1080;
  let s = svgOpen(W, H);
  const rnd = lcg(20040815);
  const jig = (range) => (rnd() - 0.5) * 2 * range;
  const palette = [C.pink, C.cyan, C.yellow, C.lime, C.violet, C.orange];

  // ---- dithered sky
  s += ditherSky(W, H, 12, ['#5B2B90', '#4A1D7A', '#3E1568', '#2C0B4E']);

  // ---- giant watermark smiley, sliding off the bottom-right
  s += `<g opacity="0.5">${smiley(1500, 600, 22, '#8A52C9', '#2C0B4E')}</g>`;

  // ---- big pixel rainbow, top right
  s += rainbowArch(1330, 120, 15);

  // ---- brand sparkle cluster, top left (the favicon mark, big)
  s += sparkle(260, 190, 290, C.navyEdge);
  s += sparkle(260, 190, 260, C.pink);
  s += sparkle(420, 90, 110, C.cyan);
  s += sparkle(120, 320, 74, C.yellow);

  // ---- marquee ribbon
  s += `<g transform="rotate(-8 960 420)">${marqueeBand(-200, 381, 2400, '*.:* THANKS 4 THE ADD *.:* GET UR OWN SPACE ')}</g>`;

  // ---- zebra ribbon
  s += `<g transform="rotate(10 960 840)">${zebraBand(-200, 795, 2400, 90)}</g>`;

  // ---- old-web stickers
  s += `<g transform="rotate(2 258 631)">${webBadge(170, 600, 'GET UR OWN', 'SPACE 2DAY', C.lime, C.pink)}</g>`;
  s += `<g transform="rotate(-4 1738 331)">${webBadge(1650, 300, 'THANKS 4', 'THE ADD ♥', C.cyan, C.pink)}</g>`;

  // hit counter
  s += `<g transform="rotate(-3 250 962)">`;
  s += `<rect x="136" y="926" width="228" height="72" fill="${C.btnLo}"/>`;
  s += `<rect x="140" y="930" width="220" height="64" fill="#000000"/>`;
  s += pixelText('0071337', 156, 944, 4, '#39FF14');
  s += `</g>`;

  // equalizer chip
  s += `<g transform="rotate(3 1270 985)">`;
  s += `<rect x="1180" y="950" width="180" height="70" rx="8" fill="${C.navy}"/>`;
  const eq = [18, 34, 50, 26, 42, 58, 30, 46];
  eq.forEach((hh, i) => {
    s += `<rect x="${1192 + i * 20}" y="${1010 - hh}" width="12" height="${hh}" fill="${[C.lime, C.yellow, C.pink, C.cyan][i % 4]}"/>`;
  });
  s += `</g>`;

  // CD and a cursor pointing at things
  s += `<g transform="rotate(8 696 196)">${pixelCD(640, 140, 7)}</g>`;
  s += stamp(ARROW, 1054, 564, 6, C.navyEdge);
  s += stamp(ARROW, 1050, 560, 6, C.white);

  // ---- glitter clusters (glitter-GIF stamps, not uniform confetti)
  const clusters = [[620, 280], [1000, 560], [1300, 700], [170, 560], [850, 950]];
  clusters.forEach(([cx, cy], ci) => {
    const color = palette[ci % palette.length];
    const ss = 4 + Math.round(rnd() * 2);
    s += `<g transform="rotate(${jig(12).toFixed(1)} ${cx} ${cy})">${stamp(STAR5, cx - 5.5 * ss, cy - 5 * ss, ss, color)}</g>`;
    for (let i = 0; i < 3; i++) {
      s += sparkle(cx + jig(85), cy + jig(85), 22 + rnd() * 30, palette[(ci + i + 1) % palette.length]);
    }
    for (let i = 0; i < 3; i++) {
      const x = Math.round(cx + jig(100));
      const y = Math.round(cy + jig(100));
      const p = 4;
      s += `<g fill="${C.white}" opacity="0.8"><rect x="${x}" y="${y - p}" width="${p}" height="${p * 3}"/><rect x="${x - p}" y="${y}" width="${p * 3}" height="${p}"/></g>`;
    }
    if (ci % 2 === 0) s += pixelHeart(cx + jig(90), cy + 60 + jig(20), 6, palette[(ci + 3) % palette.length]);
  });

  // loose filler plusses and text bits
  for (let i = 0; i < 16; i++) {
    const x = Math.round(rnd() * W);
    const y = Math.round(rnd() * H);
    const p = 4;
    s += `<g fill="#9B6BD6" opacity="0.6"><rect x="${x}" y="${y - p}" width="${p}" height="${p * 3}"/><rect x="${x - p}" y="${y}" width="${p * 3}" height="${p}"/></g>`;
  }
  s += pixelText('XOXO', 1700, 80, 3, C.pink);
  s += pixelText('*!!*', 60, 1010, 3, C.yellow);
  s += `<g transform="rotate(-6 520 760)">${stamp(NOTE, 490, 730, 6, C.cyan)}</g>`;
  s += `<g transform="rotate(7 1620 900)">${stamp(NOTE, 1600, 880, 5, C.lime)}</g>`;

  // ---- CRT scanlines
  s += `<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000000"/></pattern></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scan)" opacity="0.07"/>`;

  s += '</svg>';
  return s;
}

writeFileSync(join(OUT, 'avatar.svg'), avatar());
writeFileSync(join(OUT, 'banner.svg'), banner());
writeFileSync(join(OUT, 'og-image.svg'), og());
writeFileSync(join(OUT, 'background.svg'), background());
console.log('wrote avatar.svg + banner.svg + og-image.svg + background.svg');
