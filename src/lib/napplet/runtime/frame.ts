/**
 * The napplet frame: where it runs, and what it is allowed to do there.
 *
 * A napplet gets an origin of its own — a subdomain derived from its identity
 * through a device-local secret — and runs there behind iframe.diy, exactly as
 * a published nsite does. Its files are served by this app over `postMessage`
 * rather than fetched from anywhere, so what runs is the bytes the manifest
 * signed and nothing else.
 *
 * This is a deliberate departure from NIP-5D, which calls for `srcdoc` and an
 * opaque origin. The trade is stated plainly in `NIP.md`: an opaque origin is
 * the stronger boundary, but it also has no storage, no Service Worker and no
 * network, which leaves a napplet unable to load so much as an avatar until
 * NAP-RESOURCE exists. A private per-napplet origin keeps napplets isolated
 * from this app and from each other while leaving them a working web platform.
 */

/** Where the shim is served, and linked from, inside the napplet's own origin. */
export const SHIM_PATH = '/__napplet__/shim.js';

/**
 * Capabilities handed to a napplet frame.
 *
 * The same list `SandboxFrame` gives an nsite, minus the ones that cost money
 * or imitate a trust prompt. A napplet is a widget on somebody's homepage; it
 * has no business asking for a passkey or a payment.
 */
export const NAPPLET_ALLOW = [
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'picture-in-picture',
  'web-share',
].join('; ');

/**
 * Sandbox tokens for the outer frame.
 *
 * `allow-same-origin` is present and load-bearing: without it the frame is
 * opaque-origin and cannot register the Service Worker this whole scheme runs
 * on. It grants same-origin with the *napplet's own subdomain*, never with this
 * app — which is what keeps a napplet away from the `nsec` in localStorage.
 *
 * `allow-top-navigation` is withheld, so a napplet cannot navigate the tab out
 * from under whoever is reading the page it sits on. `allow-popups` too: a
 * widget has no reason to open windows.
 */
export const NAPPLET_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals';

/**
 * Points a napplet's entry document at the shim.
 *
 * Prepended to `<head>` so the namespace exists before any of the napplet's own
 * code runs, which NIP-5D requires. Parsing rather than splicing, so a document
 * with no explicit `<head>` still gets one in the right place.
 *
 * The injection deliberately happens *after* the bytes have been verified and
 * hashed — the shim is the runtime's, not the author's, and must never be part
 * of what the content address is computed over.
 */
export function withShim(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const head = doc.head ?? doc.createElement('head');
  if (!doc.head) doc.documentElement.prepend(head);

  const script = doc.createElement('script');
  script.setAttribute('src', SHIM_PATH);
  head.prepend(script);

  // DOMParser drops the doctype, and a napplet served without one renders in
  // quirks mode. Always added rather than conditionally restored: this is a
  // whole document being served as one, whatever the author wrote.
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}
