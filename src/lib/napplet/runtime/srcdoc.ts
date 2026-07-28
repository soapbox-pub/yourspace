import { guestShim } from './guest';

/**
 * Wrapping verified napplet bytes into the document that actually runs.
 *
 * Two things are added, both of them outside the bytes the napplet's content
 * address was computed over, and both of them ahead of anything the napplet
 * controls: the Content Security Policy, and the `window.napplet` namespace.
 * Order matters — a policy parsed after a script has already run does not
 * govern it.
 */

/**
 * NIP-5D's conservative baseline, verbatim.
 *
 * A `srcdoc` document has no HTTP response to carry a policy header, so it goes
 * in a `meta` element, which must therefore be the first thing in `<head>`.
 *
 * `connect-src 'none'` is the load-bearing line: it is what stops a napplet
 * reaching the network on its own account, so that everything it does reach
 * goes through the host and can be refused. `img-src data: blob:` looks
 * restrictive but is the intended shape — remote images are meant to arrive as
 * bytes through NAP-RESOURCE, not to be fetched by the napplet. This runtime
 * does not implement NAP-RESOURCE, so a napplet here shows no remote images;
 * that is a smaller problem than handing it a network.
 *
 * `report-uri`, `frame-ancestors` and `sandbox` are not enforced from a `meta`
 * element and so are deliberately absent.
 */
const CSP =
  "default-src 'none'; " +
  "script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; " +
  'img-src data: blob:; ' +
  'font-src data:; ' +
  "connect-src 'none'; " +
  "worker-src 'none'; " +
  "child-src 'none'; " +
  "frame-src 'none'; " +
  "media-src 'none'; " +
  "object-src 'none'; " +
  "manifest-src 'none'; " +
  "base-uri 'none'; " +
  "form-action 'none'";

/**
 * The document to hand a napplet frame as `srcdoc`.
 *
 * `srcdoc` rather than a `src` the frame navigates to, because navigation would
 * mean fetching the bytes from somewhere — and then the thing that ran would be
 * whatever that somewhere served, not what was verified here.
 */
export function nappletSrcdoc(html: string, domains: string[]): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const head = doc.head ?? doc.createElement('head');
  if (!doc.head) doc.documentElement.prepend(head);

  const shim = doc.createElement('script');
  shim.textContent = guestShim(domains);
  head.prepend(shim);

  // Prepended after the shim so that it ends up before it: the policy has to be
  // the first element in the head to govern everything that follows.
  const csp = doc.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', CSP);
  head.prepend(csp);

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/**
 * The sandbox tokens a napplet frame gets, and the ones it must never get.
 *
 * `allow-same-origin` is absent, which is the whole security model: without it
 * the frame has an opaque origin — no storage of any kind, no service worker,
 * no way to reach the embedding page. NIP-5D requires its absence, and this is
 * a stronger boundary than giving each napplet its own real origin would be,
 * because an opaque origin has nothing to isolate in the first place.
 *
 * `allow-scripts` alone is what the spec calls for. Nothing is added: forms,
 * popups and top-level navigation are all ways for untrusted content to take a
 * visitor somewhere they did not ask to go.
 */
export const NAPPLET_SANDBOX = 'allow-scripts';
