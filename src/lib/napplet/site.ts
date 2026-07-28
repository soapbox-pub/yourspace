import runtimeSource from 'virtual:napplet-runtime';

import { isPagePath, textFile, type NsiteFile } from '@/lib/nsite/files';
import { NAPPLET_RUNTIME_PATH } from './constants';

/**
 * Getting the napplet runtime into a published site.
 *
 * A napplet cannot be baked into a page the way the profile hero is: the hero
 * is fetched once in the editor and its markup shipped as static HTML, whereas
 * a napplet is a program that has to run wherever the page is read. So the page
 * carries an inert placeholder, and the runtime that turns placeholders into
 * sandboxed frames ships beside it as an ordinary file of the site.
 *
 * The script tag is added here, on the way *out* of the editor, rather than
 * living in the canvas markup. It could not live there: `toCanvasHtml` strips
 * every `<script>` before GrapesJS sees a page, because an imported site is a
 * stranger's markup and the canvas is same-origin with this app. Stripping on
 * the way in and adding on the way out is the same bargain that module already
 * makes with stylesheets, and it round-trips for the same reason.
 */

/** Matches the placeholder attribute, whatever quoting was used around it. */
const HAS_NAPPLET = /\sdata-napplet\s*=/i;

export function pageUsesNapplets(html: string): boolean {
  return HAS_NAPPLET.test(html);
}

/**
 * The runtime as a file of the site.
 *
 * Text rather than a blob, so it shows up in the code panel and diffs like
 * anything else the editor writes.
 */
export function nappletRuntimeFile(): NsiteFile {
  return textFile(NAPPLET_RUNTIME_PATH, runtimeSource);
}

/**
 * Adds the runtime's script tag to a serialized page that needs it.
 *
 * `defer` because the placeholders have to exist before the runtime looks for
 * them, and because a napplet is never the thing a reader came for — it should
 * not hold up the page around it.
 */
export function withNappletRuntime(html: string): string {
  if (!pageUsesNapplets(html)) return html;
  // Re-serializing a page that already carries the tag must not add a second.
  if (html.includes(NAPPLET_RUNTIME_PATH)) return html;

  const tag = `<script src="${NAPPLET_RUNTIME_PATH}" defer></script>`;

  return html.includes('</body>')
    ? html.replace('</body>', `  ${tag}\n</body>`)
    : `${html}\n${tag}`;
}

/**
 * Brings the site's copy of the runtime in line with whether it is used.
 *
 * Done over the whole file list at publish time rather than when a napplet is
 * inserted, so that every route in gets the same answer: dropping a napplet in,
 * deleting the last one, importing a site that already had some, or hand-editing
 * a placeholder into the HTML panel all end up correct without each needing to
 * remember. The source is rewritten rather than left alone, so a site
 * republished from a newer build ships the newer runtime.
 */
export function syncNappletRuntime(files: NsiteFile[]): NsiteFile[] {
  const used = files.some((file) => isPagePath(file.path) && pageUsesNapplets(file.text ?? ''));
  const index = files.findIndex((file) => file.path === NAPPLET_RUNTIME_PATH);

  if (!used) return index === -1 ? files : files.filter((_file, at) => at !== index);

  const runtime = nappletRuntimeFile();
  if (index === -1) return [...files, runtime];
  if (files[index].text === runtime.text) return files;

  const next = files.slice();
  next[index] = runtime;
  return next;
}
