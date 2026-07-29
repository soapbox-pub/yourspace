import { useId, useState } from 'react';
import { MousePointer2, Sparkles } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { gifUrl } from '@/lib/gifcities';
import {
  cursorImageUrl,
  cursorPresets,
  cursorValue,
  toCursorImage,
} from '@/lib/nsite/cursors';
import { CHECKERBOARD } from './checkerboard';
import { ImageControl } from './fields';
import { Tile } from './Tile';
import { setStyle, styleValue, type StyleTarget } from './styleTarget';

/**
 * Picking the page's mouse pointer out of GeoCities.
 *
 * Each tile shows the GIF and wears it: the cursor over a tile is the cursor
 * that tile sets, so the grid can be tried in the time it takes to cross it.
 * That is worth more here than in the background picker, because a cursor is
 * the one thing on the page that is drawn at the size the mouse is under your
 * hand rather than at the size of a swatch — a 16px smiley is charming in a
 * tile and nearly invisible in use, and the only way to know that is to move
 * the mouse over it.
 *
 * The one place preview and page disagree: the tile animates and the cursor
 * mostly won't, since Chrome shows a cursor GIF's first frame and leaves it
 * there. Every preset is picked to stand still, so the difference is a bee
 * whose wings stop rather than a pointer that vanishes.
 */
interface CursorPickerProps {
  target: StyleTarget;
  onUpload?: (file: File) => Promise<string | null>;
}

export function CursorPicker({ target, onUpload }: CursorPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const labelId = useId();

  const value = styleValue(target, 'cursor').trim();
  const url = cursorImageUrl(value);
  const preset = cursorPresets.find((option) => gifUrl(option.checksum) === url);

  return (
    <section className="space-y-1.5">
      <p id={labelId} className="text-xs font-medium leading-none text-muted-foreground">
        Cursor
      </p>

      <div role="group" aria-labelledby={labelId} className="grid grid-cols-4 gap-2">
        <Tile
          label="Normal"
          active={!value}
          onClick={() => setStyle(target, { cursor: '' })}
          style={{ cursor: 'auto' }}
        >
          <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <MousePointer2 className="size-4" aria-hidden="true" />
          </span>
        </Tile>

        {cursorPresets.map((option) => (
          <Tile
            key={option.id}
            label={option.label}
            active={option.id === preset?.id}
            style={{ cursor: cursorValue(option) }}
            onClick={() => setStyle(target, { cursor: cursorValue(option) })}
          >
            {/*
              Contained rather than covering, and never scaled up: these are
              between 14 and 61 pixels tall, and a tile that enlarged them
              would promise a cursor twice the size of the one you get.
            */}
            <span
              className="flex size-full items-center justify-center p-1.5"
              style={CHECKERBOARD}
            >
              <img
                src={gifUrl(option.checksum)}
                alt=""
                width={option.width}
                height={option.height}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </span>
          </Tile>
        ))}

        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            {/* Wearing the uploaded cursor too, once there is one to wear. */}
            <Tile
              label="Custom"
              active={Boolean(url) && !preset}
              style={url ? { cursor: value } : undefined}
            >
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
              hint="A small GIF or PNG — 32×32 is the classic size. Anything over 128 across is ignored outright, and the tip is the image's top-left corner."
              onChange={(next) => setStyle(target, { cursor: toCursorImage(next) })}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs leading-snug text-muted-foreground/80">
        Hover a tile to try it. Search "cursor" in GIFs for hundreds more.
      </p>
    </section>
  );
}
