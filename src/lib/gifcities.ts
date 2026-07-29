/**
 * GifCities — the Internet Archive's search over the animated GIFs recovered
 * from GeoCities, which stopped taking uploads in 2009.
 *
 * Two hosts: a JSON search endpoint, and a blob host serving each GIF's bytes
 * under their own digest. Both allow cross-origin reads (the search endpoint
 * echoes the request's `Origin`), so the browser talks to them directly.
 */

const SEARCH_ENDPOINT = 'https://gifcities.archive.org/api/v1/gifsearch';
const BLOB_HOST = 'https://blob.gifcities.org/gifcities';

/**
 * A result's checksum is the only part of it that becomes a URL, and that URL
 * is interpolated into markup for the canvas — a same-origin frame, where
 * injected script could read the user's `nsec` out of localStorage.
 *
 * Holding it to base32 rather than escaping it means the `src` is built purely
 * from characters that cannot end an attribute or leave the path. Results the
 * service has no blob for carry `"-"` here, and fail the same test.
 */
const CHECKSUM = /^[A-Z2-7]{32}$/;

/** Whether `value` is a digest safe to build a URL — and then markup — from. */
export function isGifChecksum(value: string): boolean {
  return CHECKSUM.test(value);
}

/**
 * Where the GIF named by `checksum` is served from.
 *
 * Exported so that a digest remembered from an earlier session can be turned
 * back into a GIF without the caller keeping — and having to re-trust — a URL.
 */
export function gifUrl(checksum: string): string {
  return `${BLOB_HOST}/${checksum}.gif`;
}

export interface GifCitiesGif {
  /** Base32 digest of the GIF's bytes, and its name on the blob host. */
  checksum: string;
  /** The GIF itself. */
  url: string;
  /** Words recovered from the original GeoCities path — what search matches. */
  text: string;
  /** Intrinsic size, or 0 when the service didn't record it. */
  width: number;
  height: number;
}

interface RawGif {
  checksum?: unknown;
  url_text?: unknown;
  width?: unknown;
  height?: unknown;
}

function size(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function toGif(raw: unknown): GifCitiesGif | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const { checksum, url_text, width, height } = raw as RawGif;
  if (typeof checksum !== 'string' || !isGifChecksum(checksum)) return null;

  return {
    checksum,
    url: gifUrl(checksum),
    text: typeof url_text === 'string' ? url_text : '',
    width: size(width),
    height: size(height),
  };
}

/**
 * Every GIF matching `query`.
 *
 * All of them, deliberately: the endpoint accepts `offset` and `page_size` but
 * ignores both, so a popular word answers with several thousand results and a
 * megabyte or two of JSON however it is asked. There is no paging to be had
 * from the service, which leaves the caller to show a window onto the array —
 * mounting a few thousand animated GIFs at once is not something to do by
 * accident.
 *
 * One request per query is the whole cost, though, and the archive is fixed, so
 * the answer is worth caching for as long as the tab lives.
 */
export async function searchGifs(query: string, signal?: AbortSignal): Promise<GifCitiesGif[]> {
  const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`, { signal });

  if (!response.ok) {
    throw new Error(`GifCities returned ${response.status}. The archive may be unavailable.`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error('GifCities returned an unexpected response.');

  // A GIF comes back once for every archived page it was found on, and the
  // popular ones were on thousands of them.
  const seen = new Set<string>();

  return body.reduce<GifCitiesGif[]>((gifs, raw) => {
    const gif = toGif(raw);
    if (gif && !seen.has(gif.checksum)) {
      seen.add(gif.checksum);
      gifs.push(gif);
    }
    return gifs;
  }, []);
}
