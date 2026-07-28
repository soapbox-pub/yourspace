import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { hexToBase36 } from '@/lib/nsite/subdomain';

const SEED_KEY = 'yourspace:seed';

/**
 * A random value kept in localStorage, used as the key for deriving private
 * identifiers. It never leaves the device and is not tied to any Nostr key.
 */
function getSeed(): string {
  const stored = localStorage.getItem(SEED_KEY);
  if (stored) return stored;

  const seed = crypto.randomUUID();
  localStorage.setItem(SEED_KEY, seed);
  return seed;
}

/**
 * Derive the subdomain a sandboxed frame runs on.
 *
 * The obvious choice — putting the site's own npub in the subdomain — would
 * give every app that embeds nsites the same origin per site, so one site's
 * localStorage would be readable by any other page that framed it. Keying the
 * HMAC on a device-local secret makes the origin unguessable from outside,
 * while staying stable for this browser so a site's storage survives reloads.
 *
 * `prefix` separates use-cases, so the same identifier under two purposes
 * never collides. The result is 50 base36 characters, inside the 63-character
 * limit on a subdomain label.
 */
export function deriveIframeSubdomain(prefix: string, identifier: string): string {
  const enc = new TextEncoder();
  const mac = hmac(sha256, enc.encode(getSeed()), enc.encode(`${prefix}|${identifier}`));
  return hexToBase36(bytesToHex(mac));
}
