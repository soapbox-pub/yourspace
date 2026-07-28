/**
 * NIP-05 identifiers: `alex@gleasonator.com`, or a bare `soapbox.pub`.
 *
 * Resolution is a plain HTTPS fetch against the domain, which makes it the one
 * identifier spelling that can't be turned into a pubkey offline. It lives
 * here, apart from the hook, so the import dialog can await it inside a
 * mutation while the routes go through TanStack Query.
 */

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Does this look like a NIP-05 identifier rather than a NIP-19 one?
 *
 * An `@` is decisive. Failing that, a dot means a bare domain like
 * `soapbox.pub`, which NIP-05 defines as the `_` user — bech32 has no dots, so
 * there's nothing to confuse it with.
 */
export function isNip05Like(value: string): boolean {
  if (value.includes('@')) return true;
  return value.includes('.') && !/^n(pub|profile)1/.test(value);
}

/** Split `user@example.com` — or a bare `example.com`, which means `_`. */
export function splitNip05(identifier: string): { name: string; domain: string } | null {
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
export async function resolveNip05(
  identifier: string,
  signal?: AbortSignal,
): Promise<string | null> {
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
