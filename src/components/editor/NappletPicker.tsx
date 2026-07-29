import { useMemo, useState } from 'react';
import type { Editor } from 'grapesjs';
import type { NostrEvent } from '@nostrify/nostrify';
import { AlertCircle, ChevronRight, ExternalLink, Search, ShieldCheck } from 'lucide-react';

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
import { useAuthor } from '@/hooks/useAuthor';
import { useNapplets } from '@/hooks/useNapplets';
import { nappletMarkup } from '@/lib/napplet/component';
import {
  decodeNappletRef,
  encodeNappletRef,
  NAMED_NAPPLET_KIND,
  parseNappletManifest,
  type NappletManifest,
} from '@/lib/napplet/manifest';
import { GRANTED_DOMAINS } from '@/lib/napplet/runtime/session';
import { cn } from '@/lib/utils';
import { insertContent } from './insertContent';
import { paletteLinkArrowClass, paletteLinkClass } from './paletteCard';

interface NappletPickerProps {
  editor: Editor | null;
}

/** A manifest paired with the identifier that addresses it. */
interface Listing {
  manifest: NappletManifest;
  reference: string;
}

function toListing(event: NostrEvent): Listing | null {
  const identifier = event.tags.find(([name]) => name === 'd')?.[1] ?? '';
  const reference = encodeNappletRef(event);

  return {
    reference,
    manifest: parseNappletManifest(event, {
      kind: NAMED_NAPPLET_KIND,
      pubkey: event.pubkey,
      identifier,
    }),
  };
}

function NappletRow({ listing, onPick }: { listing: Listing; onPick: (listing: Listing) => void }) {
  const { manifest } = listing;
  const author = useAuthor(manifest.event.pubkey);
  const metadata = author.data?.metadata;
  const name = metadata?.display_name || metadata?.name || 'Anonymous';

  const missing = manifest.requires.filter(
    (domain) => !GRANTED_DOMAINS.includes(domain as (typeof GRANTED_DOMAINS)[number]),
  );

  return (
    <button
      type="button"
      onClick={() => onPick(listing)}
      className="flex w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">
            {manifest.title || manifest.ref.identifier || 'Untitled napplet'}
          </p>
          <p className="truncate text-sm text-muted-foreground">by {name}</p>
        </div>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {manifest.paths.length} {manifest.paths.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {manifest.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {manifest.description}
        </p>
      )}

      {manifest.requires.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {manifest.requires.map((domain) => (
            <span
              key={domain}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs',
                missing.includes(domain)
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'text-muted-foreground',
              )}
            >
              {domain}
            </span>
          ))}
          {missing.length > 0 && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              not available here
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/**
 * Browses published napplets and drops one onto the page.
 *
 * What lands on the canvas is a placeholder holding an `naddr` and nothing
 * else — no code is copied into the site. The napplet is fetched, verified
 * against its author's signature and run in a sandbox every time the page is
 * read, so it stays whatever its author currently publishes rather than being
 * frozen at the moment it was picked.
 */
export function NappletPicker({ editor }: NappletPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data, isLoading, error } = useNapplets(open);

  const listings = useMemo(() => {
    const all = (data ?? []).map(toListing).filter((entry): entry is Listing => entry !== null);
    const term = query.trim().toLowerCase();
    if (!term) return all;

    return all.filter(({ manifest }) =>
      [manifest.title, manifest.description, manifest.ref.identifier]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term)),
    );
  }, [data, query]);

  /** A pasted `naddr`, when the box holds one instead of a search term. */
  const pasted = useMemo(() => {
    const value = query.trim();
    return value && decodeNappletRef(value) ? value : null;
  }, [query]);

  const insert = (reference: string) => {
    if (!editor) return;
    insertContent(editor, nappletMarkup(reference));
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/*
          Quiet on purpose. Napplets are the panel's most exotic offering and
          its least reached for, so they get a line of text rather than a card
          competing with the blocks above.
        */}
        <button type="button" disabled={!editor} className={cn(paletteLinkClass, 'px-1')}>
          Browse napplets
          <ChevronRight className={paletteLinkArrowClass} aria-hidden="true" />
        </button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Browse Napplets</DialogTitle>
          <DialogDescription>
            Small apps published to Nostr. The one you pick is fetched and checked against its
            author&rsquo;s signature every time your page is opened, then run in a sandbox of its
            own.
          </DialogDescription>
        </DialogHeader>

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
              placeholder="Search, or paste an naddr…"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search napplets"
              className="px-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-4">
          {pasted && (
            <button
              type="button"
              onClick={() => insert(pasted)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium text-foreground">Add this napplet</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {pasted}
                </span>
              </span>
            </button>
          )}

          {error ? (
            <p className="flex items-start gap-1.5 py-8 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error instanceof Error ? error.message : 'Could not reach any relay.'}
            </p>
          ) : isLoading ? (
            Array.from({ length: 4 }, (_unused, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          ) : !listings.length && !pasted ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                {query.trim()
                  ? `Nothing published matches “${query.trim()}”.`
                  : 'No napplets found on your relays yet. Paste an naddr above to add one directly.'}
              </p>
            </div>
          ) : (
            listings.map((listing) => (
              <NappletRow
                key={`${listing.manifest.event.pubkey}:${listing.manifest.ref.identifier}`}
                listing={listing}
                onPick={(picked) => insert(picked.reference)}
              />
            ))
          )}
        </div>

        <p className="flex shrink-0 items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          Napplets run with no origin of their own: no storage, no network, and no way to reach the
          page around them except through this app.
        </p>
      </DialogContent>
    </Dialog>
  );
}
