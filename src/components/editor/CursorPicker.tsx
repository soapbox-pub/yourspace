import { useId, useState } from 'react';
import {
  CircleHelp,
  Copy,
  Crosshair,
  Grab,
  Grid2x2,
  LoaderCircle,
  MousePointer2,
  Move,
  Pointer,
  Sparkles,
  TextCursor,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cursorImageUrl, cursorPresets, toCursorImage } from '@/lib/nsite/cursors';
import { ImageControl } from './fields';
import { Tile } from './Tile';
import { setStyle, styleValue, type StyleTarget } from './styleTarget';

/**
 * Picking the page's mouse pointer by pointing at it.
 *
 * A cursor is the one thing in this panel that cannot be drawn in its own tile:
 * it is painted by the operating system, at whatever size and in whatever theme
 * the person at the keyboard has chosen, and a picture of one would be a
 * picture of somebody else's computer. So the tile wears it instead — each has
 * the cursor it sets, and moving across the grid tries all eleven in the time
 * it takes to read this sentence. The icons are a legend for that, not a
 * preview: they say which is which once you have found the one you liked.
 *
 * This is why the gallery is keywords and the escape hatch is images, rather
 * than the other way around — hovering is only a real preview while the
 * browser is guaranteed to have the cursor to show.
 */
interface CursorPickerProps {
  target: StyleTarget;
  onUpload?: (file: File) => Promise<string | null>;
}

/** A legend for the grid, keyed by preset. Not a drawing of the cursor. */
const cursorIcons: Record<string, LucideIcon> = {
  normal: MousePointer2,
  pointer: Pointer,
  crosshair: Crosshair,
  text: TextCursor,
  help: CircleHelp,
  grab: Grab,
  move: Move,
  'zoom-in': ZoomIn,
  cell: Grid2x2,
  copy: Copy,
  progress: LoaderCircle,
};

export function CursorPicker({ target, onUpload }: CursorPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const labelId = useId();

  const value = styleValue(target, 'cursor').trim();
  const url = cursorImageUrl(value);

  return (
    <section className="space-y-1.5">
      <p id={labelId} className="text-xs font-medium leading-none text-muted-foreground">
        Cursor
      </p>

      <div role="group" aria-labelledby={labelId} className="grid grid-cols-4 gap-2">
        {cursorPresets.map((preset) => {
          const Icon = cursorIcons[preset.id] ?? MousePointer2;

          return (
            <Tile
              key={preset.id}
              label={preset.label}
              active={!url && value === preset.value}
              // The point of the whole grid. `auto` rather than `''` for the
              // default tile, so that it too answers the hover with something.
              style={{ cursor: preset.value || 'auto' }}
              onClick={() => setStyle(target, { cursor: preset.value })}
            >
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </Tile>
          );
        })}

        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            {/*
              Wearing the uploaded cursor as well, once there is one: it is the
              only place the file can be tried without moving onto the page.
            */}
            <Tile label="Custom" active={Boolean(url)} style={url ? { cursor: value } : undefined}>
              <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
            </Tile>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-64 p-3">
            <ImageControl
              label="Cursor image"
              value={url}
              preview={url}
              // Keyed on the popover for the reason the background fields are:
              // the input is uncontrolled, and keying it on the value would
              // remount on every keystroke and take the caret with it.
              fieldKey={`page:cursor:${customOpen}`}
              onUpload={onUpload}
              hint="A small PNG or GIF — 32×32 is the classic size. Anything much bigger is ignored, and the tip is the image's top-left corner."
              onChange={(next) => setStyle(target, { cursor: toCursorImage(next) })}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs leading-snug text-muted-foreground/80">Hover a tile to try it.</p>
    </section>
  );
}
