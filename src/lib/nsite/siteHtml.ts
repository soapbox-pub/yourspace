import type { NsiteFile } from './files';

/**
 * Translating between a page as it ships and a page as the canvas can render it.
 *
 * An nsite's HTML references its siblings by site path — `<img src="/me.png">`,
 * `<link href="/style.css">`. The canvas is an `about:blank` iframe on the app's
 * origin, so those paths resolve against the app and 404. Every referenced file
 * therefore has to be pointed at the object URL holding its bytes on the way in,
 * and pointed back on the way out, so what gets stored is still a real nsite.
 *
 * Stylesheets are the exception. The app's CSP allows `blob:` for images but not
 * for `style-src`, so a rewritten `<link>` would simply be blocked. Their
 * contents are extracted here and injected into the canvas as an inline
 * `<style>` instead, which leaves the `<link>` tag untouched in the document and
 * the `.css` file untouched on disk — the site round-trips losslessly and its
 * stylesheet stays a shared file rather than being flattened into each page.
 */

/**
 * Whether a string is a whole HTML document rather than a fragment.
 *
 * This has to be decided before parsing, because the two take different
 * branches. `Components.parseString` only reads the doctype, the `<html>`
 * attributes and the `<head>` when `asDocument` is set — but setting it for a
 * fragment is worse than leaving it off: with no doctype to key on, the parser
 * returns the synthesized `<body>` itself, which then lands on the page as a
 * stray `<body>` element.
 */
export function isHtmlDocument(value: string): boolean {
  return /^\s*(<!doctype\s|<html[\s>])/i.test(value);
}

/**
 * Elements that exist to run or embed foreign code. An imported nsite is
 * arbitrary markup from a stranger, and the canvas iframe is same-origin with
 * the app — script that ran in there could read the `nsec` out of localStorage.
 * GrapesJS's parser drops `<script>` and `on*` handlers already; this is the
 * belt to that pair of braces, and it runs before GrapesJS ever sees the markup.
 */
const FORBIDDEN = 'script, iframe, frame, object, embed, applet, base, meta[http-equiv], noscript';

/** Attributes naming a subresource the browser will fetch. */
const RESOURCE_ATTRIBUTES: Record<string, readonly string[]> = {
  IMG: ['src'],
  SOURCE: ['src'],
  VIDEO: ['src', 'poster'],
  AUDIO: ['src'],
};

/** Attributes that navigate, and so can be made to execute a `javascript:` URL. */
const NAVIGATION_ATTRIBUTES = ['href', 'action', 'formaction', 'ping'];

const RESOURCE_SCHEMES = /^(https?|blob|data):/i;
const NAVIGATION_SCHEMES = /^(https?|mailto|tel):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function isAllowed(value: string, allowed: RegExp): boolean {
  const trimmed = value.trim();
  // Relative paths and fragments carry no scheme and can't select a protocol
  // handler, so there is nothing to check.
  if (!HAS_SCHEME.test(trimmed)) return true;
  return allowed.test(trimmed);
}

function sanitize(root: Document): void {
  root.querySelectorAll(FORBIDDEN).forEach((el) => el.remove());

  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const resources = RESOURCE_ATTRIBUTES[el.tagName] ?? [];

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      const allowed = resources.includes(name)
        ? RESOURCE_SCHEMES
        : NAVIGATION_ATTRIBUTES.includes(name)
          ? NAVIGATION_SCHEMES
          : null;

      if (allowed && !isAllowed(attr.value, allowed)) el.removeAttribute(attr.name);
    }
  }
}

/**
 * The absolute site path a reference points at, or `''` when it points
 * somewhere this site can't answer for.
 *
 * Sites write references both ways — `/reset.css` and `font.css` appear in the
 * same `<head>` of the site NIP-5A is written against — so the lookup key has
 * to be resolved against the file doing the referencing, exactly as a browser
 * would. A dummy origin gives `URL` something to resolve against; only the
 * pathname is kept, since a manifest has no notion of a query string.
 */
function resolvePath(reference: string, base: string): string {
  const value = reference.trim();
  if (!value || value.startsWith('#') || value.startsWith('//') || HAS_SCHEME.test(value)) {
    return '';
  }

  try {
    return new URL(value, `https://nsite.invalid${base}`).pathname;
  } catch {
    return '';
  }
}

const CSS_URL = /url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi;

/**
 * Points `url()` references at the object URLs holding those files.
 *
 * Used on linked stylesheets, on `<style>` blocks (before GrapesJS parses them
 * into editable rules) and on `style` attributes. The base differs between the
 * three — CSS resolves against the stylesheet it is written in, not the page —
 * and anything that isn't a known site file is left exactly as written.
 */
export function resolveCssUrls(css: string, byPath: Map<string, NsiteFile>, base: string): string {
  return css.replace(CSS_URL, (match, quote: string, url: string) => {
    const target = byPath.get(resolvePath(url, base))?.url;
    return target ? `url(${quote}${target}${quote})` : match;
  });
}

export interface CanvasHtml {
  /** Sanitized markup with site paths pointed at object URLs. */
  html: string;
  /** Contents of every site stylesheet the page links, concatenated. */
  css: string;
}

/**
 * Prepares a stored page for the canvas: strip what shouldn't run, repoint
 * resource references, and lift linked stylesheets out for separate injection.
 *
 * `basePath` is the path this markup is stored at, which is what its relative
 * references resolve against.
 */
export function toCanvasHtml(html: string, files: NsiteFile[], basePath: string): CanvasHtml {
  const asDocument = isHtmlDocument(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const byPath = new Map(files.map((file) => [file.path, file]));

  sanitize(doc);

  const stylesheets: string[] = [];

  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet" i][href]')) {
    const file = byPath.get(resolvePath(link.getAttribute('href') ?? '', basePath));
    if (file?.text) stylesheets.push(resolveCssUrls(file.text, byPath, file.path));
  }

  for (const style of doc.querySelectorAll('style')) {
    style.textContent = resolveCssUrls(style.textContent ?? '', byPath, basePath);
  }

  for (const el of doc.querySelectorAll<HTMLElement>('*')) {
    for (const name of RESOURCE_ATTRIBUTES[el.tagName] ?? []) {
      const target = byPath.get(resolvePath(el.getAttribute(name) ?? '', basePath))?.url;
      if (target) el.setAttribute(name, target);
    }

    const inline = el.getAttribute('style');
    if (inline) el.setAttribute('style', resolveCssUrls(inline, byPath, basePath));
  }

  return {
    // `parseFromString` always builds a full document, so a fragment has to be
    // unwrapped again — otherwise every page would gain an `<html>` on import.
    html: asDocument ? `<!DOCTYPE html>\n${doc.documentElement.outerHTML}` : doc.body.innerHTML,
    css: stylesheets.join('\n\n'),
  };
}

/**
 * The inverse: object URLs back to the site paths they stand for.
 *
 * A plain string replacement rather than another DOM round-trip, because object
 * URLs are opaque and unique — there is no chance of matching something that
 * isn't a reference, and it catches them in `style` attributes and `<style>`
 * blocks for free. Re-serializing through DOMParser would also quietly rewrite
 * markup that the user is watching in the HTML tab.
 */
export function toSiteHtml(html: string, files: NsiteFile[]): string {
  let out = html;
  for (const file of files) {
    if (file.url) out = out.split(file.url).join(file.path);
  }
  return out;
}
