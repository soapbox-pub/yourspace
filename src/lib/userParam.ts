import { nip19 } from 'nostr-tools';
import type { NostrMetadata } from '@nostrify/nostrify';

import { isNip05Like, resolveNip05, splitNip05 } from '@/lib/nip05';
import { ROOT_SITE_KIND, NAMED_SITE_KIND, type NsiteRef } from '@/lib/nsite/manifest';

/**
 * Whatever a person types to name someone else's page.
 *
 * Two places take such a string: the path segment at the root of the site
 * (`/alex@gleasonator.com`, `/soapbox.pub`, `/npub1…`, `/naddr1…`) and the
 * editor's import dialog. They accept the same spellings from the same parser,
 * because a string that works as a link should work when pasted, and the other
 * way round.
 *
 * Everything but NIP-05 resolves offline; NIP-05 needs an HTTPS round-trip
 * first, which is why the parse stops at naming the work rather than doing it.
 */

const HEX_64 = /^[0-9a-f]{64}$/;

/** Long enough for a slow `.well-known`, short enough not to feel hung. */
const NIP05_TIMEOUT = 5000;

export type UserParam =
  /** An nsite, named outright. */
  | { kind: 'ref'; ref: NsiteRef }
  /** Needs a `.well-known/nostr.json` round-trip before it names anything. */
  | { kind: 'nip05'; identifier: string };

/**
 * Works out what an identifier refers to, throwing a message fit to show if it
 * refers to nothing.
 *
 * An `nsec` decodes perfectly well and must never be treated as an identity —
 * it is rejected along with note ids and anything else that doesn't name a
 * page.
 */
export function parseUserParam(value: string): UserParam {
  const trimmed = value.trim().replace(/^nostr:/i, '');
  if (!trimmed) throw new Error('Enter an npub, naddr, or NIP-05 address.');

  if (isNip05Like(trimmed)) {
    const identifier = trimmed.replace(/^@/, '');
    if (!splitNip05(identifier)) {
      throw new Error(`${trimmed} isn’t a usable NIP-05 address.`);
    }
    return { kind: 'nip05', identifier };
  }

  // A bare hex pubkey isn't a spelling this app links to, but it's cheap to
  // honour when someone types one.
  if (HEX_64.test(trimmed)) {
    return { kind: 'ref', ref: { kind: ROOT_SITE_KIND, pubkey: trimmed } };
  }

  let decoded: nip19.DecodedResult;
  try {
    decoded = nip19.decode(trimmed);
  } catch {
    throw new Error('That doesn’t decode as a NIP-19 identifier or NIP-05 address.');
  }

  // A key names a person, not a site, so it resolves to their root site — the
  // single kind 15128 a pubkey may have.
  switch (decoded.type) {
    case 'npub':
      return { kind: 'ref', ref: { kind: ROOT_SITE_KIND, pubkey: decoded.data } };
    case 'nprofile':
      return { kind: 'ref', ref: { kind: ROOT_SITE_KIND, pubkey: decoded.data.pubkey } };
    case 'naddr': {
      const { kind, pubkey, identifier } = decoded.data;
      // A root site is replaceable, so an naddr for one is unusual but
      // unambiguous — the identifier is simply ignored, as it must be empty.
      if (kind === ROOT_SITE_KIND) return { kind: 'ref', ref: { kind, pubkey } };
      if (kind !== NAMED_SITE_KIND) {
        throw new Error(
          `That naddr points at kind ${kind}. Named nsites are kind ${NAMED_SITE_KIND}.`,
        );
      }
      if (!identifier) throw new Error('That naddr carries no site identifier.');
      return { kind: 'ref', ref: { kind, pubkey, identifier } };
    }
    default:
      throw new Error(`An ${decoded.type} doesn’t name a page. Use an npub, naddr, or NIP-05.`);
  }
}

/** `parseUserParam` for callers that only need to know whether it worked. */
export function tryParseUserParam(value: string): UserParam | null {
  try {
    return parseUserParam(value);
  } catch {
    return null;
  }
}

/**
 * Parses an identifier and resolves it the rest of the way, NIP-05 included.
 *
 * For anything already self-contained this never touches the network, so a
 * typo fails immediately rather than after a lookup.
 */
export async function resolveNsiteRef(value: string, signal?: AbortSignal): Promise<NsiteRef> {
  const parsed = parseUserParam(value);
  if (parsed.kind === 'ref') return parsed.ref;

  const timeout = AbortSignal.timeout(NIP05_TIMEOUT);

  let pubkey: string | null;
  try {
    pubkey = await resolveNip05(
      parsed.identifier,
      signal ? AbortSignal.any([signal, timeout]) : timeout,
    );
  } catch (error) {
    // The caller giving up isn't a failure to report; anything else is.
    if (signal?.aborted) throw error;
    // A DNS failure, a CORS refusal, a slow server and an offline laptop are
    // one story from here: the domain didn't answer.
    throw new Error(`Couldn’t reach ${splitNip05(parsed.identifier)?.domain ?? 'that domain'}.`, {
      cause: error,
    });
  }

  if (!pubkey) throw new Error(`${parsed.identifier} doesn’t resolve to a Nostr key.`);
  return { kind: ROOT_SITE_KIND, pubkey };
}

/**
 * The URL for someone's page.
 *
 * A verified NIP-05 makes for a far better link than an npub, but only once
 * verified: the name lives in a kind 0, which anyone can put anything in, so
 * an unverified claim would let one person's link point at another's page.
 * Callers that haven't checked get the npub, which can't be forged.
 */
export function getProfileUrl(
  pubkey: string,
  metadata?: NostrMetadata,
  nip05Verified = false,
): string {
  const nip05 = nip05Verified ? metadata?.nip05 : undefined;

  if (nip05) {
    // `_@example.com` is the domain's root user, and reads better as the bare
    // domain — which is how `parseUserParam` takes it back apart.
    return `/${nip05.startsWith('_@') ? nip05.slice(2) : nip05}`;
  }

  return `/${nip19.npubEncode(pubkey)}`;
}
