import { fetchBlob } from './blobs';
import { extensionOf } from './files';

/**
 * Blobs already in hand, and blobs on the way.
 *
 * A site is a manifest plus a few dozen round-trips to a CDN, and none of
 * those round-trips depend on the frame that will eventually ask for them. So
 * they start the moment the manifest lands, in parallel with the sandbox
 * booting its Service Worker, and whatever is still in flight when the frame
 * does ask is handed over as the same promise rather than fetched again.
 *
 * Keying on the hash alone is safe, because the hash is what the bytes are
 * checked against: a cached blob is the blob the author signed no matter which
 * server produced it or which site asked first.
 */

/** Roughly one large site. Beyond this, the oldest blobs go. */
const CACHE_BUDGET = 32 * 1024 * 1024;

/** Enough to keep the pipe full without opening forty sockets at once. */
const PREFETCH_CONCURRENCY = 6;

/**
 * Types not worth prefetching. The browser streams these on demand and asks
 * for them in ranges; pulling a whole video into memory for a visitor who may
 * never press play is the opposite of a speed-up.
 */
const STREAMED = new Set([
  'mp4',
  'webm',
  'mov',
  'm4v',
  'mp3',
  'wav',
  'ogg',
  'opus',
  'm4a',
  'flac',
  'pdf',
  'zip',
]);

const cache = new Map<string, ArrayBuffer>();
const inflight = new Map<string, Promise<ArrayBuffer | null>>();
let cached = 0;

function remember(sha256: string, bytes: ArrayBuffer): void {
  // A blob bigger than the whole budget would evict everything else and then
  // itself; better to have fetched it and let it go.
  if (bytes.byteLength > CACHE_BUDGET) return;

  cache.set(sha256, bytes);
  cached += bytes.byteLength;

  // A Map iterates in insertion order, so the first entry is the coldest —
  // reads move their entry back to the end to keep that true.
  while (cached > CACHE_BUDGET) {
    const oldest = cache.entries().next().value;
    if (!oldest) break;
    cache.delete(oldest[0]);
    cached -= oldest[1].byteLength;
  }
}

/**
 * The bytes for one path, from memory, from a request already running, or from
 * a Blossom server — in that order. `null` means no server would produce them.
 */
export function loadBlob(
  sha256: string,
  extension: string,
  servers: string[],
): Promise<ArrayBuffer | null> {
  const hit = cache.get(sha256);
  if (hit) {
    cache.delete(sha256);
    cache.set(sha256, hit);
    return Promise.resolve(hit);
  }

  const pending = inflight.get(sha256);
  if (pending) return pending;

  const request = fetchBlob(sha256, extension, servers)
    .then((bytes) => {
      if (bytes) remember(sha256, bytes);
      return bytes;
    })
    // Misses aren't remembered: a server that was down for the prefetch may be
    // up by the time the page actually asks.
    .finally(() => inflight.delete(sha256));

  inflight.set(sha256, request);
  return request;
}

/**
 * What to fetch first.
 *
 * The entry page is the only file that blocks the site appearing at all, and
 * the stylesheets and scripts it names block it appearing *right*. Other pages
 * go last: they matter only if the visitor clicks something.
 */
function priority(path: string): number {
  if (path === '/index.html') return 0;

  switch (extensionOf(path)) {
    case 'css':
    case 'js':
    case 'mjs':
      return 1;
    case 'woff2':
    case 'woff':
    case 'ttf':
    case 'otf':
      return 2;
    case 'html':
    case 'htm':
      return 4;
    default:
      return 3;
  }
}

/**
 * Starts pulling a whole site down, in the order it will be needed.
 *
 * Returns a function that stops the queue. Requests already running are left
 * to finish — they cost nothing extra now, and land in the cache for the next
 * visit — but nothing new is started, so navigating away from a large site
 * doesn't keep downloading it.
 */
export function prefetchSite(
  paths: { path: string; sha256: string }[],
  servers: string[],
): () => void {
  // Several paths can share a hash — a repeated icon, two copies of a
  // stylesheet — and a shared blob is one fetch.
  const queue = [
    ...new Map(
      paths
        .filter(({ path }) => !STREAMED.has(extensionOf(path)))
        .map(({ path, sha256 }) => [sha256, path] as const),
    ),
  ].sort(([, a], [, b]) => priority(a) - priority(b));

  const total = queue.length;
  let stopped = false;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (!stopped && cursor < total) {
      const [sha256, path] = queue[cursor++];
      await loadBlob(sha256, extensionOf(path), servers).catch(() => null);
    }
  }

  for (let i = 0; i < Math.min(PREFETCH_CONCURRENCY, total); i++) {
    void worker();
  }

  return () => {
    stopped = true;
  };
}
