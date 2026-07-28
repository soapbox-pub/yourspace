import { nip19 } from 'nostr-tools';
import type { NostrMetadata } from '@nostrify/nostrify';

import { ROOT_SITE_KIND, NAMED_SITE_KIND, type NsiteRef } from '@/lib/nsite/manifest';

/**
 * The single path segment at the root of the site identifies a person's page.
 *
 * Three spellings reach the same place, in rough order of how a human would
 * write them: `/alex@gleasonator.com`, `/soapbox.pub`, and `/npub1…`. The first
 * two are NIP-05, which has to be resolved over HTTPS before anything can be
 * queried; the last is self-contained.
 */

const HEX_64 = /^[0-9a-f]{64}$/;

export type UserParam =
  /** Resolvable without the network. */
  | { kind: 'pubkey'; pubkey: string }
  /** Needs a `.well-known/nostr.json` round-trip. */
  | { kind: 'nip05'; identifier: string }
  /** An naddr pointing at a specific named site. */
  | { kind: 'site'; ref: NsiteRef };

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

/**
 * Works out what a URL segment refers to, or `null` if it refers to nothing.
 *
 * An `nsec` decodes perfectly well and must never be treated as an identity —
 * it falls through to `null` along with note ids and anything unrecognised,
 * because none of them name a page.
 */
export function parseUserParam(value: string): UserParam | null {
  const trimmed = value.trim().replace(/^nostr:/i, '');
  if (!trimmed) return null;

  if (isNip05Like(trimmed)) {
    return { kind: 'nip05', identifier: trimmed.replace(/^@/, '') };
  }

  // A bare hex pubkey isn't a spelling this app links to, but it's cheap to
  // honour when someone types one.
  if (HEX_64.test(trimmed)) return { kind: 'pubkey', pubkey: trimmed };

  let decoded: nip19.DecodedResult;
  try {
    decoded = nip19.decode(trimmed);
  } catch {
    return null;
  }

  switch (decoded.type) {
    case 'npub':
      return { kind: 'pubkey', pubkey: decoded.data };
    case 'nprofile':
      return { kind: 'pubkey', pubkey: decoded.data.pubkey };
    case 'naddr': {
      const { kind, pubkey, identifier } = decoded.data;
      if (kind === ROOT_SITE_KIND) return { kind: 'pubkey', pubkey };
      if (kind === NAMED_SITE_KIND && identifier) {
        return { kind: 'site', ref: { kind: NAMED_SITE_KIND, pubkey, identifier } };
      }
      return null;
    }
    default:
      return null;
  }
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
