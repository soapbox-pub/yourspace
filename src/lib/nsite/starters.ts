import { sitePage } from '@/lib/nsite/blocks';
import { layoutRowMarkup, type ColumnKind } from '@/lib/nsite/layout';

/**
 * The layouts offered when the editor opens on a site that doesn't exist yet.
 *
 * Structure without content. Which regions a page has, and how wide they are,
 * is the one decision that is awkward to change later — every block already on
 * the page has to be moved into the new shape — while what goes *in* them is
 * the part the palette makes easy. So a starter is a set of empty columns and
 * nothing else: no headings, no sample copy, nothing to delete before starting.
 *
 * Each is a row of columns from `layout.ts`, which is where the shapes live and
 * where the row and its columns are registered as components — so a starter
 * arrives as one layout with a panel of its own, rather than a handful of loose
 * divs that can be pulled apart by a drop that misses. All that is left here is
 * which columns each offers, and how wide the row holding them runs.
 */

/** A page holding one centred row of the given columns. */
function starterPage(width: number, columns: ColumnKind[]): string {
  return sitePage(`\n${layoutRowMarkup(columns, width)}\n  `);
}

export interface StarterLayout {
  id: string;
  label: string;
  description: string;
  /** Relative column widths, for the preview tile. Empty for a page with none. */
  columns: number[];
  /** The page to put on the canvas, or null to leave the blank one alone. */
  page: string | null;
}

export const starterLayouts: StarterLayout[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'An empty page',
    columns: [],
    page: null,
  },
  {
    id: 'single-column',
    label: 'Single column',
    description: 'One centred column',
    columns: [1],
    page: starterPage(760, ['body']),
  },
  {
    id: 'left-sidebar',
    label: 'Left sidebar',
    description: 'A rail, then the page',
    columns: [0.34, 1],
    page: starterPage(1120, ['rail', 'body']),
  },
  {
    id: 'right-sidebar',
    label: 'Right sidebar',
    description: 'The page, then a rail',
    columns: [1, 0.34],
    page: starterPage(1120, ['body', 'rail']),
  },
  {
    id: 'three-column',
    label: '3 columns',
    description: 'A rail either side',
    columns: [0.34, 1, 0.34],
    page: starterPage(1200, ['rail', 'body', 'rail']),
  },
];
