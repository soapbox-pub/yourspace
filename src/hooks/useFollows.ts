import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';

const HEX_64 = /^[0-9a-f]{64}$/;

/** The logged-in user's kind 3 contact list, as hex pubkeys. */
export function useFollows() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['follows', user?.pubkey],
    queryFn: async ({ signal }): Promise<string[]> => {
      const events = await nostr.query(
        [{ kinds: [3], authors: [user!.pubkey], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
      );

      // Kind 3 is replaceable and arrives once per relay; an older copy would
      // silently drop people the user has followed since.
      const latest = events.reduce<(typeof events)[number] | undefined>(
        (best, event) => (!best || event.created_at > best.created_at ? event : best),
        undefined,
      );

      return (latest?.tags ?? [])
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey)
        .filter((pubkey) => HEX_64.test(pubkey));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
