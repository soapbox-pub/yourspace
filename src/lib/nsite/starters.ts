import { sitePage } from '@/lib/nsite/blocks';
import {
  columnStyle,
  layoutRowMarkup,
  rowStyle,
  type ColumnKind,
} from '@/lib/nsite/layout';

/**
 * The layouts offered when the editor opens on a site that doesn't exist yet.
 *
 * Structure without content. Which regions a page has, and how wide they are,
 * is the one decision that is awkward to change later — every block already on
 * the page has to be moved into the new shape — while what goes *in* them is
 * the part the palette makes easy. So a starter is a set of empty columns and
 * nothing else: no headings, no sample copy, nothing to delete before starting.
 *
 * Written as inline styles for the same reason the blocks are: the canvas is an
 * iframe holding real HTML, where the app's Tailwind classes don't reach. The
 * shapes themselves live in `layout.ts`, which is also where the row and its
 * columns are registered as components.
 *
 * 3 columns is the one built on those components so far; the rest are still
 * plain divs, and will follow once the panel that comes with them has settled.
 */

/**
 * A page holding one centred row of the given columns, as loose markup.
 *
 * The pre-component form: the row and the columns are ordinary `<div>`s, so
 * everything about them is edited through the general element panel.
 */
function starterPage(width: number, columns: ColumnKind[]): string {
  const cells = columns.map((kind) => `      <div style="${columnStyle[kind]}"></div>`).join('\n');

  return sitePage(`
    <div style="${rowStyle(width)}">
${cells}
    </div>
  `);
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
    page: sitePage(`\n${layoutRowMarkup(['rail', 'body', 'rail'], 1200)}\n  `),
  },
];
