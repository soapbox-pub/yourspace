/**
 * The Google Fonts catalogue, as a file in this repo rather than a request to
 * Google.
 *
 * `catalogue.json` is a trimmed dump of the Fontsource index (which is itself
 * built from the Google Fonts metadata): every family Google publishes, minus
 * the icon fonts, with just the fields the picker needs. It is ~50KB of JSON,
 * so it is imported dynamically — searching fonts is not something most
 * sessions do, and nobody should pay for the list until they open the picker.
 *
 * Nothing here talks to `fonts.googleapis.com`. Browsing is served from this
 * file, and the font files themselves come from the Fontsource CDN and are
 * copied into the site being edited — see `install.ts`.
 */

export type FontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace'
  | 'other';

export interface FontFamily {
  /**
   * The Fontsource id, which is the family name slugified. Stored derived
   * rather than listed, because it is exactly `family` lowercased with runs of
   * non-alphanumerics replaced by `-` for all 1,968 entries.
   */
  id: string;
  family: string;
  category: FontCategory;
  /** Available static weights, ascending. */
  weights: number[];
  /** Character subset to download — `latin` unless the family has none. */
  subset: string;
}

/**
 * A row as stored: `[family, categoryIndex, weightDigits, subset?]`.
 *
 * Weights are digits — `"347"` is 300/400/700 — and the subset is only present
 * for the handful of families with no latin coverage. Between them those two
 * tricks are most of the difference between 50KB and 165KB.
 */
type FontRow = [string, number, string, string?];

interface RawCatalogue {
  categories: FontCategory[];
  fonts: FontRow[];
}

export function fontId(family: string): string {
  return family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function expand(raw: RawCatalogue): FontFamily[] {
  return raw.fonts.map(([family, category, weights, subset]) => ({
    id: fontId(family),
    family,
    category: raw.categories[category] ?? 'other',
    weights: [...weights].map((digit) => Number(digit) * 100),
    subset: subset ?? 'latin',
  }));
}

let pending: Promise<FontFamily[]> | undefined;

/**
 * The catalogue, fetched once per session.
 *
 * Imported as `?raw` and parsed here rather than as a JSON module: TypeScript
 * would otherwise infer a literal type for all 1,968 entries, which costs more
 * in `tsc` time than the parse costs at runtime.
 */
export function loadFonts(): Promise<FontFamily[]> {
  pending ??= import('./catalogue.json?raw').then((module) =>
    expand(JSON.parse(module.default) as RawCatalogue),
  );
  return pending;
}

/** The generic family to name after a webfont, so text still renders if it fails. */
export function fallbackFor(category: FontCategory): string {
  switch (category) {
    case 'serif':
      return 'serif';
    case 'monospace':
      return 'monospace';
    case 'handwriting':
      return 'cursive';
    default:
      return 'sans-serif';
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Every family matching `query`, best first.
 *
 * Ranked so that typing "robo" puts Roboto above Robotic Rebel, and matched on
 * the alphanumerics alone so that "playfairdisplay", "Playfair Display" and
 * "playfair-display" are the same search.
 *
 * Uncapped, deliberately. Truncating here would mean an empty query could only
 * ever reach the start of the alphabet, and no amount of scrolling would find
 * Zilla Slab. Rendering is what gets limited instead, a window at a time, which
 * is the caller's business — this function is cheap enough to run over the
 * whole catalogue on every keystroke.
 */
export function searchFonts(fonts: FontFamily[], query: string): FontFamily[] {
  const needle = normalize(query);
  if (!needle) return fonts;

  const ranked: { font: FontFamily; rank: number }[] = [];

  for (const font of fonts) {
    const at = normalize(font.family).indexOf(needle);
    if (at !== -1) ranked.push({ font, rank: at === 0 ? 0 : 1 });
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.font.family.length - b.font.family.length)
    .map((entry) => entry.font);
}
