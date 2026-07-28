import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { isValidNapplet, NAMED_NAPPLET_KIND } from '@/lib/napplet/manifest';

/** Relays cap what they return anyway; this is a directory, not an archive. */
const LIMIT = 100;

/**
 * Named napplets (kind 35129) published to the app's relays.
 *
 * Deliberately unfiltered by author. This is discovery — the whole point is to
 * find napplets by people you have never heard of — and nothing here is trusted
 * on the strength of appearing in the list: a napplet only ever runs after its
 * manifest signature and every one of its blobs has been checked, inside a
 * frame with no origin. Trust is enforced where the code runs, not by who is
 * allowed into a directory.
 *
 * `d` tags collide across authors by design, so results are keyed on the pair.
 */
export function useNapplets(enabled = true) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['napplets'],
    queryFn: async ({ signal }): Promise<NostrEvent[]> => {
      const events = await nostr.query([{ kinds: [NAMED_NAPPLET_KIND], limit: LIMIT }], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      });

      // Addressable, so each author/identifier pair can arrive once per relay.
      const newest = new Map<string, NostrEvent>();

      for (const event of events) {
        // A manifest with no `/index.html` is not something that can be run,
        // and putting it in the list would only offer a broken choice.
        if (!isValidNapplet(event)) continue;

        const identifier = event.tags.find(([name]) => name === 'd')?.[1] ?? '';
        const key = `${event.pubkey}:${identifier}`;
        const seen = newest.get(key);
        if (!seen || event.created_at > seen.created_at) newest.set(key, event);
      }

      return [...newest.values()].sort((a, b) => b.created_at - a.created_at);
    },
    enabled,
  });
}
