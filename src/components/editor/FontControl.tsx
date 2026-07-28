import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';

import {
  loadFonts,
  searchFonts,
  type FontCategory,
  type FontFamily,
} from '@/lib/fonts/catalogue';
import { cssFamilyName, primaryFamily } from '@/lib/fonts/install';
import { loadPreview } from '@/lib/fonts/preview';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Field } from './fields';

/**
 * A searchable list of every font Google publishes.
 *
 * The list is a file in this repo, so typing is answered locally and no part of
 * browsing tells anyone what is being considered. Each row sets its own name in
 * its own face, which is the only way to choose a typeface — but a face is
 * ~20KB, so a row loads its preview when it scrolls into view, and only after
 * it has stayed there long enough to suggest someone is looking at it rather
 * than typing past it.
 */

const categoryLabels: Record<FontCategory, string> = {
  'sans-serif': 'Sans',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Script',
  monospace: 'Mono',
  other: 'Other',
};

/** How long a row must stay on screen before its preview is worth fetching. */
const PREVIEW_DELAY = 200;

function FontRow({
  font,
  selected,
  onSelect,
}: {
  font: FontFamily;
  selected: boolean;
  onSelect: (font: FontFamily) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [previewed, setPreviewed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let timer: number | undefined;
    let live = true;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          window.clearTimeout(timer);
          return;
        }

        timer = window.setTimeout(() => {
          observer.disconnect();
          loadPreview(font)
            .then(() => live && setPreviewed(true))
            // A preview that doesn't arrive leaves the row in the UI font,
            // which is a missing nicety rather than something to report.
            .catch(() => {});
        }, PREVIEW_DELAY);
      },
      { rootMargin: '64px' },
    );

    observer.observe(element);

    return () => {
      live = false;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [font]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(font)}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'bg-accent',
      )}
    >
      <span
        className="min-w-0 flex-1 truncate text-sm text-foreground"
        // Only after the face is registered, so the name never renders in a
        // half-loaded fallback and jump when it settles.
        style={previewed ? { fontFamily: cssFamilyName(font.family) } : undefined}
      >
        {font.family}
      </span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {categoryLabels[font.category]}
      </span>
      {selected && <Check className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />}
    </button>
  );
}

interface FontControlProps {
  label: string;
  /** The current `font-family` declaration, or `''` when inherited. */
  value: string;
  /** Adds the font to the site and writes the declaration. */
  onPick: (font: FontFamily) => Promise<void>;
  onClear: () => void;
  hint?: string;
}

export function FontControl({ label, value, onPick, onClear, hint }: FontControlProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fonts, setFonts] = useState<FontFamily[]>([]);
  const [installing, setInstalling] = useState(false);

  const current = primaryFamily(value);

  // Deferred until the picker is first opened: the catalogue is ~50KB, and a
  // session that never changes a font should never fetch it.
  useEffect(() => {
    if (!open || fonts.length) return;

    let live = true;
    loadFonts()
      .then((list) => live && setFonts(list))
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [open, fonts.length]);

  // The inspector re-renders on every editor event, and this walks the whole
  // catalogue — there is no reason to redo it because a margin changed.
  const results = useMemo(() => searchFonts(fonts, query), [fonts, query]);

  const choose = async (font: FontFamily) => {
    setOpen(false);
    setInstalling(true);
    try {
      await onPick(font);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Field label={label} hint={hint}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            'flex h-8 w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm transition-colors',
            'hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          )}
        >
          <span
            className={cn('min-w-0 flex-1 truncate text-left', !current && 'text-muted-foreground')}
          >
            {current || 'Inherit'}
          </span>
          {installing ? (
            <Loader2
              className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="sr-only">{installing ? 'Adding font' : 'Choose a font'}</span>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-72 p-0">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fonts"
              aria-label="Search fonts"
              className="h-9 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClear();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Inherit
              {!current && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
            </button>

            {results.map((font) => (
              <FontRow
                key={font.id}
                font={font}
                selected={font.family === current}
                onSelect={(picked) => void choose(picked)}
              />
            ))}

            {fonts.length > 0 && results.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No font matches “{query}”.
              </p>
            )}

            {fonts.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading fonts…</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
