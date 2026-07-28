import type { NostrSigner } from '@nostrify/nostrify';

import { utf8ToBase64 } from '@/lib/sandbox/base64';
import { sha256Hex } from './blobs';
import { isPagePath, type NsiteFile } from './files';

/**
 * Putting an nsite on the network — `fetchNsite` run backwards.
 *
 * The same two hops in reverse: every file's bytes go to Blossom servers,
 * addressed by hash, and then one signed manifest maps paths to those hashes.
 * Only the manifest is an event. The blobs are just bytes on servers nobody has
 * to trust, which is what the hash in each `path` tag is doing — a reader
 * accepts them only once they digest to what was signed here.
 *
 * Order matters: the manifest is published last, because a manifest naming
 * blobs that aren't up yet is a broken site, whereas blobs with no manifest
 * pointing at them are merely unreferenced.
 */

/** BUD-01 authorization. Signed for a server, never sent to a relay. */
const BLOSSOM_AUTH_KIND = 24242;

/**
 * How long an upload authorization stays valid.
 *
 * One is signed per blob and replayed to each server missing it, so it has to
 * outlive the slowest of those uploads rather than just the first.
 */
const AUTH_LIFETIME = 600;

const HEAD_TIMEOUT = 10000;
const UPLOAD_TIMEOUT = 60000;

/**
 * Blobs in flight at once.
 *
 * Half what the import uses, because the work is not symmetrical: a blob a
 * server doesn't already have costs a signature, and a NIP-46 signer answers
 * over a relay round-trip.
 */
const CONCURRENCY = 3;

export interface PublishProgress {
  loaded: number;
  total: number;
}

export interface FailedUpload {
  path: string;
  reason: string;
}

export interface SiteUpload {
  /** Manifest entries, in file order, for the blobs that reached a server. */
  entries: { path: string; sha256: string }[];
  /** Servers holding at least one blob, the one holding most of them first. */
  servers: string[];
  /** Files no server would take. Left out of the manifest rather than named in it. */
  failed: FailedUpload[];
}

interface UploadOptions {
  signer: NostrSigner;
  servers: string[];
  signal?: AbortSignal;
  onProgress?: (progress: PublishProgress) => void;
}

/**
 * `https` only, trailing slash off, deduplicated.
 *
 * Both ends of the round trip want this: `parseManifest` drops a `server` tag
 * that isn't https when the site is read back, and the app is served over https
 * anyway, so an http upload would be blocked as mixed content before it left.
 */
function publishServers(servers: string[]): string[] {
  const seen = new Set<string>();

  return servers.flatMap((server) => {
    let url: URL;
    try {
      url = new URL(server);
    } catch {
      return [];
    }

    if (url.protocol !== 'https:') return [];

    const normalized = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    if (seen.has(normalized.toLowerCase())) return [];
    seen.add(normalized.toLowerCase());

    return [normalized];
  });
}

/**
 * A file's bytes as they would ship.
 *
 * `text` wins where a file has both, because that is the half the editor
 * writes to: an imported stylesheet keeps the object URL it arrived with, and
 * those bytes stop being current the moment it is edited.
 */
async function fileBlob(file: NsiteFile): Promise<Blob> {
  if (file.text !== undefined) return new Blob([file.text], { type: file.type });
  if (!file.url) throw new Error('no contents');

  const response = await fetch(file.url);
  if (!response.ok) throw new Error('contents could not be read');

  return response.blob();
}

/**
 * Whether a server already holds this blob.
 *
 * Worth the extra request: a site is normally republished after editing one
 * page of it, and every unchanged image answering `true` here is a signature
 * and an upload that don't happen. A server that refuses the HEAD — offline, or
 * no CORS on it — answers `false`, which only costs an upload it may then
 * deduplicate on its own.
 */
