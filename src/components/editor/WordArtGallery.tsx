import type { CSSProperties } from 'react';
import type { Component } from 'grapesjs';

import {
  applyWordArtStyle,
  wordArtStyleId,
  wordArtStyles,
  type WordArtStyle,
} from '@/lib/nsite/wordart';
import { cn } from '@/lib/utils';
import { RangeControl } from './fields';
import { setStyle, styleValue } from './styleTarget';

/**
 * The word art gallery, shown in the inspector when a word art block is
 * selected.
 *
 * Each preset is drawn wearing itself, in the same spirit as the layout picker
 * and the starter tiles: an effect is a look, and a look is quicker to
 * recognise than to read. A list of names — Chrome, Retro, Candy — would make
 * you click all thirteen to find out what they are.
 *
 * Only two controls, because there are only two decisions. Everything else the
 * element panel already does well, and it stays available underneath: this is a
 * section added to the ordinary panel rather than a replacement for it, so the
 * lettering can still be centred, given room around it, or nudged onto a
 * different font size than the slider offers.
 */

/** How far the size slider runs, in px. */
const MIN_SIZE = 16;
const MAX_SIZE = 180;
const SIZE_STEP = 2;
const DEFAULT_SIZE = 56;

/** The size the tiles draw at. Small enough for two across a 300px panel. */
const PREVIEW_SIZE = 21;

/**
 * The preset's CSS as React wants it.
 *
 * The presets are written in CSS spelling because that is what is written onto
 * the component and into the published page; React needs the same properties
 * camel-cased, and a vendor prefix capitalised along with it —
 * `-webkit-text-fill-color` becomes `WebkitTextFillColor`, which the leading
 * dash makes fall out of the same replacement as every other word boundary.
 */
function toReactStyle(css: Record<string, string>): CSSProperties {
  const entries = Object.entries(css).map(([property, value]) => [
    property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    value,
  ]);

  return Object.fromEntries(entries) as CSSProperties;
}

interface StyleTileProps {
  style: WordArtStyle;
  active: boolean;
  onSelect: () => void;
}

function StyleTile({ style, active, onSelect }: StyleTileProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={style.label}
      onClick={onSelect}
      className={cn(
        'flex h-14 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 px-2 transition-all',
        'hover:border-primary/40 hover:bg-accent hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active && 'border-primary bg-accent ring-2 ring-primary/30',
      )}
    >
      {/*
        The name is the sample. `aria-hidden` because the accessible name comes
        from the title above — a screen reader should hear "Chrome" once, not
        read a decorative word back as though it were content.
      */}
      <span
        aria-hidden="true"
        className="whitespace-nowrap leading-none"
        style={{ fontSize: PREVIEW_SIZE, ...toReactStyle(style.css) }}
      >
        {style.label}
      </span>
      <span className="sr-only">{style.label}</span>
    </button>
  );
}

/**
 * The size in px, or the default.
 *
 * A size in some other unit still has to put the thumb somewhere, and the
 * default is a better guess than either end of the track. Dragging then writes
 * px, which is the trade every slider over a free-text CSS value makes.
 */
function fontSize(component: Component): number {
  const px = /^(\d+(?:\.\d+)?)px$/.exec(styleValue(component, 'font-size').trim());
  const size = px ? Math.round(Number(px[1])) : DEFAULT_SIZE;

  return Math.min(Math.max(size, MIN_SIZE), MAX_SIZE);
}

export function WordArtGallery({ component }: { component: Component }) {
  const active = wordArtStyleId(component);
  const size = fontSize(component);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {wordArtStyles.map((style) => (
          <StyleTile
            key={style.id}
            style={style}
            active={style.id === active}
            onSelect={() => applyWordArtStyle(component, style.id)}
          />
        ))}
      </div>

      <RangeControl
        label="Size"
        value={size}
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={SIZE_STEP}
        valueLabel={`${size}px`}
        onChange={(value) => setStyle(component, { 'font-size': `${value}px` })}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Double-click the lettering on the page to change the words.
      </p>
    </>
  );
}
