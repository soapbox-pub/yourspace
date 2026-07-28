import type { NsiteFile } from '@/lib/nsite/files';
import { fallbackFor, type FontFamily } from './catalogue';

/**
 * Getting a chosen font into the site being edited.
 *
 * The font files are copied into the nsite rather than linked. A published
 * nsite is meant to outlive whatever built it, and a `<link>` to a font CDN
 * makes the page depend forever on a host the author has no claim on — so the
 * `.woff2` is fetched once, here in the editor, and shipped as a file in the
 * site alongside its images. The published page then asks nobody for anything.
 *
 * The bytes come from the Fontsource CDN, which mirrors the Google Fonts
 * files under their original open licences. That request happens while
 * editing, from the author's browser; a visitor to the finished site never
 * makes it.
 */

const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

/** Where installed font files live in the site. */
export const FONT_FOLDER = '/fonts';

/**
 * Weights worth downloading for a family.
 *
 * Two: a regular and a bold, which is what body text and its headings need and
 * what the inspector's weight control is mostly used for. Every extra weight
 * is another ~20KB the site carries forever, so the rest are left to the
 * browser to synthesize.
 *
 * Picked by proximity rather than by exact match, because plenty of families
 * don't offer 400 or 700 at all — Bebas Neue is 400-only, and some display
 * faces start at 500.
 */
export function installWeights(font: FontFamily): number[] {
  const nearest = (target: number) =>
    font.weights.reduce((best, weight) =>
      Math.abs(weight - target) < Math.abs(best - target) ? weight : best,
    );

  const regular = nearest(400);
  const bold = nearest(700);
  return regular === bold ? [regular] : [regular, bold];
}

export function fontFileUrl(font: FontFamily, weight: number): string {
  return `${CDN}/${font.id}@latest/${font.subset}-${weight}-normal.woff2`;
}

/** The path an installed weight takes in the site. */
export function fontFilePath(font: FontFamily, weight: number): string {
  return `${FONT_FOLDER}/${font.id}-${weight}.woff2`;
}

/**
 * A family name as a CSS string.
 *
 * Quoted always, rather than only when it contains a space: an unquoted
 * `font-family` is a sequence of identifiers, so a name that happens to be a
 * CSS keyword — or that starts with a digit, as `42dot Sans` does — is not
 * valid unquoted. The escape is the same one `toCssUrl` applies, and for the
 * same reason: this string is interpolated into a stylesheet the canvas parses
 * on the app's own origin, so it must not be able to close the string and open
 * a declaration of its own.
 */
export function cssFamilyName(family: string): string {
  return `"${family.replace(/["\\]/g, (char) => `\\${char}`).replace(/[\n\r\f]/g, ' ')}"`;
}

/** The full `font-family` value for a family, generic fallback included. */
export function fontFamilyValue(font: FontFamily): string {
  return `${cssFamilyName(font.family)}, ${fallbackFor(font.category)}`;
}

/**
 * The family named first in a `font-family` value, unquoted.
 *
 * Used to show which catalogue entry a selection currently uses. Only the first
 * name matters — the rest are the fallbacks this module appended.
 */
export function primaryFamily(value: string): string {
  const first = value.split(',')[0]?.trim() ?? '';
  const quoted = /^(['"])(.*)\1$/.exec(first);
  return (quoted ? quoted[2].replace(/\\(.)/g, '$1') : first).trim();
}

/**
 * The site without the font files nothing in it references.
 *
 * `pruneFontFaces` keeps the *declarations* honest, but the downloaded files
 * outlive them — a font tried and replaced leaves ~20KB behind, and a session
 * spent browsing the picker could otherwise publish a megabyte of typefaces the
 * site never sets. Applied when collecting files to publish rather than on
 * every change, so a font dropped and picked again doesn't have to be fetched
 * twice.
 *
 * Only files under `/fonts` are considered, and a file is kept if any text file
 * in the site mentions its path — including pages that aren't currently open,
 * whose stylesheets are the reason this can't be decided from the canvas alone.
 */
export function pruneFontFiles(files: NsiteFile[]): NsiteFile[] {
  const texts = files.flatMap((file) => (file.text ? [file.text] : []));

  return files.filter((file) => {
    if (!file.path.startsWith(`${FONT_FOLDER}/`)) return true;
    return texts.some((text) => text.includes(file.path));
  });
}

/**
 * Font bytes, fetched at most once per URL per session.
 *
 * Shared between the picker's previews and installation, so choosing a font you
 * just scrolled past costs nothing. Failures are evicted so a flaky request can
 * be retried rather than being remembered as a permanent "no".
 */
const downloads = new Map<string, Promise<ArrayBuffer>>();

export function fetchFontFile(url: string): Promise<ArrayBuffer> {
  let request = downloads.get(url);

  if (!request) {
    request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font request failed (${response.status})`);
        return response.arrayBuffer();
      })
      .catch((error: unknown) => {
        downloads.delete(url);
        throw error;
      });
    downloads.set(url, request);
  }

  return request;
}
