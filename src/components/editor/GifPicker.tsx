import { useEffect, useState, type CSSProperties } from 'react';
import type { Editor } from 'grapesjs';
import { AlertCircle, Loader2, Search, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useGifSearch } from '@/hooks/useGifSearch';
import type { GifCitiesGif } from '@/lib/gifcities';
import { escapeHtml } from '@/lib/nsite/blocks';
import { insertContent } from './insertContent';

interface GifPickerProps {
  editor: Editor | null;
}

/** How many tiles the grid shows, and grows by. */
const PAGE = 48;

/** Long enough that typing a word is one search rather than five. */
const DEBOUNCE = 350;

/** The genre, for anyone who arrives without a word in mind. */
const SUGGESTIONS = [
  'under construction',
  'welcome',
  'guestbook',
  'email',
  'flames',
  'rainbow',
  'dancing',
  'star',
];

/**
 * Transparency is everywhere in this archive, and a flat panel hides every GIF
 * drawn in white. The checkerboard stays light in both themes, because these
 * were made for light pages and are much more often dark-on-transparent.
 */
const CHECKERBOARD: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),' +
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 6px 6px',
};

/** `value`, once it has stopped changing for `delay`. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

/**
 * The markup a chosen GIF becomes.
 *
 * `width`/`height` carry the intrinsic size so the image holds its own space
 * before it loads, and `max-width:100%` keeps the wide ones — the dividers and
 * banners run to 600px — inside a phone. `height:auto` stops that rescaling
 * from squashing them.
 *
 * The `src` needs no escaping: it is built from a checksum already held to
 * base32. The alt text is the archive's, and does.
 */
function gifMarkup(gif: GifCitiesGif): string {
  const size = gif.width && gif.height ? ` width="${gif.width}" height="${gif.height}"` : '';

  return `<img src="${gif.url}" alt="${escapeHtml(gif.text)}"${size} style="max-width:100%;height:auto;display:inline-block;"/>`;
}

function GifGrid({ gifs, onPick }: { gifs: GifCitiesGif[]; onPick: (gif: GifCitiesGif) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
      {gifs.map((gif) => (
        <button
          key={gif.checksum}
          type="button"
          onClick={() => onPick(gif)}
          title={gif.text || 'Untitled'}
          style={CHECKERBOARD}
          className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border p-1.5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* Lazily, because a query can leave hundreds of tiles behind it. */}
          <img
            src={gif.url}
            alt={gif.text}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Full-text search over GifCities, dropping the chosen GIF onto the canvas.
 *
 * The GIF is linked from the Internet Archive's blob host rather than copied
 * into the site's own files. Those URLs are content-addressed, so they are as
 * durable as the archive itself, and a homepage that borrows a dozen of them
 * ships nothing heavier than a dozen `<img>` tags.
 */
export function GifPicker({ editor }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // How far down the results the grid has been extended, tied to the search it
  // was counted for, so a new one starts at the top without an effect to reset
  // it.
  const [page, setPage] = useState({ query: '', count: PAGE });

  const search = useDebounced(query.trim(), DEBOUNCE);
  // Nothing is fetched until the dialog is open, so the sidebar button costs
  // nothing to render.
  const { data, isFetching, error } = useGifSearch(open ? search : '');

  const gifs = data ?? [];
  const shown = page.query === search ? page.count : PAGE;
  const searching = isFetching && !data;

  const pick = (gif: GifCitiesGif) => {
    if (!editor) return;
    insertContent(editor, gifMarkup(gif));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mb-3 w-full gap-2" disabled={!editor}>
          <Sparkles className="size-4" aria-hidden="true" />
          Find a GIF
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Find a GIF</DialogTitle>
          <DialogDescription>
            Search the animated GIFs the Internet Archive rescued from GeoCities. Pick one to drop it
            below your selection.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0 py-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="under construction, dancing, flames…"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search GifCities"
            aria-invalid={Boolean(error)}
            className="pl-9"
          />
          {searching && (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="flex items-start gap-1.5 py-8 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error instanceof Error ? error.message : 'Could not reach GifCities.'}
            </p>
          ) : searching ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {Array.from({ length: 18 }, (_unused, index) => (
                <Skeleton key={index} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : !search ? (
            <div className="py-6">
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuery(suggestion)}
                    className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : !gifs.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing in the archive matches “{search}”.
            </p>
          ) : (
            <>
              <GifGrid gifs={gifs.slice(0, shown)} onPick={pick} />

              {shown < gifs.length && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage({ query: search, count: shown + PAGE })}
                  >
                    Show more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {gifs.length > 0 && !error && (
          <p className="shrink-0 border-t pt-3 text-xs text-muted-foreground">
            Showing {Math.min(shown, gifs.length).toLocaleString()} of{' '}
            {gifs.length.toLocaleString()} — served by the Internet Archive.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
