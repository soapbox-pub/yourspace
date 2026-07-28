/**
 * The one thing an nsite is made of: files.
 *
 * NIP-5A has no notion of a page. A manifest maps absolute paths to hashes and
 * stops there — `/index.html` and `/profile.png` are the same kind of entry.
 * So the editor stores one flat list too, and "pages" versus "assets" is
 * decided here, by extension, purely so the UI has something to group by.
 */
export interface NsiteFile {
  /** Absolute site path, e.g. `/blog/index.html`. */
  path: string;
  /** Decoded UTF-8 contents, for the file types this app reads. */
  text?: string;
  /**
   * Object URL for the bytes. Pages don't get one — nothing in the canvas
   * loads an HTML file by URL, and minting one per page would just leak.
   */
  url?: string;
  type: string;
  size: number;
  /** From the manifest, when this file was imported rather than authored here. */
  sha256?: string;
}

const EXTENSION = /\.([a-z0-9]+)$/i;

const MIME_TYPES: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  xml: 'application/xml',
  txt: 'text/plain',
  md: 'text/markdown',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
};

/**
 * Text types worth decoding. Everything else stays a blob: an object URL is all
 * the canvas needs from a PNG, and holding a megabyte of binary as a JS string
 * buys nothing.
 */
const TEXT_EXTENSIONS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'json',
  'webmanifest',
  'xml',
  'txt',
  'md',
  'svg',
]);

const IMAGE_TYPES = /^image\//;

export function extensionOf(path: string): string {
  return EXTENSION.exec(path)?.[1]?.toLowerCase() ?? '';
}

export function mimeForPath(path: string): string {
  return MIME_TYPES[extensionOf(path)] ?? 'application/octet-stream';
}

/**
 * The usual extension for a MIME type, for files that arrive without one.
 *
 * A site path is the only name a file has here, and the pages/assets split and
 * the served Content-Type are both read back off its extension — so a file
 * stored as `/images/photo` would be neither an image nor anything else.
 */
export function extensionForMime(type: string): string {
  const wanted = type.split(';')[0].trim().toLowerCase();
  return Object.keys(MIME_TYPES).find((ext) => MIME_TYPES[ext] === wanted) ?? '';
}

export function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(path));
}

/** Whether this file is editable in the canvas — the "pages" half of the split. */
export function isPagePath(path: string): boolean {
  const ext = extensionOf(path);
  return ext === 'html' || ext === 'htm';
}

export function isImageFile(file: NsiteFile): boolean {
  return IMAGE_TYPES.test(file.type);
}

export const pagesOf = (files: NsiteFile[]): NsiteFile[] => files.filter((f) => isPagePath(f.path));
export const assetsOf = (files: NsiteFile[]): NsiteFile[] => files.filter((f) => !isPagePath(f.path));

/**
 * The path as a visitor would reach it. Host servers fall back to
 * `index.html` for any path that doesn't name a file, so `/blog/index.html`
 * and `/blog/` are the same page and the directory is the better label.
 */
export function pageLabel(path: string): string {
  return path.replace(/\/index\.html?$/i, '/') || '/';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Normalizes user input into a site path: leading slash, no `..`, and an
 * `.html` extension so it lands on the pages side of the split. Throws with
 * something explainable rather than silently correcting.
 */
export function normalizePagePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a path.');
  if (/[?#\s]/.test(trimmed)) throw new Error('Paths cannot contain spaces, ? or #.');

  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const segments = withSlash.split('/').slice(1);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Paths cannot contain . or .. segments.');
  }

  // A trailing slash means a directory, which resolves to its index page.
  const path = withSlash.endsWith('/') ? `${withSlash}index.html` : withSlash;
  if (!isPagePath(path)) throw new Error('Pages must end in .html.');

  return path;
}

const ASSET_FOLDER = '/images';

/**
 * A site path for a file added in the editor rather than imported.
 *
 * The name is reduced to what a path can carry without escaping, and gains a
 * numeric suffix when it is already taken: two files chosen as `photo.jpg` are
 * two files, and quietly writing the second over the first would drop the
 * first out of the site.
 */
export function assetPath(files: NsiteFile[], name: string, type = ''): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '');

  const own = extensionOf(cleaned);
  const stem = (own ? cleaned.slice(0, -(own.length + 1)) : cleaned) || 'image';
  const extension = own || extensionForMime(type);
  const suffix = extension ? `.${extension}` : '';

  const taken = new Set(files.map((file) => file.path));
  let path = `${ASSET_FOLDER}/${stem}${suffix}`;
  for (let n = 2; taken.has(path); n++) path = `${ASSET_FOLDER}/${stem}-${n}${suffix}`;

  return path;
}

/**
 * Replaces a file's contents, returning the same array when nothing changed.
 *
 * The hash goes with it: it described the bytes that were fetched, and once
 * those have been edited it no longer describes anything. A file that comes
 * through untouched keeps the array identity, and so keeps its hash.
 */
export function writeFile(files: NsiteFile[], path: string, text: string): NsiteFile[] {
  const index = files.findIndex((file) => file.path === path);
  if (index === -1) return files;
  if (files[index].text === text) return files;

  const next = files.slice();
  next[index] = { ...files[index], text, size: new Blob([text]).size, sha256: undefined };
  return next;
}

export function sortFiles(files: NsiteFile[]): NsiteFile[] {
  return files.slice().sort((a, b) => a.path.localeCompare(b.path));
}

/** Frees the object URLs held by a project that is being replaced. */
export function releaseFiles(files: NsiteFile[]): void {
  for (const file of files) {
    if (file.url) URL.revokeObjectURL(file.url);
  }
}

/** A file authored here rather than imported, so with no hash and no blob. */
export function textFile(path: string, text: string): NsiteFile {
  return { path, text, type: mimeForPath(path), size: new Blob([text]).size };
}

/**
 * A binary file added here rather than imported — a downloaded font, say.
 *
 * Unlike a page it gets an object URL, because the canvas loads it by
 * reference: the site path it will ship under resolves against the app origin
 * inside the frame and would 404. `toSiteHtml` turns the URL back into the path
 * on the way out.
 */
export function binaryFile(path: string, bytes: ArrayBuffer): NsiteFile {
  const type = mimeForPath(path);
  const blob = new Blob([bytes], { type });
  return { path, url: URL.createObjectURL(blob), type, size: blob.size };
}

/**
 * The starting point for a page created in the editor rather than imported.
 *
 * The typeface goes on `body`, not inline on the wrapper, so that the page-level
 * font control in the inspector — which writes that same rule — can change it.
 */
export function blankPage(path: string): NsiteFile {
  return textFile(
    path,
    `<style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;}</style>
<div style="max-width:768px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:40px;font-weight:700;letter-spacing:-0.02em;margin:0 0 16px;">${pageLabel(path)}</h1>
  <p style="font-size:18px;line-height:1.7;color:#475569;margin:0;">Drop a block here to get started.</p>
</div>`,
  );
}
