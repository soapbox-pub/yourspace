/**
 * Prepend `<script src>` tags to an HTML document string.
 *
 * Parsing rather than string-splicing keeps this correct for documents with no
 * explicit `<head>`, and the scripts go first so they run before the site's own.
 */
export function injectScriptTags(html: string, scriptPaths: string[]): string {
  if (scriptPaths.length === 0) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Reverse order, since each prepend pushes the previous one down.
  for (let i = scriptPaths.length - 1; i >= 0; i--) {
    const script = doc.createElement('script');
    script.src = scriptPaths[i];
    doc.head.prepend(script);
  }

  // DOMParser drops the doctype; without it the frame renders in quirks mode.
  const hasDoctype = /^<!doctype\s/i.test(html.trimStart());
  const serialised = doc.documentElement.outerHTML;
  return hasDoctype ? `<!DOCTYPE html>\n${serialised}` : serialised;
}