async function hasBlob(server: string, sha256: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${server}/${sha256}`, {
      method: 'HEAD',
      signal: AbortSignal.any([AbortSignal.timeout(HEAD_TIMEOUT), ...(signal ? [signal] : [])]),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** A BUD-01 `Authorization` header. Bound to the blob, not to any one server. */
async function uploadAuth(
  signer: NostrSigner,
  sha256: string,
  size: number,
  name: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const event = await signer.signEvent({
    kind: BLOSSOM_AUTH_KIND,
    content: `Upload ${name}`,
    created_at: now,
    tags: [
      ['t', 'upload'],
      ['x', sha256],
      ['size', String(size)],
      ['expiration', String(now + AUTH_LIFETIME)],
    ],
  });

  return `Nostr ${utf8ToBase64(JSON.stringify(event))}`;
}

/** BUD-02 upload. Throws with whatever the server said, for the caller to report. */
async function putBlob(
  server: string,
  blob: Blob,
  auth: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${server}/upload`, {
    method: 'PUT',
    body: blob,
    headers: { authorization: auth, 'content-type': blob.type },
    signal: AbortSignal.any([AbortSignal.timeout(UPLOAD_TIMEOUT), ...(signal ? [signal] : [])]),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim().slice(0, 200);
    throw new Error(`${new URL(server).host} refused it (${response.status})${detail ? `: ${detail}` : ''}`);
  }
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
 * Uploads every file of a site and reports what a manifest could name.
 *
 * A file that no server accepted is reported rather than thrown, for the same
 * reason the import tolerates a missing blob: one rejected favicon shouldn't
 * cost you the deployment. It is left out of the manifest entirely, because a
 * `path` tag pointing at bytes nobody holds is worse than an absent file —
 * every reader would fetch it, from every server, before giving up.
 *
 * A refused *signature* is different, and propagates: that is the user saying
 * no, and there is nothing to publish after it.
 */
export async function uploadSite(
  files: NsiteFile[],
  { signer, servers, signal, onProgress }: UploadOptions,
): Promise<SiteUpload> {
  const targets = publishServers(servers);
  if (!targets.length) throw new Error('No https Blossom servers configured to publish to.');

  // Grouped by content, so a file that appears twice — a shared icon, the same
  // stylesheet under two names — is hashed and uploaded once.
  const blobs = new Map<string, { blob: Blob; paths: string[] }>();
  const hashes = new Map<string, string>();
  const failed: FailedUpload[] = [];

  for (const file of files) {
    let blob: Blob;
    try {
      blob = await fileBlob(file);
    } catch (error) {
      failed.push({ path: file.path, reason: error instanceof Error ? error.message : 'unreadable' });
      continue;
    }

    // Digested here rather than read off `file.sha256`, which describes the
    // bytes a file was imported with. These are the bytes going up.
    const sha256 = await sha256Hex(await blob.arrayBuffer());
    hashes.set(file.path, sha256);

    const seen = blobs.get(sha256);
    if (seen) seen.paths.push(file.path);
    else blobs.set(sha256, { blob, paths: [file.path] });
  }

  /** How many blobs each server ended up holding, for ordering the hints. */
  const holdings = new Map<string, number>();
  const stored = new Set<string>();
  let loaded = 0;

  onProgress?.({ loaded, total: blobs.size });

  await pooled([...blobs], async ([sha256, { blob, paths }]) => {
    signal?.throwIfAborted();

    const present = await Promise.all(targets.map((server) => hasBlob(server, sha256, signal)));
    const holders = targets.filter((_, index) => present[index]);
    const missing = targets.filter((_, index) => !present[index]);
    let reason = 'no server accepted it';

    if (missing.length) {
      const auth = await uploadAuth(signer, sha256, blob.size, paths[0]);
      const outcomes = await Promise.allSettled(
        missing.map((server) => putBlob(server, blob, auth, signal)),
      );

      signal?.throwIfAborted();

      holders.push(...missing.filter((_, index) => outcomes[index].status === 'fulfilled'));

      const refusal = outcomes.find((outcome) => outcome.status === 'rejected');
      if (refusal?.status === 'rejected' && refusal.reason instanceof Error) {
        reason = refusal.reason.message;
      }
    }

    if (holders.length) {
      stored.add(sha256);
      for (const server of holders) holdings.set(server, (holdings.get(server) ?? 0) + 1);
    } else {
      failed.push(...paths.map((path) => ({ path, reason })));
    }

    onProgress?.({ loaded: ++loaded, total: blobs.size });
  });

  const entries = files.flatMap((file) => {
    const sha256 = hashes.get(file.path);
    return sha256 && stored.has(sha256) ? [{ path: file.path, sha256 }] : [];
  });

  return {
    entries,
    // Most complete first, so a reader's first guess is the one likeliest to
    // answer. `sort` is stable, so servers holding the same number keep the
    // order they were configured in.
    servers: targets
      .filter((server) => holdings.has(server))
      .sort((a, b) => holdings.get(b)! - holdings.get(a)!),
    failed,
  };
}

export interface ManifestDetails {
  title?: string;
  description?: string;
}

/**
 * The tags of a manifest event. The content of one is unused — an nsite is
 * entirely a set of tags.
 */
export function manifestTags(upload: SiteUpload, details: ManifestDetails = {}): string[][] {
  const tags = upload.entries.map(({ path, sha256 }) => ['path', path, sha256]);

  for (const server of upload.servers) tags.push(['server', server]);

  const title = details.title?.trim();
  const description = details.description?.trim();
  if (title) tags.push(['title', title]);
  if (description) tags.push(['description', description]);

  return tags;
}

/** `/index.html` if the site has one, else the shallowest page — as `fetchNsite` picks it. */
export function entryPage(files: NsiteFile[]): NsiteFile | undefined {
  const pages = files.filter((file) => isPagePath(file.path));

  return (
    pages.find((page) => page.path === '/index.html') ??
    pages.sort(
      (a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path),
    )[0]
  );
}

/**
 * A default title, taken from the entry page's own `<title>`.
 *
 * Parsed rather than matched with a regex so that an entity-escaped title
 * arrives as the text it renders as, which is what a `title` tag holds.
 */
export function suggestedTitle(files: NsiteFile[]): string {
  const entry = entryPage(files);
  if (!entry?.text) return '';

  return new DOMParser().parseFromString(entry.text, 'text/html').title.trim();
}
