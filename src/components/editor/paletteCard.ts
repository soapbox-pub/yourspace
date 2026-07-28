/**
 * The look of a card in the insert panel.
 *
 * Shared, so that everything offering to put something on the page reads as one
 * set — a block and a GIF are the same gesture from where the user is sitting,
 * whatever the difference behind the panel.
 *
 * Class strings rather than a component: the block cards carry drag handlers
 * and the GIF card is a dialog trigger, so the two need different elements and
 * only the styling is worth holding in common.
 */
export const paletteCardClass =
  'group flex w-full items-start gap-3 rounded-lg border border-transparent bg-card p-2.5 text-left transition-all hover:border-border hover:bg-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';

/** The tile holding a card's icon. */
export const paletteIconClass =
  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary';
