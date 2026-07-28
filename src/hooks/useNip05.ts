import { useQuery } from '@tanstack/react-query';

const HEX_64 = /^[0-9a-f]{64}$/;

/** Split `user@example.com` — or a bare `example.com`, which means `_`. */
function splitNip05(identifier: string): { name: string; domain: string } | null {
  const cleaned = identifier.replace(/^@/, '');
  const at = cleaned.indexOf('@');

  const name = at === -1 ? '_' : cleaned.slice(0, at);
  const domain = at === -1 ? cleaned : cleaned.slice(at + 1);

  if (!name || !domain || !domain.includes('.')) return null;
  return { name, domain };
}

/**
 * Resolve a NIP-05 identifier to a pubkey.
 *
 * The value comes back from a third-party domain, so it is checked to be a
 * 64-character hex string before use — an unchecked value would flow straight
 * into a relay filter, and a broken or hostile server shouldn't be able to
 * decide what this app queries for.
 */
async function resolveNip05(identifier: string, signal: AbortSignal): Promise<string | null> {
  const parts = splitNip05(identifier);
  if (!parts) return null;

  const url = new URL('/.well-known/nostr.json', `https://${parts.domain}`);
  url.searchParams.set('name', parts.name);

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data: unknown = await response.json();
  const names = (data as { names?: unknown })?.names;
  if (!names || typeof names !== 'object') return null;

  const record = names as Record<string, unknown>;
  // Exact match first, then case-insensitively — servers don't agree on how
  // they normalise the name they were asked for.
  const match =
    record[parts.name] ??
    Object.entries(record).find(([key]) => key.toLowerCase() === parts.name.toLowerCase())?.[1];

  return typeof match === 'string' && HEX_64.test(match) ? match : null;
}

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
