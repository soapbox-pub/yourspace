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
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '/': ['..#', '..#', '.#.', '.#.', '.#.', '#..', '#..'],
  '*': ['..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....', '.....'],
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

writeFileSync(join(OUT, 'avatar.svg'), avatar());
writeFileSync(join(OUT, 'banner.svg'), banner());
console.log('wrote avatar.svg + banner.svg');
