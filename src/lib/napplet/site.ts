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
 * The script tag is derived here, on the way *out* of the editor, rather than
 * being markup the user owns. `./foreign` now carries `<script>` through the
 * canvas intact, so the tag would survive on its own — but surviving is the
 * problem: a tag that persisted after the last napplet was deleted would point
 * at a file no longer published. So it is rewritten from scratch on every
 * serialization, which makes the page self-correcting however the napplets got
 * there or went away.
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

/** The tag as this module writes it, and as it recognizes its own past work. */
const RUNTIME_SCRIPT = new RegExp(
  `\\s*<script\\b[^>]*\\bsrc=(["']?)${NAPPLET_RUNTIME_PATH.replace(/[.]/g, '\\$&')}\\1[^>]*>\\s*</script>`,
  'gi',
);

/**
 * Rewrites a serialized page's reference to the runtime.
 *
 * Stripped first and re-added second, rather than added only when missing. The
 * tag is derived from whether the page holds a napplet, so recomputing it is
 * what makes deleting the last napplet take the script with it — and it keeps
 * every page's copy in one canonical form and position no matter how many
 * round trips it has been through.
 *
 * `defer` because the placeholders have to exist before the runtime looks for
 * them, and because a napplet is never the thing a reader came for — it should
 * not hold up the page around it.
 */
export function withNappletRuntime(html: string): string {
  const without = html.replace(RUNTIME_SCRIPT, '');
  if (!pageUsesNapplets(without)) return without;

  const tag = `<script src="${NAPPLET_RUNTIME_PATH}" defer></script>`;

  return without.includes('</body>')
    ? without.replace('</body>', `  ${tag}\n</body>`)
    : `${without}\n${tag}`;
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
