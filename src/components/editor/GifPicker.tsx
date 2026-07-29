import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from 'grapesjs';
import { AlertCircle, ChevronRight, Loader2, Search } from 'lucide-react';

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
import { useFrequentGifs } from '@/hooks/useFrequentGifs';
import { useGifSearch } from '@/hooks/useGifSearch';
import { gifUrl, type GifCitiesGif } from '@/lib/gifcities';
import { escapeHtml } from '@/lib/nsite/blocks';
import { cn } from '@/lib/utils';
import { CHECKERBOARD } from './checkerboard';
import { insertContent } from './insertContent';
import { paletteLinkArrowClass, paletteLinkClass, paletteSectionClass } from './paletteCard';

interface GifPickerProps {
  editor: Editor | null;
}

/** How many tiles the dialog's grid shows, and grows by as it is scrolled. */
const PAGE = 48;

/** Long enough that typing a word is one search rather than five. */
const DEBOUNCE = 350;

/**
 * What fills the dialog before anything has been typed.
 *
 * There is no browsing the archive: the service answers an empty query with
 * `null`, so something has to be asked for. This is the broadest term that is
 * still on-theme, and results arrive ordered by how many GeoCities pages used
 * the GIF — so the grid opens on the most widely used animations in the
 * archive, which are also the most recognisable.
 */
const BROWSE = 'animated';

/** How many GIFs the sidebar keeps within reach. Two rows of three. */
const SHELF = 6;

/**
 * What the shelf holds until the user has placed anything of their own: six of
 * the genre's landmarks, addressed by digest so they cost no search to show.
 *
 * The alt text is written rather than taken from the archive, whose own is the
 * GeoCities path each GIF was found at ("me tiers quebec images construction").
 */
const SHELF_SEED: GifCitiesGif[] = [
  { checksum: '7BOAHEMLEP2SFBRAZOGOQUDV4N346WV6', text: 'Under construction', width: 177, height: 175 },
  { checksum: 'LUWH64YFAZNHXQKUUK22GUGIQDOCUQJA', text: 'Email', width: 86, height: 50 },
  { checksum: 'CAOUOG6W4BV7DCCLCVCK4SYKMMQM45Z4', text: 'Guestbook', width: 112, height: 105 },
  { checksum: 'TTH2ESLVPZMWGJ3K4XIVOMFNNSRGOEUY', text: 'Spinning globe', width: 90, height: 90 },
  { checksum: 'H4LATVQPXRYRGJKHBTAAR6ZYSRYHVJBD', text: 'Flames', width: 256, height: 256 },
  { checksum: 'YXRSO5PPGFYRYZ27A4ZBJA6UDRIDXQQD', text: 'Dancing skeleton', width: 144, height: 117 },
].map((gif) => ({ ...gif, url: gifUrl(gif.checksum) }));

/** Quick jumps to the genre's landmarks, for anyone without a word in mind. */
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

const GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6';

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

function GifTile({
  gif,
  onPick,
  disabled,
}: {
  gif: GifCitiesGif;
  onPick: (gif: GifCitiesGif) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(gif)}
      title={gif.text || 'Untitled'}
      style={CHECKERBOARD}
      className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border p-1.5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
    >
      {/* Lazily: a query leaves thousands of tiles below the fold. */}
      <img
        src={gif.url}
        alt={gif.text}
        loading="lazy"
        decoding="async"
        className="max-h-full max-w-full object-contain"
      />
    </button>
  );
}

