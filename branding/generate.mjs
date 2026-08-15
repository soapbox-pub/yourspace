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

// ---------------------------------------------------------- glossy clip-art
// The mid-2000s glitter-graphic look: gradient fill, dark outline, white
// gloss highlight. These are smooth vectors, not pixel art.

function lighten(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * f);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function glossDefs(colors) {
  let d = '<defs>';
  for (const [id, c] of Object.entries(colors)) {
    d += `<linearGradient id="g_${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(c, 0.55)}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
  }
  d += `<linearGradient id="g_silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F4FC"/><stop offset="1" stop-color="#B9BFD8"/></linearGradient>`;
  d += '</defs>';
  return d;
}

function starPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function glossyStar(cx, cy, r, id, rotDeg = 0) {
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy})">`;
  out += `<polygon points="${starPts(cx, cy, r)}" fill="url(#g_${id})" stroke="${C.navyEdge}" stroke-width="${(r * 0.12).toFixed(1)}" stroke-linejoin="round"/>`;
  out += `<circle cx="${cx - r * 0.28}" cy="${cy - r * 0.3}" r="${(r * 0.16).toFixed(1)}" fill="#FFFFFF" opacity="0.65"/>`;
  out += `</g>`;
  return out;
}

const HEART_PATH = 'M50 30 C50 12 32 4 22 13 C10 24 12 42 26 54 L50 78 L74 54 C88 42 90 24 78 13 C68 4 50 12 50 30 Z';

function glossyHeart(cx, cy, size, id, rotDeg = 0) {
  const sc = (size / 100).toFixed(3);
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy}) translate(${cx - size / 2} ${cy - size / 2}) scale(${sc})">`;
  out += `<path d="${HEART_PATH}" fill="url(#g_${id})" stroke="${C.navyEdge}" stroke-width="7" stroke-linejoin="round"/>`;
  out += `<ellipse cx="33" cy="27" rx="11" ry="7" fill="#FFFFFF" opacity="0.55" transform="rotate(-22 33 27)"/>`;
  out += `</g>`;
  return out;
}

// emo broken heart: the same heart split in two halves, pulled apart at the crack
function glossyBrokenHeart(cx, cy, size, id, rotDeg = 0) {
  const sc = (size / 100).toFixed(3);
  const L = 'M50 30 C50 12 32 4 22 13 C10 24 12 42 26 54 L50 78 L46 66 L56 54 L46 42 L54 34 Z';
  const R = 'M50 30 C50 12 68 4 78 13 C90 24 88 42 74 54 L50 78 L56 66 L46 54 L56 42 L44 34 Z';
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy}) translate(${cx - size / 2} ${cy - size / 2}) scale(${sc})">`;
  out += `<g transform="rotate(-7 50 50) translate(-4 0)"><path d="${L}" fill="url(#g_${id})" stroke="${C.navyEdge}" stroke-width="7" stroke-linejoin="round"/>`;
  out += `<ellipse cx="30" cy="26" rx="9" ry="6" fill="#FFFFFF" opacity="0.55" transform="rotate(-22 30 26)"/></g>`;
  out += `<g transform="rotate(8 50 50) translate(4 0)"><path d="${R}" fill="url(#g_${id})" stroke="${C.navyEdge}" stroke-width="7" stroke-linejoin="round"/></g>`;
  out += `</g>`;
  return out;
}

// scene lightning bolt
function glossyBolt(cx, cy, size, id, rotDeg = 0) {
  const sc = (size / 100).toFixed(3);
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy}) translate(${cx - size / 2} ${cy - size / 2}) scale(${sc})">`;
  out += `<polygon points="55,5 15,55 40,55 45,95 85,45 60,45" fill="url(#g_${id})" stroke="${C.navyEdge}" stroke-width="6" stroke-linejoin="round"/>`;
  out += `<circle cx="45" cy="28" r="8" fill="#FFFFFF" opacity="0.6"/>`;
  out += `</g>`;
  return out;
}

// cute scene skull with a hair bow
function glossySkull(cx, cy, size, rotDeg = 0) {
  const sc = (size / 100).toFixed(3);
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy}) translate(${cx - size / 2} ${cy - size / 2}) scale(${sc})">`;
  out += `<path d="M50 8 C28 8 16 24 16 42 C16 54 22 62 30 66 L30 80 C30 85 34 88 39 88 L61 88 C66 88 70 85 70 80 L70 66 C78 62 84 54 84 42 C84 24 72 8 50 8 Z" fill="#F2F4FC" stroke="${C.navyEdge}" stroke-width="6" stroke-linejoin="round"/>`;
  out += `<ellipse cx="36" cy="44" rx="9" ry="12" fill="${C.navy}"/>`;
  out += `<ellipse cx="64" cy="44" rx="9" ry="12" fill="${C.navy}"/>`;
  out += `<path d="M50 56 L45 64 L55 64 Z" fill="${C.navy}"/>`;
  out += `<rect x="42" y="72" width="3" height="12" fill="${C.navy}"/>`;
  out += `<rect x="48.5" y="72" width="3" height="12" fill="${C.navy}"/>`;
  out += `<rect x="55" y="72" width="3" height="12" fill="${C.navy}"/>`;
  // bow, top right
  out += `<g transform="translate(74 14) rotate(18)">`;
  out += `<polygon points="0,0 -17,-10 -15,8" fill="url(#g_pink)" stroke="${C.navyEdge}" stroke-width="4" stroke-linejoin="round"/>`;
  out += `<polygon points="0,0 17,-10 15,8" fill="url(#g_pink)" stroke="${C.navyEdge}" stroke-width="4" stroke-linejoin="round"/>`;
  out += `<circle r="5" fill="url(#g_pink)" stroke="${C.navyEdge}" stroke-width="4"/>`;
  out += `</g>`;
  out += `</g>`;
  return out;
}

