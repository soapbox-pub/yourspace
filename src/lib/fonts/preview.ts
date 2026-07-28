import type { FontFamily } from './catalogue';
import { fetchFontFile, fontFileUrl, installWeights } from './install';

/**
 * Loading a family into the *app* document, so the picker can set each name in
 * its own face.
 *
 * A font list that renders every name in the UI font is a list of 1,968
 * strings; the whole point of choosing a typeface is seeing it. This is the
 * only honest way to show that.
 *
 * Built from an `ArrayBuffer` rather than a `url()`, which means the browser
 * never fetches a font on the app's behalf and the app's `font-src` never
 * enters into it — the bytes arrive over `fetch`, which `connect-src` already
 * allows. It also keeps previews entirely out of the canvas: these faces are
 * registered on the editor's own document, so nothing here can end up in the
 * site being edited.
 */

const previews = new Map<string, Promise<void>>();

/** Whether this browser can register fonts at runtime. Absent in jsdom. */
function supported(): boolean {
  return typeof FontFace === 'function' && typeof document !== 'undefined' && !!document.fonts;
}

/**
 * Registers `font` under its own family name, once.
 *
 * Only the regular weight: previews are one line of text at one weight, and
 * pulling the bold too would double the traffic of a scroll through the list
 * for something nothing renders.
 */
export function loadPreview(font: FontFamily): Promise<void> {
  if (!supported()) return Promise.resolve();

  let request = previews.get(font.id);

  if (!request) {
    const weight = installWeights(font)[0];

    request = fetchFontFile(fontFileUrl(font, weight))
      .then(async (buffer) => {
        const face = new FontFace(font.family, buffer, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
      })
      .catch((error: unknown) => {
        // Forgotten rather than remembered as a failure, so scrolling back to a
        // row that lost a request tries again. The row simply stays in the UI
        // font meanwhile, which is a preview being unavailable, not an error
        // worth interrupting anyone over.
        previews.delete(font.id);
        throw error;
      });

    previews.set(font.id, request);
  }

  return request;
}
