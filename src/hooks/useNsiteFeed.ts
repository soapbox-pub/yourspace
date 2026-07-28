import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { ROOT_SITE_KIND } from '@/lib/nsite/manifest';

/** Relays cap what they'll return anyway; this is a showcase, not an archive. */
const LIMIT = 60;

/**
 * Recently published root nsites by a given set of people.
 *
 * Root sites only (kind 15128): one per person, which is what makes this a
 * showcase of homepages rather than a list of every subdirectory anyone has
 * ever deployed.
 *
 * An empty author list yields nothing rather than everything — a filter with
 * no `authors` would silently widen to the whole network, which is the
 * opposite of what a Follows tab with no follows should show.
 */
export function useNsiteFeed(authors: string[] | undefined, enabled = true) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nsite-feed', authors],
    queryFn: async ({ signal }): Promise<NostrEvent[]> => {
      const events = await nostr.query(
        [{ kinds: [ROOT_SITE_KIND], authors: authors!, limit: LIMIT }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) },
      );

      // Replaceable, so each author can appear once per relay. Keep the newest
      // copy of each, then order by how recently it was deployed.
      const newest = new Map<string, NostrEvent>();
      for (const event of events) {
        const seen = newest.get(event.pubkey);
        if (!seen || event.created_at > seen.created_at) newest.set(event.pubkey, event);
      }

      return [...newest.values()]
        // A manifest with no files isn't a site anyone can visit.
        .filter((event) => event.tags.some(([name]) => name === 'path'))
        .sort((a, b) => b.created_at - a.created_at);
    },
    enabled: enabled && !!authors?.length,
  });
}