// shooting star with three tapering trails
function shootingStar(x, y, r, id) {
  let out = '';
  const trails = [[0, 0, C.white], [14, 12, C.pink], [-12, 14, C.cyan]];
  for (const [dx, dy, c] of trails) {
    out += `<polygon points="${x - 6 + dx},${y + 2 + dy} ${x - 95 + dx * 2},${y - 62 + dy * 2} ${x + 4 + dx},${y - 4 + dy}" fill="${c}" opacity="0.55"/>`;
  }
  out += glossyStar(x, y, r, id, 15);
  return out;
}

// beamed pair of eighth notes
function glossyNote(cx, cy, size, color, rotDeg = 0) {
  const sc = (size / 100).toFixed(3);
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy}) translate(${cx - size / 2} ${cy - size / 2}) scale(${sc})">`;
  out += `<polygon points="34,26 96,16 96,32 34,42" fill="${color}"/>`;
  out += `<rect x="34" y="30" width="7" height="52" fill="${color}"/>`;
  out += `<rect x="89" y="24" width="7" height="48" fill="${color}"/>`;
  out += `<ellipse cx="28" cy="84" rx="15" ry="10" fill="${color}" transform="rotate(-20 28 84)"/>`;
  out += `<ellipse cx="84" cy="74" rx="15" ry="10" fill="${color}" transform="rotate(-20 84 74)"/>`;
  out += `<ellipse cx="24" cy="81" rx="5" ry="3" fill="#FFFFFF" opacity="0.6" transform="rotate(-20 24 81)"/>`;
  out += `</g>`;
  return out;
}

