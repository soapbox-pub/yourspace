import { gifUrl } from '@/lib/gifcities';
import { toCssUrl } from './siteHtml';

/**
 * Cursors dug out of GeoCities, offered as one-click tiles in the page panel.
 *
 * Every one is a GIF somebody put on their homepage before 2009, recovered by
 * the Internet Archive and served from the same blob host the GIF picker
 * already draws from — so the presets cost the published page nothing but a
 * reference, and a digest addresses the same bytes forever. Searching "cursor"
 * in the GIF picker finds several hundred more of them; this is a walk through
 * that shelf, keeping the ones that read at cursor size.
 *
 * Curated by looking at all 560 of them, which is the only way to do it. The
 * archive's own alt text is the GeoCities path a GIF was found at ("everlasting
 * illusions miscellanous cursor 2"), a third of the results are opaque
 * rectangles where the transparency was lost, and a handful are pornography.
 * The labels here are written rather than taken.
 *
 * Three things are checked for each: that the bytes really are a GIF, that it
 * fits inside 128×128, and that its first frame is worth looking at. The size
 * cap is the hard one — a browser silently ignores a cursor image larger than
 * that, so an oversized GIF is not a big cursor but no cursor. The first frame
 * matters because most browsers don't animate a cursor: Chrome shows frame one
 * and stops, and a sparkle trail whose first frame is empty is an invisible
 * pointer. Every one of these stands still.
 */
export interface CursorPreset {
  id: string;
  /** Named for what it is, not for the path it was found at. */
  label: string;
  /** GifCities digest: the GIF's name on the archive's blob host. */
  checksum: string;
  /** Intrinsic size, which is the grid the hotspot is measured on. */
  width: number;
  height: number;
  /**
   * The pixel that does the pointing.
   *
   * Given for every preset because the alternative is the top-left corner, and
   * a 40px heart whose click lands somewhere above and left of itself feels
   * broken rather than nostalgic. Drawings with a tip — the hand, the arrow,
   * the sword, the torch — point with it; everything rounder points with its
   * middle, which is where the eye puts it anyway.
   */
  hotspot: [number, number];
}

export const cursorPresets: CursorPreset[] = [
  {
    id: 'hand',
    label: 'Pointing hand',
    checksum: '472OXRZUZTBMDJG755IL7EVNAUVFJYA3',
    width: 33,
    height: 14,
    hotspot: [32, 6],
  },
  {
    id: 'arrow',
    label: 'Glitter arrow',
    checksum: 'FB2GRREK4UFEQJSNKNVGOI5ECW7OBFCX',
    width: 32,
    height: 32,
    hotspot: [2, 0],
  },
  {
    id: 'sword',
    label: 'Sword',
    checksum: 'ZOROEGSM7WYW4OJ2IA2SCEJ2SGWMOQXV',
    width: 32,
    height: 32,
    hotspot: [2, 2],
  },
  {
    id: 'fairy',
    label: 'Fairy',
    checksum: 'LNNRE54RDLNH7Q2ZGXQSEJSLZATQBEIQ',
    width: 32,
    height: 32,
    hotspot: [16, 16],
  },
  {
    id: 'star',
    label: 'Star',
    checksum: '6DBD6K3D3YBCQ6TO37OACSE6ZXQUBXN6',
    width: 16,
    height: 14,
    hotspot: [8, 7],
  },
  {
    id: 'heart',
    label: 'Heart',
    checksum: 'AVCJ4JSXKKQMH5MH5CORT6CMYPXRCNEV',
    width: 40,
    height: 40,
    hotspot: [20, 20],
  },
  {
    id: 'smiley',
    label: 'Smiley',
    checksum: 'MLBV5WC6LU43JR5QNXAPNPLUPIDMEVVW',
    width: 16,
    height: 16,
    hotspot: [8, 8],
  },
  {
    id: 'butterfly',
    label: 'Butterfly',
    checksum: 'ZKXULYCPKHZXGHQXHIHZ3QURDTUUJI4H',
    width: 30,
    height: 27,
    hotspot: [15, 13],
  },
  {
    id: 'bee',
    label: 'Bee',
    checksum: 'HDVLSLP2URBYZTDXBIPB4SULMHGORUI7',
    width: 47,
    height: 36,
    hotspot: [23, 18],
  },
  {
    id: 'peace',
    label: 'Peace',
    checksum: 'GMKNTVTKXWM7N7WQ7GAZWNJXOHBX7ZAI',
    width: 40,
    height: 40,
    hotspot: [20, 20],
  },
  {
    id: 'globe',
    label: 'Globe',
    checksum: 'WDBHDKFF7HW3QIDHITCGACSOZ5JRQCWL',
    width: 32,
    height: 32,
    hotspot: [16, 16],
  },
  {
    id: 'cupcake',
    label: 'Cupcake',
    checksum: 'AJV5J35B7DVIESUZFR63RPH7YX57KQRI',
    width: 32,
    height: 32,
    hotspot: [16, 16],
  },
  {
    id: 'alien',
    label: 'Alien',
    checksum: 'EP5IZWJXORFFH5YASVB3LH4QHJKQJYJI',
    width: 36,
    height: 51,
    hotspot: [18, 25],
  },
  {
    id: 'torch',
    label: 'Torch',
    checksum: 'OO5SOXF53W73GUC6DDPHFIVJ7WILI6IE',
    width: 29,
    height: 61,
    hotspot: [14, 4],
  },
];

/**
 * The fallback keyword every image cursor needs.
 *
 * Not decoration: `cursor: url(...)` on its own is invalid and the whole
 * declaration is dropped, so a cursor the browser wouldn't load would take the
 * rest of the rule down with it. `auto` is the value the property already had,
 * which makes the fallback invisible on the occasions it is used.
 */
const FALLBACK = 'auto';

/** A preset as a `cursor` value. */
export function cursorValue(preset: CursorPreset): string {
  const [x, y] = preset.hotspot;
  return `${toCssUrl(gifUrl(preset.checksum))} ${x} ${y}, ${FALLBACK}`;
}

/**
 * An uploaded image as a `cursor` value, or `''` when the URL isn't one this
 * app will write.
 *
 * No hotspot, unlike the presets: their coordinates come from having looked at
 * the drawing, and there is nothing honest to say about a file chosen a second
 * ago. The browser then points with the top-left corner, which is what every
 * hand-written GeoCities cursor did too.
 */
export function toCursorImage(url: string): string {
  const value = toCssUrl(url);
  return value ? `${value}, ${FALLBACK}` : '';
}

/**
 * The image URL inside a cursor value, or `''`.
 *
 * Deliberately not `parseCssUrl`, which wants the value to be a `url()` and
 * nothing else: a cursor always has a fallback after it, and usually a hotspot
 * in between.
 */
export function cursorImageUrl(value: string): string {
  return /^url\(\s*(['"]?)([^)'"]*)\1\s*\)/i.exec(value.trim())?.[2]?.trim() ?? '';
}
