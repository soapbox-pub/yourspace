import { useQuery } from '@tanstack/react-query';

import { resolveNip05 } from '@/lib/nip05';

/** Resolves a NIP-05 identifier, or stays idle when given nothing. */
export function useNip05(identifier: string | undefined) {
  return useQuery({
    queryKey: ['nip05', identifier],
    queryFn: ({ signal }) =>
      resolveNip05(identifier!, AbortSignal.any([signal, AbortSignal.timeout(5000)])),
    enabled: !!identifier,
    staleTime: 60 * 60 * 1000, // NIP-05 records change rarely.
    retry: 1,
  });
}

/**
 * Confirms that a pubkey's claimed NIP-05 really points back at it.
 *
 * Verification is what makes the name safe to put in a URL; see `getProfileUrl`.
 */
export function useNip05Verified(pubkey: string | undefined, nip05: string | undefined) {
  const { data } = useNip05(pubkey && nip05 ? nip05 : undefined);
  return data === pubkey && !!pubkey;
}