function smoothRainbow(cx, cy, r, w) {
  const colors = [C.pink, C.orange, C.yellow, C.lime, C.cyan, C.violet];
  let out = '';
  colors.forEach((c, i) => {
    const rr = r - i * w;
    out += `<path d="M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  });
  return out;
}

function cloud(cx, cy, sc) {
  let out = `<g transform="translate(${cx} ${cy}) scale(${sc})">`;
  out += `<circle cx="-34" cy="4" r="26" fill="#FFFFFF"/>`;
  out += `<circle cx="0" cy="-12" r="34" fill="#FFFFFF"/>`;
  out += `<circle cx="34" cy="4" r="26" fill="#FFFFFF"/>`;
  out += `<rect x="-40" y="4" width="80" height="24" rx="12" fill="#FFFFFF"/>`;
  out += `</g>`;
  return out;
}

function smoothSmiley(cx, cy, r, face, feature) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}"/>`;
  out += `<ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.2}" rx="${r * 0.12}" ry="${r * 0.2}" fill="${feature}"/>`;
  out += `<ellipse cx="${cx + r * 0.35}" cy="${cy - r * 0.2}" rx="${r * 0.12}" ry="${r * 0.2}" fill="${feature}"/>`;
  out += `<path d="M ${cx - r * 0.5} ${cy + r * 0.15} Q ${cx} ${cy + r * 0.65} ${cx + r * 0.5} ${cy + r * 0.15}" fill="none" stroke="${feature}" stroke-width="${(r * 0.13).toFixed(1)}" stroke-linecap="round"/>`;
  return out;
}

function smoothCD(cx, cy, r) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g_silver)" stroke="#8890B0" stroke-width="3"/>`;
  const sectors = [[C.cyan, 0], [C.pink, 90], [C.yellow, 180], [C.violet, 270]];
  for (const [c, a0] of sectors) {
    const a = (a0 * Math.PI) / 180;
    const b = a + Math.PI / 2;
    out += `<path d="M ${cx} ${cy} L ${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)} A ${r} ${r} 0 0 1 ${(cx + r * Math.cos(b)).toFixed(1)} ${(cy + r * Math.sin(b)).toFixed(1)} Z" fill="${c}" opacity="0.18"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.32).toFixed(1)}" fill="#FFFFFF"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.14).toFixed(1)}" fill="${C.navy}"/>`;
  out += `<ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.4}" rx="${(r * 0.3).toFixed(1)}" ry="${(r * 0.14).toFixed(1)}" fill="#FFFFFF" opacity="0.5" transform="rotate(-30 ${cx - r * 0.35} ${cy - r * 0.4})"/>`;
  return out;
}

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

// ================================================================ BACKGROUND
// Wallpaper for the Ditto theme, in the language of an actual 2005 MySpace
// profile: a dithered purple sky, glossy glitter clip-art (stars, hearts,
// sparkles, music notes, a CD, a rainbow with clouds), a zebra ribbon, a
// profile-views counter, a watermark smiley, and faint CRT scanlines.
function background() {
  const W = 1920;
  const H = 1080;
  let s = svgOpen(W, H);
  const rnd = lcg(20040815);
  const jig = (range) => (rnd() - 0.5) * 2 * range;
  const ids = { pink: C.pink, cyan: C.cyan, yellow: C.yellow, lime: C.lime, violet: C.violet, orange: C.orange, black: '#2A1245' };
  const names = Object.keys(ids);
  s += glossDefs(ids);

  // ---- dithered sky
  s += ditherSky(W, H, 10, ['#5B2B90', '#4A1D7A', '#3E1568', '#2C0B4E']);

  // smooth shapes get their own antialiasing
  s += `<g shape-rendering="auto">`;

  // ---- watermark smiley, tucked behind the zebra ribbon
  s += `<g opacity="0.4">${smoothSmiley(1680, 740, 170, '#8A52C9', '#3A1260')}</g>`;

  // ---- zebra ribbon across the lower third
  s += `<g transform="rotate(10 960 840)">${zebraBand(-200, 795, 2400, 90)}</g>`;

  // ---- rainbow with cloud ends, top right
  s += smoothRainbow(1440, 300, 210, 22);
  s += cloud(1225, 300, 1);
  s += cloud(1655, 300, 0.85);

  // ---- brand sparkle cluster, top left (the favicon mark, big)
  s += sparkle(260, 190, 290, C.navyEdge);
  s += sparkle(260, 190, 260, C.pink);
  s += sparkle(420, 90, 110, C.cyan);
  s += sparkle(120, 320, 74, C.yellow);

  // ---- CD (Myspace Music) with notes drifting off it
  s += smoothCD(700, 190, 82);
  s += glossyNote(870, 300, 80, C.cyan, 14);
  s += glossyNote(1120, 430, 92, C.violet, -10);
  s += glossyNote(530, 690, 76, C.lime, -8);
  s += glossyNote(1630, 560, 68, C.pink, 10);

  // ---- glitter clusters (like tiled glitter-GIF stamps)
  const clusters = [[620, 300], [1030, 620], [1450, 480], [170, 580], [880, 960]];
  clusters.forEach(([cx, cy], ci) => {
    s += glossyStar(cx, cy, 30 + rnd() * 10, names[ci % names.length], jig(20));
    for (let i = 0; i < 3; i++) {
      s += sparkle(cx + jig(90), cy + jig(90), 24 + rnd() * 28, ids[names[(ci + i + 1) % names.length]]);
    }
    for (let i = 0; i < 4; i++) {
      s += sparkle(cx + jig(110), cy + jig(110), 10 + rnd() * 8, '#FFFFFF');
    }
    if (ci % 2 === 0) s += glossyHeart(cx + jig(80), cy + 70 + jig(20), 44, names[(ci + 3) % names.length], jig(16));
  });

  // ---- standalone glossy bits
  s += glossyHeart(1790, 110, 76, 'pink', 12);
  s += glossyHeart(1690, 190, 56, 'black', -10);
  s += glossyBrokenHeart(360, 460, 112, 'pink', -6);
  s += glossyBolt(1240, 640, 80, 'yellow', 8);
  s += glossyBolt(95, 655, 58, 'cyan', -12);
  s += glossySkull(1160, 160, 100, 8);
  s += shootingStar(615, 105, 26, 'yellow');
  s += glossyStar(965, 130, 26, 'yellow', 12);
  s += glossyStar(70, 800, 22, 'lime', -8);

  // ---- glitter dust
  for (let i = 0; i < 26; i++) {
    s += `<circle cx="${Math.round(rnd() * W)}" cy="${Math.round(rnd() * H)}" r="${(2 + rnd() * 2.5).toFixed(1)}" fill="#FFFFFF" opacity="${(0.3 + rnd() * 0.4).toFixed(2)}"/>`;
  }

  s += `</g>`;

  // ---- profile views counter
  s += `<g transform="rotate(-3 250 962)">`;
  s += `<rect x="136" y="926" width="228" height="72" fill="${C.btnLo}"/>`;
  s += `<rect x="140" y="930" width="220" height="64" fill="#000000"/>`;
  s += pixelText('0071337', 156, 944, 4, '#39FF14');
  s += `</g>`;

  // ---- CRT scanlines
  s += `<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000000"/></pattern></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scan)" opacity="0.06"/>`;

  s += '</svg>';
  return s;
}

writeFileSync(join(OUT, 'avatar.svg'), avatar());
writeFileSync(join(OUT, 'banner.svg'), banner());
writeFileSync(join(OUT, 'og-image.svg'), og());
writeFileSync(join(OUT, 'background.svg'), background());
console.log('wrote avatar.svg + banner.svg + og-image.svg + background.svg');
