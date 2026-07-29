/**
 * The look of the insert panel.
 *
 * Shared, so that everything offering to put something on the page reads as one
 * set — a block and a GIF are the same gesture from where the user is sitting,
 * whatever the difference behind the panel.
 *
 * Class strings rather than components: the block tiles carry drag handlers and
 * the GIF tiles are images, so the two need different elements and only the
 * styling is worth holding in common.
 */

/** A square-ish tile: an icon over its name, laid out in a grid. */
export const paletteTileClass =
  'group flex aspect-[5/4] flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-2 text-center transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';

/** The icon inside a tile. */
export const paletteIconClass = 'size-5 text-muted-foreground transition-colors group-hover:text-primary';

/** A tile's name. Two words at most, or it wraps into the icon. */
export const paletteLabelClass =
  'line-clamp-2 text-[11px] font-medium leading-tight text-foreground';

/** The small heading over a group of tiles. */
export const paletteSectionClass =
  'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/**
 * A quiet "there is more this way" control: text and an arrow, no chrome. Used
 * where a panel opens onto something larger rather than inserting anything.
 */
export const paletteLinkClass =
  'group flex items-center gap-0.5 rounded-md py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/** The arrow inside a `paletteLinkClass` control. */
export const paletteLinkArrowClass =
  'size-3.5 transition-transform motion-safe:group-hover:translate-x-0.5';
