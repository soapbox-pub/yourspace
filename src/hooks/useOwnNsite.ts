import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { fetchNsite, NsiteNotFoundError, type NsiteImport } from '@/lib/nsite/fetchNsite';
import { ROOT_SITE_KIND } from '@/lib/nsite/manifest';

/**
 * A key's own root site, fetched whole and ready to open in the editor.
 *
 * Resolves to `null` when nothing is published there. That is the ordinary
 * answer for someone who hasn't made a site rather than a failure, so it comes
 * back as an absent site; everything else — a relay that never answered, blobs
 * no server would produce — is left to reject, because those are cases where
 * there *is* a site and the caller should say it couldn't be opened.
 */
export function useOwnNsite(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<NsiteImport | null>({
    queryKey: ['own-nsite', pubkey],
    queryFn: async ({ signal }) => {
      try {
        return await fetchNsite(nostr, { kind: ROOT_SITE_KIND, pubkey: pubkey! }, { signal });
      } catch (error) {
        if (error instanceof NsiteNotFoundError) return null;
        throw error;
      }
    },
    enabled: !!pubkey,
    // The files carry object URLs, and whoever imports them revokes them once
    // the project they belong to is replaced. A cached copy would hand a later
    // reader URLs that no longer resolve, so this opts out of the app-wide
    // `gcTime: Infinity` and is fetched afresh each time it's wanted.
    gcTime: 0,
    staleTime: 0,
    // A whole site is dozens of requests. If it didn't work, say so and leave
    // the Import button to try again, rather than quietly doing it all twice.
    retry: false,
    // The answer is only wanted once, when the editor opens on it. Fetching a
    // site again later costs the same dozens of requests to produce something
    // that would be too late to use.
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
