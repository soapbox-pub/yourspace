import type { NostrEvent, NPool } from '@nostrify/nostrify';

import { parseBlossomServerList } from '@/lib/appBlossom';
import { blobServers, fetchBlob } from './blobs';
import {
  extensionOf,
  isPagePath,
  isTextPath,
  mimeForPath,
  sortFiles,
  type NsiteFile,
} from './files';
import {
  NAMED_SITE_KIND,
  nsiteFilter,
  parseManifest,
  type NsiteManifest,
  type NsiteRef,
} from './manifest';

/**
 * Pulling an nsite down off the network.
 *
 * Two hops: the manifest comes from a relay, then every blob it names is
 * fetched from a Blossom server by hash. The hash is the whole point of the
 * second hop — a blob is only accepted if it digests to the hash the author
 * signed, so an untrusted CDN can serve the bytes without being trusted to
 * serve the *right* bytes.
 */

/** BUD-03 user server list. */
const BLOSSOM_SERVER_LIST_KIND = 10063;

/** Enough to keep the pipe full without opening forty sockets at once. */
const CONCURRENCY = 6;

const RELAY_TIMEOUT = 8000;

/**
 * Nothing is published at that reference.
 *
 * Separate from the other failures because it is the ordinary answer for a key
 * that hasn't made a site yet. Code importing on someone's behalf, rather than
 * because they pasted an identifier, reads it as "no site" and not as a fault.
 */
export class NsiteNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NsiteNotFoundError';
  }
}

export interface NsiteImportProgress {
  loaded: number;
  total: number;
}

export interface NsiteImport {
  manifest: NsiteManifest;
  files: NsiteFile[];
  /** The page to open first. */
  entry: string;
  /** Paths whose blob no server would produce, or produced wrongly. */
  missing: string[];
}

interface FetchOptions {
  signal?: AbortSignal;
  onProgress?: (progress: NsiteImportProgress) => void;
}

/** Replaceable events arrive once per relay, so take the newest. */
function latest(events: NostrEvent[], kind: number): NostrEvent | undefined {
  return events
    .filter((event) => event.kind === kind)
    .reduce<NostrEvent | undefined>(
      (best, event) => (!best || event.created_at > best.created_at ? event : best),
      undefined,
    );
}

/** Runs `worker` over `items`, at most `CONCURRENCY` at a time. */
async function pooled<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      await worker(items[cursor++]);
    }
  });
  await Promise.all(runners);
}

/**
 * Resolves a reference into an editable project.
 *
 * Blobs that can't be retrieved are reported rather than thrown: a site with a
 * missing favicon is still worth editing, and the caller can say which files
 * didn't make it.
 */
export async function fetchNsite(
  nostr: NPool,
  ref: NsiteRef,
  { signal, onProgress }: FetchOptions = {},
): Promise<NsiteImport> {
  const relaySignal = AbortSignal.any([
    AbortSignal.timeout(RELAY_TIMEOUT),
    ...(signal ? [signal] : []),
  ]);

  // Both filters go out together — the server list is needed either way, and
  // asking for it separately would cost a second round-trip to every relay.
  const events = await nostr.query(
    [nsiteFilter(ref), { kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [ref.pubkey], limit: 1 }],
    { signal: relaySignal },
  );

  const event = latest(events, ref.kind);
  if (!event) {
    throw new NsiteNotFoundError(
      ref.kind === NAMED_SITE_KIND
        ? `No named site "${ref.identifier}" found for that key.`
        : 'That key has no root nsite published to your relays.',
    );
  }

  const manifest = parseManifest(event, ref);
  if (!manifest.paths.length) throw new Error('That manifest lists no files.');

  const serverList = latest(events, BLOSSOM_SERVER_LIST_KIND);
  const servers = blobServers(manifest, serverList ? parseBlossomServerList(serverList) : []);
  if (!servers.length) throw new Error('No Blossom servers to fetch the files from.');

  // Several paths can share a hash — a repeated icon, or two copies of the same
  // stylesheet. Fetch each distinct blob once.
  const byHash = new Map<string, string[]>();
  for (const { path, sha256 } of manifest.paths) {
    byHash.set(sha256, [...(byHash.get(sha256) ?? []), path]);
  }

  const files: NsiteFile[] = [];
  const missing: string[] = [];
  let loaded = 0;

  onProgress?.({ loaded, total: byHash.size });

  await pooled([...byHash], async ([sha256, paths]) => {
    // Any of the paths will do for the extension; they share the bytes.
    const bytes = await fetchBlob(sha256, extensionOf(paths[0]), servers, signal);

    if (!bytes) {
      missing.push(...paths);
    } else {
      for (const path of paths) {
        const type = mimeForPath(path);
        files.push({
          path,
          type,
          sha256,
          size: bytes.byteLength,
          text: isTextPath(path) ? new TextDecoder().decode(bytes) : undefined,
          // Pages are never loaded by URL, so they don't get one to leak.
          url: isPagePath(path) ? undefined : URL.createObjectURL(new Blob([bytes], { type })),
        });
      }
    }

    onProgress?.({ loaded: ++loaded, total: byHash.size });
  });

  const entry = pickEntry(files);
  if (!entry) throw new Error('None of that site\u2019s HTML pages could be retrieved.');

  return { manifest, files: sortFiles(files), entry, missing };
}

/** `/index.html` is the site root; failing that, the shallowest page. */
function pickEntry(files: NsiteFile[]): string | undefined {
  const pages = files.filter((file) => isPagePath(file.path));
  if (pages.some((page) => page.path === '/index.html')) return '/index.html';

  return pages.sort(
    (a, b) =>
      a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path),
  )[0]?.path;
}
