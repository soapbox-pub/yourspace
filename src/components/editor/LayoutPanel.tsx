import type { Component } from 'grapesjs';

import { DEFAULT_ROW_WIDTH, layoutColumns } from '@/lib/nsite/layout';
import { cn } from '@/lib/utils';
import { RangeControl } from './fields';
import { setStyle, styleValue } from './styleTarget';

/**
 * The panel for a layout row.
 *
 * Separate from the element panel for the reason `PagePanel` is: almost nothing
 * it shows applies. The row is a frame around the columns, and the frame has
 * exactly one decision in it — how far across the page it runs. Everything else
 * the general panel offers for a flex container is either already set by the
 * layout (direction, wrapping, alignment) or a way to take it apart.
 *
 * So this is deliberately unlike the rest of the inspector, in the same spirit
 * as the page's: two pictures of the choice rather than a `max-width` field and
 * a pair of margins, and a slider for the one number, because how wide a page
 * should be is a thing you judge by looking at it.
 */

/** How far a centred row can be dragged, in px. */
const MIN_WIDTH = 480;
const MAX_WIDTH = 1600;
const WIDTH_STEP = 20;

interface RowWidth {
  centred: boolean;
  /** How wide the row runs when centred. */
  maxWidth: number;
}

/**
 * Read from `max-width` alone.
 *
 * The auto margins that centre the row only mean anything once there is a width
 * to centre within, so a row without one is full width whatever its margins
 * say. A width in some other unit still counts as centred — the slider just
 * starts from the default rather than pretending to know what `80ch` is.
 */
function rowWidth(row: Component): RowWidth {
  const value = styleValue(row, 'max-width').trim();
  const px = /^(\d+(?:\.\d+)?)px$/.exec(value);

  return {
    centred: Boolean(value) && value !== 'none',
    maxWidth: px ? Math.round(Number(px[1])) : DEFAULT_ROW_WIDTH,
  };
}

/**
 * Going full width takes the margins with it.
 *
 * They are inert without a width to centre within, so leaving them behind would
 * put declarations in the published stylesheet that do nothing — and would
 * silently re-centre the row the next time a width was set. The same reasoning
 * as `setPosition` clearing its offsets.
 */
function setRowWidth(row: Component, { centred, maxWidth }: RowWidth) {
  setStyle(
    row,
    centred
      ? { 'max-width': `${maxWidth}px`, 'margin-left': 'auto', 'margin-right': 'auto' }
      : { 'max-width': '', 'margin-left': '', 'margin-right': '' },
  );
}

/**
 * The choice, drawn: the columns against the edges of the page, or inset from
 * them. Drawn rather than described for the same reason the starter tiles are —
 * "full width" and "centred" are shapes, and a shape is quicker to recognise
 * than to read.
 */
function WidthPreview({ columns, centred }: { columns: number; centred: boolean }) {
  return (
    <span className="flex h-12 w-full items-stretch rounded-md border bg-background p-1.5 transition-colors group-hover:border-primary/40">
      <span className={cn('flex gap-1', centred ? 'mx-auto w-2/3' : 'w-full')}>
        {Array.from({ length: columns }, (_, index) => (
          <span
            key={index}
            className="flex-1 rounded-sm bg-muted-foreground/25 transition-colors group-hover:bg-primary/40"
          />
        ))}
      </span>
    </span>
  );
}

interface WidthOptionProps {
  label: string;
  columns: number;
  centred: boolean;
  active: boolean;
  onSelect: () => void;
}

function WidthOption({ label, columns, centred, active, onSelect }: WidthOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border bg-muted/40 p-2 text-left transition-all',
        'hover:border-primary/40 hover:bg-accent hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active && 'border-primary bg-accent ring-2 ring-primary/30',
      )}
    >
      <WidthPreview columns={columns} centred={centred} />
      <span className="text-sm font-medium leading-tight text-foreground">{label}</span>
    </button>
  );
}

export function LayoutPanel({ row }: { row: Component }) {
  const { centred, maxWidth } = rowWidth(row);
  // A row with nothing recognisable in it still gets a picture to choose from.
  const columns = layoutColumns(row).length || 1;
  // The stored width can be anything; the thumb has to sit somewhere real.
  const slider = Math.min(Math.max(maxWidth, MIN_WIDTH), MAX_WIDTH);

  return (
    <div className="space-y-5 p-4">
      <header>
        <h2 className="text-base font-semibold text-foreground">Your columns</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drop anything into a column. This is the frame they sit in.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <WidthOption
          label="Full width"
          columns={columns}
          centred={false}
          active={!centred}
          onSelect={() => setRowWidth(row, { centred: false, maxWidth })}
        />
        <WidthOption
          label="Centred"
          columns={columns}
          centred
          active={centred}
          onSelect={() => setRowWidth(row, { centred: true, maxWidth })}
        />
      </div>

      {centred && (
        <RangeControl
          label="Width"
          value={slider}
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          step={WIDTH_STEP}
          valueLabel={`${slider}px`}
          onChange={(value) => setRowWidth(row, { centred: true, maxWidth: value })}
        />
      )}
    </div>
  );
}
