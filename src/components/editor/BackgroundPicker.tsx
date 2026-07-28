import type { ReactNode } from 'react';
import { useState } from 'react';
import { Ban, Check, Palette } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { backgroundPresets, colorPresets, type BackgroundPreset } from '@/lib/nsite/backgrounds';
import { parseCssUrl, toCssUrl } from '@/lib/nsite/siteHtml';
import { cn } from '@/lib/utils';
import { ColorControl, ImageControl } from './fields';
import {
  backgroundFit,
  backgroundValues,
  fitPatches,
  noImagePatch,
  setBackground,
  toBackgroundImage,
  type StyleTarget,
} from './styleTarget';

/**
 * Picking a page background by looking at it.
 *
 * Images and flat colours share one grid, because to the person choosing they
 * are the same decision — "what does my page look like" — and splitting them
 * into a colour field and an image field turns one glance into two forms. Every
 * tile writes the whole background in a single click; the free-text version of
 * the same properties lives behind "Custom", where it is available without
 * being the first thing anybody meets.
 *
 * A preset carries a colour as well as an image, and sets both. It is what
 * shows through a transparent PNG and around an image that doesn't reach the
 * corners, so an image dropped onto whatever colour happened to be there
 * already is the one way the tile can look wrong.
 */
interface BackgroundPickerProps {
  target: StyleTarget;
  /** Images already in the site, offered after the presets. */
  images: { url: string; label: string }[];
  onUpload?: (file: File) => Promise<string | null>;
}

export function BackgroundPicker({ target, images, onUpload }: BackgroundPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);

  const { color, image } = backgroundValues(target);
  const url = parseCssUrl(image);
  const tiled = backgroundFit(target) === 'tile';

  const pickPreset = (preset: BackgroundPreset) =>
    setBackground(target, {
      'background-image': toCssUrl(preset.url),
      'background-color': preset.color,
      ...(preset.tile ? fitPatches.tile : fitPatches.cover),
    });

  const pickImage = (src: string) =>
    setBackground(target, { 'background-image': toCssUrl(src), ...fitPatches.cover });

  const pickColor = (value: string) =>
    setBackground(target, { 'background-color': value, ...noImagePatch });

  const clear = () => setBackground(target, { 'background-color': '', ...noImagePatch });

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {backgroundPresets.map((preset) => (
          <Tile
            key={preset.id}
            label={preset.label}
            active={url === preset.url}
            onClick={() => pickPreset(preset)}
          >
            {/*
              Lazy, because these are full-size backgrounds hotlinked from
              Blossom and the panel only exists while the page itself is
              selected. The browser fetches the one it paints as a background
              from the same cache entry.
            */}
            <img src={preset.url} alt="" loading="lazy" className="size-full object-cover" />
          </Tile>
        ))}

        {images.map((option) => (
          <Tile
            key={option.url}
            label={option.label}
            active={url === option.url}
            onClick={() => pickImage(option.url)}
          >
            <img src={option.url} alt="" loading="lazy" className="size-full object-cover" />
          </Tile>
        ))}

        {colorPresets.map((preset) => (
          <Tile
            key={preset.value}
            label={preset.label}
            active={!image && color.toLowerCase() === preset.value}
            onClick={() => pickColor(preset.value)}
          >
            <span className="block size-full" style={{ backgroundColor: preset.value }} />
          </Tile>
        ))}

        <Tile label="None" active={!image && !color} onClick={clear}>
          <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <Ban className="size-4" aria-hidden="true" />
          </span>
        </Tile>

        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Tile label="Custom" active={false}>
              <span
                className="flex size-full items-center justify-center"
                style={{
                  backgroundImage:
                    'conic-gradient(from 200deg, #ff4d9d, #ffd6ba, #fff3b0, #c7f0d8, #cbe7ff, #ded1ff, #ff4d9d)',
                }}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground">
                  <Palette className="size-3.5" aria-hidden="true" />
                </span>
              </span>
            </Tile>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-64 space-y-3 p-3">
            <ColorControl
              label="Colour"
              value={color}
              // Keyed on the popover rather than on the value: these inputs are
              // uncontrolled, so something has to remount them to show a colour
              // set by a tile — but keying on the value itself would remount on
              // every keystroke and take the caret with it.
              fieldKey={`page:background-color:${customOpen}`}
              onChange={(value) => setBackground(target, { 'background-color': value })}
            />

            <ImageControl
              label="Image"
              value={url || image}
              preview={url}
              fieldKey={`page:background-image:${customOpen}`}
              onUpload={onUpload}
              hint="Upload one, or paste an https:// address or a gradient."
              onChange={(value) =>
                setBackground(target, { 'background-image': toBackgroundImage(value) })
              }
            />
          </PopoverContent>
        </Popover>
      </div>

      {image && (
        <div
          role="group"
          aria-label="How the image fills the page"
          className="flex gap-1 rounded-lg bg-muted p-1"
        >
          <FitButton active={!tiled} onClick={() => setBackground(target, fitPatches.cover)}>
            Cover
          </FitButton>
          <FitButton active={tiled} onClick={() => setBackground(target, fitPatches.tile)}>
            Tiled
          </FitButton>
        </div>
      )}
    </section>
  );
}

interface TileProps extends React.ComponentProps<'button'> {
  label: string;
  active: boolean;
}

/**
 * One swatch in the grid.
 *
 * The label is a tooltip and a screen-reader name rather than a caption: a
 * twelve-tile grid with a word under each reads as a list of names to be
 * compared, when the whole point is that you can see the difference.
 *
 * Props are forwarded so that the tile can be a `PopoverTrigger asChild` —
 * Radix hands its trigger the click handler, the ref and the expanded state,
 * and a component that swallowed them would render a button that does nothing.
 */
function Tile({ label, active, children, ...rest }: TileProps) {
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

function FitButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-7 flex-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
