import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

interface TileProps extends React.ComponentProps<'button'> {
  label: string;
  active: boolean;
}

/**
 * One swatch in a picker grid.
 *
 * The label is a tooltip and a screen-reader name rather than a caption: a
 * twelve-tile grid with a word under each reads as a list of names to be
 * compared, when the whole point is that you can see the difference.
 *
 * Props are forwarded so that the tile can be a `PopoverTrigger asChild` —
 * Radix hands its trigger the click handler, the ref and the expanded state,
 * and a component that swallowed them would render a button that does nothing.
 */
export function Tile({ label, active, children, ...rest }: TileProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        'motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md',
        active && 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-sidebar',
      )}
      {...rest}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 bottom-0 flex justify-center bg-primary/90 py-0.5 text-primary-foreground">
          <Check className="size-3" aria-hidden="true" />
        </span>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
