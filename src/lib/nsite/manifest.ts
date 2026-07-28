import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

/**
 * NIP-5A site manifests.
 *
 * An nsite is not a document — it is a list of `path` tags mapping absolute
 * paths to sha256 hashes, with the bytes themselves living on Blossom servers.
 * This module only deals with the manifest event; fetching the blobs is
 * `fetchNsite.ts`.
 */

/** Root site: replaceable, one per pubkey, no `d` tag. */
export const ROOT_SITE_KIND = 15128;
/** Named site: addressable, `d` tag is the site identifier. */
export const NAMED_SITE_KIND = 35128;

export interface NsiteRef {
  kind: typeof ROOT_SITE_KIND | typeof NAMED_SITE_KIND;
  pubkey: string;
  /** The `d` tag. Named sites only. */
  identifier?: string;
}

export interface NsiteManifest {
  ref: NsiteRef;
  event: NostrEvent;
  title?: string;
  description?: string;
  /** Absolute path to sha256, in manifest order, deduplicated by path. */
  paths: { path: string; sha256: string }[];
  /** `server` tag hints for where the blobs can be found. */
  servers: string[];
}

const SHA256 = /^[0-9a-f]{64}$/;

/** The relay filter for a reference. Always constrained to the author. */
export function nsiteFilter(ref: NsiteRef) {
  return ref.kind === NAMED_SITE_KIND
    ? {
        kinds: [NAMED_SITE_KIND],
        authors: [ref.pubkey],
        '#d': [ref.identifier ?? ''],
        limit: 1,
      }
    : { kinds: [ROOT_SITE_KIND], authors: [ref.pubkey], limit: 1 };
}

const firstTag = (event: NostrEvent, name: string): string | undefined =>
  event.tags.find(([tag]) => tag === name)?.[1] || undefined;

/**
 * Reads the parts of a manifest this app can act on, dropping anything
 * malformed rather than failing the whole import: a single bad `path` tag
 * shouldn't cost you the other forty files.
 */
export function parseManifest(event: NostrEvent, ref: NsiteRef): NsiteManifest {
  const paths: { path: string; sha256: string }[] = [];
  const seen = new Set<string>();

  for (const tag of event.tags) {
    if (tag[0] !== 'path') continue;

    const path = tag[1] ?? '';
    const sha256 = (tag[2] ?? '').toLowerCase();
    // Paths are absolute by spec, and a hash that isn't 32 bytes of hex can
    // never match a blob, so neither is worth carrying forward.
    if (!path.startsWith('/') || !SHA256.test(sha256)) continue;
    // First tag wins, so a duplicated path can't shadow the earlier mapping.
    if (seen.has(path)) continue;

    seen.add(path);
    paths.push({ path, sha256 });
  }

  const servers = event.tags
    .filter(([tag]) => tag === 'server')
    .map(([, url]) => url)
    .filter((url): url is string => {
      try {
        return new URL(url).protocol === 'https:';
      } catch {
        return false;
      }
    });

  return {
    ref,
    event,
    title: firstTag(event, 'title'),
    description: firstTag(event, 'description'),
    paths,
    servers,
  };
}

/** A human label for a reference, used when the manifest has no title. */
export function describeRef(ref: NsiteRef): string {
  const npub = nip19.npubEncode(ref.pubkey);
  const short = `${npub.slice(0, 12)}…`;
  return ref.identifier ? `${short}/${ref.identifier}` : short;
}
