import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Folds the built stylesheet into index.html.
 *
 * An nsite is served by a gateway that hands back each file with whatever
 * Content-Type the Blossom server reports for its blob. CSS is not
 * content-sniffable, so it comes back as text/plain and the browser refuses to
 * apply an external stylesheet. Inlining the CSS as a <style> tag sidesteps the
 * gateway's MIME handling entirely — the styles travel inside the HTML, which
 * is served as text/html regardless. `build.cssCodeSplit: false` guarantees a
 * single stylesheet, so there is nothing left for the runtime to <link> in.
 */

const dist = 'dist';
const htmlPath = join(dist, 'index.html');

let html = readFileSync(htmlPath, 'utf8');

const linkRe = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
const links = html.match(linkRe) ?? [];

if (links.length === 0) {
  console.log('inline-css: no stylesheet link found, nothing to do.');
  process.exit(0);
}

for (const link of links) {
  const href = link.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!href) continue;

  const rel = href.replace(/^\//, '').split('?')[0];
  const cssPath = join(dist, rel);
  const css = readFileSync(cssPath, 'utf8');

  // A stylesheet has no reason to contain "</style", but guard the string
  // boundary so a stray sequence can never break out of the tag.
  const safe = css.replace(/<\/style>/gi, '<\\/style>');
  html = html.replace(link, `<style>${safe}</style>`);

  rmSync(cssPath, { force: true });
  console.log(`inline-css: inlined ${rel} (${css.length} bytes) and removed the file.`);
}

writeFileSync(htmlPath, html);
