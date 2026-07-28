import { starterLayouts, type StarterLayout } from '@/lib/nsite/starters';
import { cn } from '@/lib/utils';

interface StarterPickerProps {
  onSelect: (starter: StarterLayout) => void;
}

/**
 * A tile standing in for the shape of a page: one bar per column, in the
 * proportions the starter lays them out in.
 *
 * Drawn rather than screenshotted, because what is being chosen between is a
 * set of empty regions — a thumbnail of the real thing would be five identical
 * white rectangles.
 */
function StarterPreview({ columns }: { columns: number[] }) {
  return (
    <span className="flex h-16 w-full items-stretch gap-1.5 rounded-md border bg-background p-2 transition-colors group-hover:border-primary/30">
      {columns.length === 0 ? (
        <span className="flex-1 rounded-sm border border-dashed border-muted-foreground/30" />
      ) : (
        columns.map((width, index) => (
          <span
            key={index}
            style={{ flexGrow: width }}
            className="flex-shrink basis-0 rounded-sm bg-muted-foreground/25 transition-colors group-hover:bg-primary/40"
          />
        ))
      )}
    </span>
  );
}

/**
 * The layout offered over the canvas when the editor opens on a new site.
 *
 * Shown at the one moment it can be acted on for free: the page underneath is
 * empty, so replacing it costs nothing, and picking a shape now saves moving
 * blocks into one later. Anything else is a dismissal — clicking Blank, or
 * pressing Escape — and the blank page it is covering is what stays.
 *
 * Scoped to the canvas rather than the viewport, and not `aria-modal`: the
 * rails either side stay live, because a starter is an offer and not a question
 * the editor is blocked on.
 */
export function StarterPicker({ onSelect }: StarterPickerProps) {
  const dismiss = () => onSelect(starterLayouts[0]);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        dismiss();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="starter-picker-title"
        aria-describedby="starter-picker-description"
        className="w-full max-w-3xl rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 id="starter-picker-title" className="text-lg font-semibold text-foreground">
          Start with a layout
        </h2>
        <p id="starter-picker-description" className="mt-1 text-sm text-muted-foreground">
          Empty regions to drop blocks into. Nothing here is permanent — you can resize the columns,
          add more, or take them out as you go.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {starterLayouts.map((starter, index) => (
            <button
              key={starter.id}
              type="button"
              autoFocus={index === 0}
              onClick={() => onSelect(starter)}
              className={cn(
                'group flex flex-col gap-2 rounded-lg border bg-muted/40 p-2.5 text-left transition-all',
                'hover:border-primary/40 hover:bg-accent hover:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              <StarterPreview columns={starter.columns} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-tight text-foreground">
                  {starter.label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {starter.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
