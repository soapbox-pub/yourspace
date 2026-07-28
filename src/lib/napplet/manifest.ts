import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

/**
 * NIP-5D napplet manifests.
 *
 * A napplet is a small sandboxed web app distributed the way an nsite is: a
 * list of `path` tags mapping absolute paths to sha256 hashes, with the bytes
 * on Blossom. The tag schema is NIP-5A's, under kinds of NIP-5D's own — which
 * is the point of the separate kinds, since a napplet must be resolved and
 * verified by the runtime rather than served by an nsite gateway.
 *
 * Only the manifest is dealt with here. Fetching and verifying the bytes is
 * `runtime/resolve.ts`, which is shared with the standalone runtime and so may
 * not import anything from the app.
 */

/** Snapshot: regular, pins one version. */
export const SNAPSHOT_NAPPLET_KIND = 5129;
/** Root napplet: replaceable, one per pubkey, no `d` tag. */
const ROOT_NAPPLET_KIND = 15129;
/** Named napplet: addressable, `d` tag is the identifier. */
export const NAMED_NAPPLET_KIND = 35129;

type NappletKind =
  | typeof SNAPSHOT_NAPPLET_KIND
  | typeof ROOT_NAPPLET_KIND
  | typeof NAMED_NAPPLET_KIND;

export interface NappletRef {
  kind: NappletKind;
  pubkey: string;
  /** The `d` tag for a named napplet; the event id for a snapshot. */
  identifier?: string;
  /** Relay hints carried by an naddr, used before the app's own relays. */
  relays?: string[];
}

export interface NappletManifest {
  ref: NappletRef;
  event: NostrEvent;
  title?: string;
  description?: string;
  /** `source` tag: where the napplet's code came from. */
  source?: string;
  /** Absolute path to sha256, in manifest order, deduplicated by path. */
  paths: { path: string; sha256: string }[];
  /** `server` tag hints for where the blobs can be found. */
  servers: string[];
  /**
   * Bare NAP domains the napplet declares it needs (`["requires", "relay"]`).
   * Checked against what the runtime offers before the napplet is loaded.
   */
  requires: string[];
  /**
   * The `x` aggregate tag, when present.
   *
   * NIP-5D says this is the NIP-5A aggregate hash of the `path` tags and that
   * a recomputed value MUST match it — but NIP-5A defines neither an aggregate
   * hash nor an `x` tag, so there is no algorithm to recompute. Carried here so
   * it can be displayed and so the check can be added once one exists; see
   * `NIP.md`. Per-blob sha256 verification is fully specified and is done.
   */
  aggregate?: string;
}

const SHA256 = /^[0-9a-f]{64}$/;

/** The entry point every napplet is required to have. */
export const NAPPLET_ENTRY = '/index.html';

/**
 * The relay filter for a reference.
 *
 * The replaceable and addressable kinds are constrained to the author, which is
 * what makes the result trustworthy: without it, anyone could publish a `d` tag
 * collision and have their code run in somebody else's page. A snapshot is a
 * regular event, so it is addressed by id — already unforgeable — and the
 * author is re-checked once the event is in hand.
 */
export function nappletFilter(ref: NappletRef) {
  if (ref.kind === SNAPSHOT_NAPPLET_KIND) {
    return { kinds: [SNAPSHOT_NAPPLET_KIND], ids: [ref.identifier ?? ''], limit: 1 };
  }
  if (ref.kind === NAMED_NAPPLET_KIND) {
    return {
      kinds: [NAMED_NAPPLET_KIND],
      authors: [ref.pubkey],
      '#d': [ref.identifier ?? ''],
      limit: 1,
    };
  }
  return { kinds: [ROOT_NAPPLET_KIND], authors: [ref.pubkey], limit: 1 };
}