/** Full-text search over the whole archive, for when the shelf hasn't got it. */
function GifSearchDialog({ open, onPick }: { open: boolean; onPick: (gif: GifCitiesGif) => void }) {
  const [query, setQuery] = useState('');

  const scrollerRef = useRef<HTMLDivElement>(null);
  // State rather than a ref, so the observer is set up on the render the
  // sentinel first exists rather than the one after. The scroller above needs
  // no such treatment: it is mounted for as long as the dialog is.
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  const typed = useDebounced(query.trim(), DEBOUNCE);
  const term = typed || BROWSE;

  // Nothing is fetched until the dialog is open, so the shelf costs no request.
  const { data, isFetching, error } = useGifSearch(open ? term : '');

  /*
   * How far down the results the grid has been extended, tied to the term it
   * was counted for. Pairing the two means a new search starts at the top
   * without an effect to reset it, and that a slow response can't hand the
   * next term a scroll position from the last one.
   */
  const [page, setPage] = useState({ term: '', count: PAGE });
  const shown = page.term === term ? page.count : PAGE;

  const gifs = data ?? [];
  const searching = isFetching && !data;
  const more = shown < gifs.length;

  const grow = useCallback(() => {
    setPage((current) => ({
      term,
      count: (current.term === term ? current.count : PAGE) + PAGE,
    }));
  }, [term]);

  /*
   * Endless scroll, over an array that is already entirely in memory — the
   * service returns every match at once and ignores every paging parameter it
   * accepts. So this pages the DOM rather than the network, which is the whole
   * reason it is worth doing: thousands of animated GIFs decoding at once is
   * what would otherwise happen.
   *
   * The margin is generous for the same reason. Nothing is fetched to extend
   * the grid, so running a few rows ahead of the scroll costs only markup.
   */
  useEffect(() => {
    if (!sentinel || !more) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) grow();
      },
      { root: scrollerRef.current, rootMargin: '600px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, more, grow]);

  // A new search is a new list, and reading it from wherever the last one was
  // scrolled to would start it halfway down.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = 0;
  }, [term]);

  return (
    <DialogContent className="flex max-h-[85dvh] flex-col gap-0 sm:max-w-3xl">
      <DialogHeader className="shrink-0">
        <DialogTitle>Find a GIF</DialogTitle>
        <DialogDescription>
          The animated GIFs the Internet Archive rescued from GeoCities. Pick one to drop it below
          your selection.
        </DialogDescription>
      </DialogHeader>

      {/*
        The padding is on the wrapper and the positioning context is the
        field itself. Putting both on one element centres `top-1/2` on the
        padding box, which leaves the icons riding half the padding high.
      */}
      <div className="shrink-0 pt-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="Search the archive…"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search GifCities"
            aria-invalid={Boolean(error)}
            className="px-9"
          />
          {searching && (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 py-3">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setQuery(suggestion)}
            aria-pressed={typed === suggestion}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              typed === suggestion
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <p className="flex items-start gap-1.5 py-8 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error instanceof Error ? error.message : 'Could not reach GifCities.'}
          </p>
        ) : searching ? (
          <div className={GRID}>
            {Array.from({ length: 18 }, (_unused, index) => (
              <Skeleton key={index} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : !gifs.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing in the archive matches “{term}”.
          </p>
        ) : (
          <>
            <div className={GRID}>
              {gifs.slice(0, shown).map((gif) => (
                <GifTile key={gif.checksum} gif={gif} onPick={onPick} />
              ))}
            </div>

            {more && (
              <div ref={setSentinel} className="flex justify-center py-4" aria-hidden="true">
                <Loader2 className="size-4 text-muted-foreground motion-safe:animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {gifs.length > 0 && !error && (
        <p className="shrink-0 border-t pt-3 text-xs text-muted-foreground">
          {typed
            ? `${gifs.length.toLocaleString()} matches for “${typed}”`
            : `${gifs.length.toLocaleString()} of the archive’s most-used animations`}{' '}
          — served by the Internet Archive.
        </p>
      )}
    </DialogContent>
  );
}

/**
 * A shelf of GIFs ready to place, and search over the rest of the archive.
 *
 * The shelf is the point. A page in this genre wants half a dozen animations on
 * it, and going through a search dialog for each one is the difference between
 * decorating and shopping. It fills with whatever the user reaches for most, so
 * after a site or two it is their own palette rather than a suggestion.
 *
 * Every GIF is linked from the Internet Archive's blob host rather than copied
 * into the site's own files. Those URLs are content-addressed, so they are as
 * durable as the archive itself, and a homepage that borrows a dozen of them
 * ships nothing heavier than a dozen `<img>` tags.
 */
export function GifPicker({ editor }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const { gifs: frequent, remember } = useFrequentGifs();

  // The user's own first, topped up from the seed — so the shelf is full on the
  // first visit and has turned over entirely by the sixth GIF they place.
  const shelf = useMemo(() => {
    const mine = frequent.slice(0, SHELF);
    const seen = new Set(mine.map((gif) => gif.checksum));

    return [...mine, ...SHELF_SEED.filter((gif) => !seen.has(gif.checksum))].slice(0, SHELF);
  }, [frequent]);

  const pick = (gif: GifCitiesGif) => {
    if (!editor) return;

    insertContent(editor, gifMarkup(gif));
    remember(gif);
    setOpen(false);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 className={paletteSectionClass}>GIFs</h3>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button type="button" disabled={!editor} className={paletteLinkClass}>
              Search the archive
              <ChevronRight className={paletteLinkArrowClass} aria-hidden="true" />
            </button>
          </DialogTrigger>

          <GifSearchDialog open={open} onPick={pick} />
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {shelf.map((gif) => (
          <GifTile key={gif.checksum} gif={gif} onPick={pick} disabled={!editor} />
        ))}
      </div>
    </section>
  );
}
