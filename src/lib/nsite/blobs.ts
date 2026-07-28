import { APP_BLOSSOM_SERVERS } from '@/lib/appBlossom';
import type { NsiteManifest } from './manifest';

/**
 * Getting the bytes of an nsite.
 *
 * Blobs are addressed by hash, which is what lets an untrusted server hold
 * them: a blob is only accepted once it digests to the hash the author signed,
 * so a server can serve the bytes without being trusted to serve the *right*
 * bytes. A server that answers with something else is treated exactly like one
 * that doesn't answer.
 */

const BLOB_TIMEOUT = 15000;

function normalizeServer(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Where to look, most specific first: the manifest's own hints, then whatever
 * the caller knows about (the author's BUD-03 list, the user's own servers),
 * then this app's defaults as a last resort.
 */
export function blobServers(manifest: NsiteManifest, extra: string[] = []): string[] {
  const seen = new Set<string>();

  return [...manifest.servers, ...extra, ...APP_BLOSSOM_SERVERS.servers]
    .map(normalizeServer)
    .filter((url) => {
      if (!url || seen.has(url.toLowerCase())) return false;
      seen.add(url.toLowerCase());
      return true;
    });
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The last server that produced a verified blob.
 *
 * Blossom servers hold overlapping but not identical sets, so the first
 * candidate often 404s for every file of a site. Remembering which one worked
 * turns a per-file penalty into a one-off one, which matters when a page pulls
 * in thirty assets.
 */
let preferred: string | null = null;

/**
 * Fetches one blob, trying each server until the bytes verify.
 *
 * The extension is appended because BUD-01 allows it and some servers use it
 * to pick a Content-Type — irrelevant here, since callers derive the type from
 * the manifest path, but harmless and occasionally necessary to get a hit.
 */
export async function fetchBlob(
  sha256: string,
  extension: string,
  servers: string[],
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  const suffix = extension ? `.${extension}` : '';

  async function tryServer(server: string): Promise<ArrayBuffer | null> {
    signal?.throwIfAborted();

    try {
      const response = await fetch(`${server}/${sha256}${suffix}`, {
        signal: AbortSignal.any([
          AbortSignal.timeout(BLOB_TIMEOUT),
          ...(signal ? [signal] : []),
        ]),
      });
      if (!response.ok) return null;

      const bytes = await response.arrayBuffer();
      if ((await sha256Hex(bytes)) !== sha256) return null;

      preferred = server;
      return bytes;
    } catch {
      // Unreachable, CORS refusal, timeout — all the same answer here.
      signal?.throwIfAborted();
      return null;
    }
  }

  if (preferred && servers.includes(preferred)) {
    const bytes = await tryServer(preferred);
    if (bytes) return bytes;
  }

  for (const server of servers) {
    if (server === preferred) continue;
    const bytes = await tryServer(server);
    if (bytes) return bytes;
  }

  return null;
}
