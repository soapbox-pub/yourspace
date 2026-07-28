import { sitePage } from '@/lib/nsite/blocks';

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
 * iframe holding real HTML, where the app's Tailwind classes don't reach.
 */

/**
 * The centred row every starter is built from.
 *
 * A viewportful tall, so a starter is the shape of a page rather than a band
 * across the top of one — an empty region that stops partway down reads as a
 * mistake. That height reaches the columns through `align-self` on each of them
 * rather than `align-items` here, so it is the starter's own regions that fill
 * the page and not everything later dropped beside them: a heading that lands
 * in this row is meant to be heading-sized.
 *
 * `flex-wrap`, with the floor on the main column below, is what stands in for a
 * media query: a rail and a body that no longer fit side by side stack instead
 * of squeezing, so the layout survives a phone without the starter having to
 * ship CSS the user would then have to find and edit.
 *
 * `box-sizing` is spelled out because the padding has to come out of the 100vh
 * rather than adding to it. GrapesJS's `protectedCss` sets the same thing for
 * every element, but a page that only lays out correctly because of an editor
 * default is a page that breaks when the default does.
 */
const row = (width: number) =>
  `max-width:${width}px;margin:0 auto;padding:32px 24px;box-sizing:border-box;min-height:100vh;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;`;

/** A rail. Sized, and not shrunk to fit whatever ends up beside it. */
const rail = 'flex-grow:0;flex-shrink:0;flex-basis:220px;align-self:stretch;min-height:120px;';

/**
 * The column that takes whatever the rails leave.
 *
 * The longhands are spelled out rather than written `flex: 1`, because the
 * shorthand would override the `flex-basis` that dragging a column's edge
 * writes — see `flexItemResize` in `blocks.ts`.
 */
const main =
  'flex-grow:1;flex-shrink:1;flex-basis:0%;min-width:320px;align-self:stretch;min-height:120px;';

/**
 * A page holding one centred row of the given regions.
 *
 * The regions take their height from the row, which is what fills the page. The
 * `min-height` on each is a floor for the wrapped case, where the columns share
 * that height rather than each being given it — and some floor is needed either
 * way, since an empty div is zero tall and impossible to drop onto.
 *
 * Nothing marks them out visually: the element outlines the editor draws are
 * what makes an empty region visible while editing, and a border set here would
 * survive into the published page.
 */
function starterPage(width: number, regions: string[]): string {
  const columns = regions.map((style) => `      <div style="${style}"></div>`).join('\n');

  return sitePage(`
    <div style="${row(width)}">
${columns}
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
    page: starterPage(760, [main]),
  },
  {
    id: 'left-sidebar',
    label: 'Left sidebar',
    description: 'A rail, then the page',
    columns: [0.34, 1],
    page: starterPage(1120, [rail, main]),
  },
  {
    id: 'right-sidebar',
    label: 'Right sidebar',
    description: 'The page, then a rail',
    columns: [1, 0.34],
    page: starterPage(1120, [main, rail]),
  },
  {
    id: 'three-column',
    label: '3 columns',
    description: 'A rail either side',
    columns: [0.34, 1, 0.34],
    page: starterPage(1200, [rail, main, rail]),
  },
];
