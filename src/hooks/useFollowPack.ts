import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';

/** NIP-51 follow pack: a curated, shareable list of people. */
const FOLLOW_PACK_KIND = 39089;

const HEX_64 = /^[0-9a-f]{64}$/;

export interface FollowPack {
  title?: string;
  description?: string;
  image?: string;
  pubkeys: string[];
}

/**
 * The members of a follow pack, addressed by naddr.
 *
 * Pubkeys are filtered to well-formed hex because they go straight into a
 * relay filter and are handed to `npubEncode`, both of which a malformed `p`
 * tag would break.
 */
export function useFollowPack(naddr: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['follow-pack', naddr],
    queryFn: async ({ signal }): Promise<FollowPack | null> => {
      const decoded = nip19.decode(naddr!);
      if (decoded.type !== 'naddr' || decoded.data.kind !== FOLLOW_PACK_KIND) return null;

      const { pubkey, identifier } = decoded.data;

      const [event] = await nostr.query(
        [{
          kinds: [FOLLOW_PACK_KIND],
          // The pack is addressable, so the author is the trust boundary — a
          // `d` tag on its own is something anyone can claim.
          authors: [pubkey],
          '#d': [identifier],
          limit: 1,
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
      );

      if (!event) return null;

      const tag = (name: string) => event.tags.find(([n]) => n === name)?.[1];

      return {
        title: tag('title'),
        description: tag('description'),
        image: tag('image'),
        pubkeys: event.tags
          .filter(([n]) => n === 'p')
          .map(([, pk]) => pk)
          .filter((pk) => HEX_64.test(pk)),
      };
    },
    enabled: !!naddr,
    staleTime: 30 * 60 * 1000,
  });
}
