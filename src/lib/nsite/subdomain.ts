import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

import { NAMED_SITE_KIND } from './manifest';

/** A base36-encoded 32-byte pubkey is always padded to this width. */
const BASE36_PUBKEY_LENGTH = 50;

/**
 * Encode a 32-byte hex pubkey as base36.
 *
 * Subdomain labels are case-insensitive and capped at 63 characters, which
 * rules out hex (too long once a `d` tag is appended) and bech32's mixed case.
 * Base36 fits 256 bits in 50 characters.
 */
export function hexToBase36(hex: string): string {
  let n = 0n;
  for (let i = 0; i < hex.length; i++) {
    n = n * 16n + BigInt(parseInt(hex[i], 16));
  }
  return n.toString(36).padStart(BASE36_PUBKEY_LENGTH, '0');
}

/**
 * The NIP-5A canonical subdomain for a manifest: the npub for a root site, or
 * the base36 pubkey followed by the `d` tag for a named one.
 *
 * This is the site's stable public identity — the thing that would appear in a
 * URL on an nsite gateway. It is not used as a sandbox origin directly; see
 * `deriveIframeSubdomain`.
 */
export function getNsiteSubdomain(event: NostrEvent): string {
  const identifier = event.tags.find(([name]) => name === 'd')?.[1];

  if (event.kind === NAMED_SITE_KIND && identifier) {
    return `${hexToBase36(event.pubkey)}${identifier}`;
  }

  return nip19.npubEncode(event.pubkey);
}
