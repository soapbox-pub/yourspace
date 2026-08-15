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
  const ids = { pink: C.pink, cyan: C.cyan, yellow: C.yellow, lime: C.lime, violet: C.violet, orange: C.orange, black: '#2A1245' };
  s += glossDefs(ids);
  s += `<rect x="0" y="0" width="${W}" height="${W}" fill="${C.purpleA}"/>`;

  // cute ghost holding a heart, front and center, nothing else
  s += `<g shape-rendering="auto">`;
  s += glossyGhost(500, 480, 560, 2);
  s += glossyHeart(700, 680, 140, 'pink', 12);
  s += `</g>`;

  s += '</svg>';
  return s;
}

// ================================================================ BANNER
// Profile banner (1500x500) in the glossy glitter clip-art style, matching
// the OG image and the Ditto background. Smooth chunky type, no pixel text.
function banner() {
  const W = 1500;
  const H = 500;
  let s = svgOpen(W, H);
  const ids = { pink: C.pink, cyan: C.cyan, yellow: C.yellow, lime: C.lime, violet: C.violet, orange: C.orange, black: '#2A1245' };
  s += glossDefs(ids);
  s += `<defs><linearGradient id="g_shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>`;

  // ---- dithered sky
  s += ditherSky(W, H, 10, ['#5B2B90', '#4A1D7A', '#3E1568', '#2C0B4E']);

  s += `<g shape-rendering="auto">`;

  // ---- zebra ribbon across the bottom
  s += `<g transform="rotate(4 750 470)">${zebraBand(-200, 425, 2000, 90)}</g>`;

  // ---- glossy art, right side
  s += smoothRainbow(1180, 140, 110, 16);
  s += cloud(1065, 140, 0.7);
  s += cloud(1295, 140, 0.6);
  s += glossySkull(1000, 80, 70, 8);
  s += glossyGhost(1290, 330, 170, 4);
  s += glossyHeart(1365, 395, 42, 'pink', 12);
  s += glossyNote(880, 300, 60, C.cyan, 12);
  s += glossyNote(1120, 260, 55, C.pink, -10);
  s += glossyBolt(950, 230, 55, 'yellow', 8);
  s += glossyStar(1050, 190, 20, 'yellow', 12);
  s += glossyStar(1450, 90, 24, 'cyan', -8);
  s += glossyBrokenHeart(640, 310, 72, 'pink', -6);
  s += glossyHeart(560, 350, 44, 'black', -10);
  s += shootingStar(140, 80, 26, 'yellow');

  // ---- glitter clusters
  const cluster = (cx, cy, seed) => {
    const rr = lcg(seed);
    const names = Object.keys(ids);
    let out = glossyStar(cx, cy, 22 + rr() * 8, names[Math.floor(rr() * 6)], (rr() - 0.5) * 30);
    for (let i = 0; i < 3; i++) out += sparkle(cx + (rr() - 0.5) * 160, cy + (rr() - 0.5) * 160, 18 + rr() * 22, ids[names[Math.floor(rr() * 6)]]);
    for (let i = 0; i < 3; i++) out += sparkle(cx + (rr() - 0.5) * 190, cy + (rr() - 0.5) * 190, 8 + rr() * 7, '#FFFFFF');
    return out;
  };
  s += cluster(820, 180, 33);
  s += cluster(350, 330, 44);

  // ---- headline: YOURSPACE, rainbow letters with jitter, gloss on top
  const HEAD = 'YOURSPACE';
  const fills = ['pink', 'orange', 'yellow', 'lime', 'cyan', 'violet', 'pink', 'orange', 'yellow'];
  const target = [0, -7, 3, -3, 5, -9, 7, 0, -5];
  const deltas = target.map((t, i) => t - (target[i - 1] ?? 0));
  const tspans = (fillFor) =>
    [...HEAD].map((ch, i) => `<tspan fill="${fillFor(i)}" dy="${deltas[i]}">${ch}</tspan>`).join('');
  const headStyle = `font-family="Fira Sans Condensed Ultra" font-size="120" font-style="italic" letter-spacing="2"`;
  s += `<g transform="rotate(-2 350 160)">`;
  s += `<text x="65" y="197" ${headStyle} fill="${C.navyEdge}" opacity="0.55">${HEAD}</text>`;
  s += `<text x="60" y="190" ${headStyle} stroke="${C.navyEdge}" stroke-width="9" stroke-linejoin="round" paint-order="stroke">${tspans((i) => `url(#g_${fills[i]})`)}</text>`;
  s += `<text x="60" y="190" ${headStyle} fill="url(#g_shine)">${tspans(() => 'url(#g_shine)')}</text>`;
  s += `</g>`;

  // ---- tagline
  const tagStyle = `font-family="Fira Sans ExtraBold" font-size="38" font-style="italic"`;
  s += `<text x="62" y="258" ${tagStyle} fill="#FFFFFF" stroke="${C.navyEdge}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">a home page that&#8217;s actually <tspan fill="url(#g_pink)">YOURS !!</tspan></text>`;

  // ---- gel URL pill (right side; the profile avatar covers the bottom left)
  s += `<g transform="rotate(-1 980 385)">`;
  s += `<rect x="830" y="350" width="300" height="68" rx="34" fill="url(#g_lime)" stroke="${C.navyEdge}" stroke-width="6"/>`;
  s += `<ellipse cx="980" cy="370" rx="124" ry="14" fill="#FFFFFF" opacity="0.45"/>`;
  s += `<text x="980" y="394" font-family="Fira Sans ExtraBold" font-size="36" fill="${C.navy}" text-anchor="middle">yourspace.live</text>`;
  s += `</g>`;

  // ---- glitter dust
  const rr = lcg(88);
  for (let i = 0; i < 20; i++) {
    s += `<circle cx="${Math.round(rr() * W)}" cy="${Math.round(rr() * H)}" r="${(2 + rr() * 2.5).toFixed(1)}" fill="#FFFFFF" opacity="${(0.3 + rr() * 0.4).toFixed(2)}"/>`;
  }

  s += `</g>`;

  // ---- CRT scanlines
  s += `<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000000"/></pattern></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scan)" opacity="0.06"/>`;

  s += '</svg>';
  return s;
}

// ================================================================ OG IMAGE
// The glossy glitter clip-art look of the Ditto background, laid out as a
// 1200x630 social card. Smooth chunky type (Fira Sans), no pixel text.
function og() {
  const W = 1200;
  const H = 630;
  let s = svgOpen(W, H);
  const ids = { pink: C.pink, cyan: C.cyan, yellow: C.yellow, lime: C.lime, violet: C.violet, orange: C.orange, black: '#2A1245' };
  s += glossDefs(ids);
  s += `<defs><linearGradient id="g_shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>`;

  // ---- dithered sky
  s += ditherSky(W, H, 10, ['#5B2B90', '#4A1D7A', '#3E1568', '#2C0B4E']);

  s += `<g shape-rendering="auto">`;

  // ---- zebra ribbon across the bottom
  s += `<g transform="rotate(8 600 540)">${zebraBand(-200, 495, 1600, 90)}</g>`;

  // ---- glossy art, right side
  s += smoothRainbow(930, 170, 130, 18);
  s += cloud(795, 170, 0.8);
  s += cloud(1065, 170, 0.7);
  s += glossySkull(745, 100, 80, 8);
  s += glossyGhost(1085, 430, 200, 4);
  s += glossyHeart(1170, 505, 48, 'pink', 12);
  s += glossyNote(700, 420, 70, C.cyan, 12);
  s += glossyNote(950, 330, 60, C.pink, -10);
  s += glossyBolt(820, 300, 60, 'yellow', 8);
  s += glossyStar(1040, 90, 22, 'yellow', 12);
  s += glossyStar(880, 470, 18, 'lime', -8);
  s += glossyHeart(500, 455, 48, 'black', -10);
  s += shootingStar(130, 95, 28, 'yellow');

  // ---- glitter clusters
  const cluster = (cx, cy, seed) => {
    const rr = lcg(seed);
    const names = Object.keys(ids);
    let out = glossyStar(cx, cy, 24 + rr() * 8, names[Math.floor(rr() * 6)], (rr() - 0.5) * 30);
    for (let i = 0; i < 3; i++) out += sparkle(cx + (rr() - 0.5) * 170, cy + (rr() - 0.5) * 170, 20 + rr() * 24, ids[names[Math.floor(rr() * 6)]]);
    for (let i = 0; i < 3; i++) out += sparkle(cx + (rr() - 0.5) * 200, cy + (rr() - 0.5) * 200, 9 + rr() * 7, '#FFFFFF');
    return out;
  };
  s += cluster(660, 240, 11);
  s += cluster(400, 430, 22);

  // ---- headline: YOURSPACE, rainbow letters with jitter, gloss on top
  const HEAD = 'YOURSPACE';
  const fills = ['pink', 'orange', 'yellow', 'lime', 'cyan', 'violet', 'pink', 'orange', 'yellow'];
  const target = [0, -8, 4, -4, 6, -10, 8, 0, -6];
  const deltas = target.map((t, i) => t - (target[i - 1] ?? 0));
  const tspans = (fillFor) =>
    [...HEAD].map((ch, i) => `<tspan fill="${fillFor(i)}" dy="${deltas[i]}">${ch}</tspan>`).join('');
  const headStyle = `font-family="Fira Sans Condensed Ultra" font-size="150" font-style="italic" letter-spacing="2"`;
  s += `<g transform="rotate(-2 400 200)">`;
  s += `<text x="66" y="238" ${headStyle} fill="${C.navyEdge}" opacity="0.55">${HEAD}</text>`;
  s += `<text x="60" y="230" ${headStyle} stroke="${C.navyEdge}" stroke-width="10" stroke-linejoin="round" paint-order="stroke">${tspans((i) => `url(#g_${fills[i]})`)}</text>`;
  s += `<text x="60" y="230" ${headStyle} fill="url(#g_shine)">${tspans(() => 'url(#g_shine)')}</text>`;
  s += `</g>`;

  // ---- tagline
  const tagStyle = `font-family="Fira Sans ExtraBold" font-size="42" font-style="italic"`;
  s += `<text x="62" y="312" ${tagStyle} fill="#FFFFFF" stroke="${C.navyEdge}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">a home page that&#8217;s actually <tspan fill="url(#g_pink)">YOURS !!</tspan></text>`;

  // ---- gel URL pill
  s += `<g transform="rotate(-1 230 380)">`;
  s += `<rect x="64" y="344" width="340" height="76" rx="38" fill="url(#g_lime)" stroke="${C.navyEdge}" stroke-width="6"/>`;
  s += `<ellipse cx="234" cy="366" rx="140" ry="16" fill="#FFFFFF" opacity="0.45"/>`;
  s += `<text x="234" y="394" font-family="Fira Sans ExtraBold" font-size="40" fill="${C.navy}" text-anchor="middle">yourspace.live</text>`;
  s += `</g>`;

  // ---- glitter dust
  const rr = lcg(77);
  for (let i = 0; i < 22; i++) {
    s += `<circle cx="${Math.round(rr() * W)}" cy="${Math.round(rr() * H)}" r="${(2 + rr() * 2.5).toFixed(1)}" fill="#FFFFFF" opacity="${(0.3 + rr() * 0.4).toFixed(2)}"/>`;
  }

  s += `</g>`;

  // ---- CRT scanlines
  s += `<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000000"/></pattern></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scan)" opacity="0.06"/>`;

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

// cute emo ghost: wavy-bottom sheet ghost, big shiny eyes, blush, held heart
function glossyGhost(cx, cy, size, rotDeg = 0) {
  const sc = (size / 100).toFixed(3);
  let out = `<g transform="rotate(${rotDeg} ${cx} ${cy}) translate(${cx - size / 2} ${cy - size / 2}) scale(${sc})">`;
  out += `<path d="M14 92 L14 48 C14 20 30 8 50 8 C70 8 86 20 86 48 L86 92 Q78 82 71 92 Q64 82 57 92 Q50 82 43 92 Q36 82 29 92 Q21 82 14 92 Z" fill="url(#g_silver)" stroke="${C.navyEdge}" stroke-width="5" stroke-linejoin="round"/>`;
  out += `<ellipse cx="38" cy="46" rx="8" ry="12" fill="${C.navy}"/>`;
  out += `<ellipse cx="62" cy="46" rx="8" ry="12" fill="${C.navy}"/>`;
  out += `<circle cx="35" cy="42" r="3" fill="#FFFFFF"/>`;
  out += `<circle cx="59" cy="42" r="3" fill="#FFFFFF"/>`;
  out += `<ellipse cx="28" cy="58" rx="7" ry="4" fill="${C.pink}" opacity="0.55"/>`;
  out += `<ellipse cx="72" cy="58" rx="7" ry="4" fill="${C.pink}" opacity="0.55"/>`;
  out += `<path d="M44 60 Q47 64 50 60 Q53 64 56 60" fill="none" stroke="${C.navy}" stroke-width="3" stroke-linecap="round"/>`;
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
// profile-views counter, and faint CRT scanlines.
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

  // ---- cute emo ghost holding a heart, above the zebra ribbon
  s += glossyGhost(1685, 700, 300, 4);
  s += glossyHeart(1795, 795, 70, 'pink', 12);

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
  s += glossyNote(1630, 530, 68, C.pink, 10);

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

// ================================================================ SITE ICON
// The ghost zoomed in to fill the frame, for favicons and app icons.
// bg=false: transparent (favicon.svg/png/ico). bg=true: flat purple square
// (apple-touch-icon, manifest icons).
function icon(bg) {
  const W = 1000;
  let s = svgOpen(W, W);
  const ids = { pink: C.pink, cyan: C.cyan, yellow: C.yellow, lime: C.lime, violet: C.violet, orange: C.orange, black: '#2A1245' };
  s += glossDefs(ids);
  if (bg) s += `<rect x="0" y="0" width="${W}" height="${W}" fill="${C.purpleA}"/>`;
  s += `<g shape-rendering="auto">`;
  s += glossyGhost(500, 500, 950, 2);
  s += glossyHeart(839, 839, 237, 'pink', 12);
  s += `</g>`;
  s += '</svg>';
  return s;
}

writeFileSync(join(OUT, 'avatar.svg'), avatar());
writeFileSync(join(OUT, 'banner.svg'), banner());
writeFileSync(join(OUT, 'og-image.svg'), og());
writeFileSync(join(OUT, 'background.svg'), background());
writeFileSync(join(OUT, 'icon.svg'), icon(false));
writeFileSync(join(OUT, 'icon-square.svg'), icon(true));
console.log('wrote avatar.svg + banner.svg + og-image.svg + background.svg + icon.svg + icon-square.svg');
