import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { nsiteFilter, type NsiteRef } from '@/lib/nsite/manifest';

/**
 * The manifest event for one site, or `null` if nothing is published there.
 *
 * `nsiteFilter` constrains on the author, which is what makes the result
 * trustworthy: a manifest is replaceable/addressable, so without an author
 * filter anyone could publish a `d` tag collision and have it served as
 * somebody else's homepage.
 */
export function useNsite(ref: NsiteRef | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nsite', ref?.kind, ref?.pubkey, ref?.identifier ?? ''],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([nsiteFilter(ref!)], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });

      // Relays each return their own copy of a replaceable event; the newest wins.
      return events.reduce<(typeof events)[number] | null>(
        (best, event) => (!best || event.created_at > best.created_at ? event : best),
        null,
      );
    },
    enabled: !!ref,
  });
}
