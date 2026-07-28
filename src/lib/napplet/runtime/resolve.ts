import {
  NAPPLET_ENTRY,
  nappletFilter,
  parseNappletManifest,
  SNAPSHOT_NAPPLET_KIND,
  type NappletManifest,
  type NappletRef,
} from '../manifest';
import { isRelayUrl, RelayPool } from './relayPool';
import type { NappletIdentity, NappletNostrEvent } from './types';

/**
 * Turning a napplet reference into bytes that are safe to run.
 *
 * NIP-5D fixes a napplet's identity *before* any of its code runs, and binds it
 * to the exact bytes that will run. Everything here serves that: the manifest
 * is signature-checked (in `RelayPool`), each blob is checked against the hash
 * the author signed, and the identity is computed from the result — never
 * accepted from a gateway, a relay, or the napplet itself.
 */

/** A Blossom server is one that can produce bytes, not one that is believed. */
const BLOB_TIMEOUT = 15000;

export interface ResolvedNapplet {
  manifest: NappletManifest;
  identity: NappletIdentity;
  /** The verified `/index.html`, decoded as UTF-8. */
  html: string;
}

async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeServer(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Manifest hints first, then whatever the host knows about. */
function blobServers(manifest: NappletManifest, extra: string[]): string[] {
  const seen = new Set<string>();

  return [...manifest.servers, ...extra].map(normalizeServer).filter((url) => {
    if (!url || seen.has(url.toLowerCase())) return false;
    seen.add(url.toLowerCase());
    return true;
  });
}

/**
 * One blob, from the first server whose bytes digest to the hash the author
 * signed. A server that answers with anything else is treated exactly like one
 * that doesn't answer — which is what makes an untrusted server usable.
 */
async function fetchVerifiedBlob(
  sha256: string,
  servers: string[],
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  for (const server of servers) {
    signal?.throwIfAborted();

    try {
      const response = await fetch(`${server}/${sha256}`, {
        signal: AbortSignal.any([
          AbortSignal.timeout(BLOB_TIMEOUT),
          ...(signal ? [signal] : []),
        ]),
      });
      if (!response.ok) continue;

      const bytes = await response.arrayBuffer();
      if ((await sha256Hex(bytes)) === sha256) return bytes;
    } catch {
      // Unreachable, CORS refusal, timeout — all the same answer here.
      signal?.throwIfAborted();
    }
  }

  return null;
}

/**
 * The napplet's content address.
 *
 * NIP-5D calls for the NIP-5A aggregate hash of the `path` tags, but NIP-5A
 * defines no aggregate hash and no `x` tag, so there is nothing to recompute
 * and nothing the manifest's `x` tag can be checked against. This stands in:
 * a digest over the same `(path, sha256)` list, which addresses exactly the
 * bytes that run and changes whenever any of them does. It is used for storage
 * scoping and message routing, both of which only need those two properties.
 *
 * It is deliberately *not* compared against the manifest's `x` tag — a value
 * computed by a different rule would never match. See `NIP.md`.
 */
async function computeAggregate(manifest: NappletManifest): Promise<string> {
  const canonical = manifest.paths.map(({ path, sha256 }) => `${path}\n${sha256}`).join('\n');
  return sha256Hex(new TextEncoder().encode(canonical));
}

/** The relays to ask, hints from the reference first. */
export function resolveRelays(ref: NappletRef, configured: string[]): string[] {
  const seen = new Set<string>();
  return [...(ref.relays ?? []), ...configured].filter((url) => {
    if (!isRelayUrl(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * Resolves a reference to verified, runnable bytes.
 *
 * Throws with something explainable at every step that can fail, because each
 * failure means something different to whoever put the napplet on the page: no
 * manifest is a napplet that was never published or has been unpublished, and
 * no blob is one whose bytes have fallen off every server that held them.
 */
export async function resolveNapplet(
  ref: NappletRef,
  options: { relays: string[]; blossomServers: string[]; pool?: RelayPool; signal?: AbortSignal },
): Promise<ResolvedNapplet> {
  const relays = resolveRelays(ref, options.relays);
  if (!relays.length) throw new Error('No relays available to look this napplet up on.');

  const pool = options.pool ?? new RelayPool(relays);
  let events: NappletNostrEvent[];
  try {
    events = await pool.query([nappletFilter(ref)]);
  } finally {
    if (!options.pool) pool.destroy();
  }

  // Relays each return their own copy of a replaceable event; the newest wins.
  const event = events.reduce<NappletNostrEvent | null>(
    (best, candidate) => (!best || candidate.created_at > best.created_at ? candidate : best),
    null,
  );
  if (!event) throw new Error('No napplet manifest found on any relay.');

  // A snapshot is fetched by id, so the filter could not constrain the author.
  // The reference names one, and running code signed by anybody else would
  // defeat the point of naming it.
  if (ref.kind === SNAPSHOT_NAPPLET_KIND && event.pubkey !== ref.pubkey) {
    throw new Error('The napplet manifest was signed by a different key.');
  }

  const manifest = parseNappletManifest(event, ref);

  const entry = manifest.paths.find(({ path }) => path === NAPPLET_ENTRY);
  if (!entry) throw new Error(`The manifest has no ${NAPPLET_ENTRY}.`);

  const servers = blobServers(manifest, options.blossomServers);
  if (!servers.length) throw new Error('The manifest names no Blossom server to fetch from.');

  const bytes = await fetchVerifiedBlob(entry.sha256, servers, options.signal);
  if (!bytes) throw new Error('No Blossom server produced bytes matching the signed hash.');

  return {
    manifest,
    identity: {
      dTag: ref.identifier ?? '',
      aggregateHash: await computeAggregate(manifest),
    },
    html: new TextDecoder().decode(bytes),
  };
}