const firstTag = (event: NostrEvent, name: string): string | undefined =>
  event.tags.find(([tag]) => tag === name)?.[1] || undefined;

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Reads the parts of a manifest the runtime acts on.
 *
 * Malformed `path` tags are dropped rather than failing the whole manifest, as
 * in `nsite/manifest.ts` — but unlike an nsite, a napplet with no usable
 * `/index.html` is not loadable at all, which `resolveNapplet` treats as an
 * error rather than an empty page.
 */
export function parseNappletManifest(event: NostrEvent, ref: NappletRef): NappletManifest {
  const paths: { path: string; sha256: string }[] = [];
  const seen = new Set<string>();

  for (const tag of event.tags) {
    if (tag[0] !== 'path') continue;

    const path = tag[1] ?? '';
    const sha256 = (tag[2] ?? '').toLowerCase();
    if (!path.startsWith('/') || !SHA256.test(sha256)) continue;
    // First tag wins, so a duplicated path can't shadow the earlier mapping.
    if (seen.has(path)) continue;

    seen.add(path);
    paths.push({ path, sha256 });
  }

  const source = firstTag(event, 'source');

  return {
    ref,
    event,
    title: firstTag(event, 'title'),
    description: firstTag(event, 'description'),
    source: source && isHttpsUrl(source) ? source : undefined,
    paths,
    servers: event.tags
      .filter(([tag]) => tag === 'server')
      .map(([, url]) => url)
      .filter((url): url is string => typeof url === 'string' && isHttpsUrl(url)),
    requires: event.tags
      .filter(([tag]) => tag === 'requires')
      .map(([, domain]) => domain)
      .filter((domain): domain is string => Boolean(domain)),
    aggregate: event.tags.find(([tag, , mark]) => tag === 'x' && mark === 'aggregate')?.[1],
  };
}

/** Whether an event could be rendered as a napplet at all. */
export function isValidNapplet(event: NostrEvent): boolean {
  if (event.kind === NAMED_NAPPLET_KIND && !firstTag(event, 'd')) return false;

  return event.tags.some(
    ([tag, path, hash]) => tag === 'path' && path === NAPPLET_ENTRY && SHA256.test(hash ?? ''),
  );
}

/** The `naddr` (or `nevent`) that addresses a napplet, for storing in a page. */
export function encodeNappletRef(event: NostrEvent): string {
  if (event.kind === NAMED_NAPPLET_KIND) {
    return nip19.naddrEncode({
      kind: event.kind,
      pubkey: event.pubkey,
      identifier: firstTag(event, 'd') ?? '',
    });
  }
  if (event.kind === ROOT_NAPPLET_KIND) {
    return nip19.naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: '' });
  }
  return nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind });
}

/**
 * The reference an identifier addresses, or `null` when it addresses something
 * that isn't a napplet.
 *
 * Only the three NIP-5D kinds are accepted. Anything else — an `npub`, an
 * `naddr` for a long-form article — is refused rather than resolved, so a page
 * can't be made to run an arbitrary event as though it were code.
 */
export function decodeNappletRef(value: string): NappletRef | null {
  let decoded: ReturnType<typeof nip19.decode>;
  try {
    decoded = nip19.decode(value);
  } catch {
    return null;
  }

  if (decoded.type === 'naddr') {
    const { kind, pubkey, identifier, relays } = decoded.data;
    if (kind !== NAMED_NAPPLET_KIND && kind !== ROOT_NAPPLET_KIND) return null;
    return { kind, pubkey, identifier, relays };
  }

  if (decoded.type === 'nevent') {
    const { id, author, kind, relays } = decoded.data;
    if (kind !== SNAPSHOT_NAPPLET_KIND || !author) return null;
    return { kind, pubkey: author, identifier: id, relays };
  }

  return null;
}

/** A human label for a napplet, used when the manifest has no title. */
export function describeNapplet(manifest: NappletManifest): string {
  if (manifest.title) return manifest.title;
  if (manifest.ref.identifier) return manifest.ref.identifier;
  return `${nip19.npubEncode(manifest.ref.pubkey).slice(0, 12)}…`;
}
