import { decodeNappletRef, describeNapplet } from '../manifest';
import { RelayPool } from './relayPool';
import { resolveNapplet, resolveRelays } from './resolve';
import { GRANTED_DOMAINS, NappletSession } from './session';
import { NAPPLET_SANDBOX, nappletSrcdoc } from './srcdoc';
import type { NappletRuntimeConfig, NappletStatus, NappletTheme } from './types';

/**
 * Putting a napplet on a page.
 *
 * The order here is the security model. Bytes are resolved and verified first,
 * the frame is created second, and the frame's `Window` is mapped to the
 * identity computed from those bytes *before* anything is allowed to run — so
 * by the time a napplet can send its first message, the host already knows
 * exactly what it is, and knows it from the bytes rather than from the message.
 */

/**
 * Every live napplet on this page, keyed by the frame's `Window`.
 *
 * A `Window` reference cannot be forged from inside the browsing context, which
 * is why NIP-5D identifies senders by `MessageEvent.source` and not by origin —
 * a sandboxed napplet has no origin to check.
 */
const sessions = new Map<Window, NappletSession>();

/**
 * Windows already being listened on.
 *
 * A napplet posts to `window.parent`, which is whichever document holds its
 * frame — the page itself when the runtime is shipped inside a published site,
 * but the editor's canvas iframe when it is running in the studio. Listening on
 * the app's own window would miss the second case entirely, so the listener goes
 * on the window that actually owns the frame.
 */
const listening = new WeakSet<Window>();

function listen(view: Window): void {
  if (listening.has(view)) return;
  listening.add(view);

  view.addEventListener('message', (event) => {
    // Anything from a frame this runtime did not create is dropped without a
    // reply, which is also what stops an unrelated page probing the host.
    const session = event.source ? sessions.get(event.source as Window) : undefined;
    if (!session) return;

    const message = event.data;
    if (!message || typeof message !== 'object') return;

    session.handle(message as Record<string, unknown>);
  });
}

/** A hex colour from a computed CSS colour, or the fallback. */
function toHex(value: string, fallback: string): string {
  const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
  if (!match) return /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : fallback;

  const [, r, g, b] = match;
  return `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The theme a napplet is told about, read off the page hosting it.
 *
 * NAP-THEME leaves the source to the shell. Taking it from the page's own
 * computed colours means a napplet dropped into somebody's homepage inherits
 * that homepage's palette rather than arriving in whatever colours its author
 * happened to pick.
 */
export function pageTheme(root: Element = document.body): NappletTheme {
  // The element's own document, not this one: in the editor the page being
  // themed is inside the canvas frame.
  const view = root.ownerDocument.defaultView ?? window;
  const style = view.getComputedStyle(root);

  return {
    colors: {
      background: toHex(style.backgroundColor, '#ffffff'),
      text: toHex(style.color, '#0f172a'),
      // No page-level notion of an accent, so the text colour stands in rather
      // than inventing one that clashes.
      primary: toHex(style.color, '#0f172a'),
    },
  };
}

export interface MountedNapplet {
  /** Tears down the frame, its subscriptions and its session. */
  destroy(): void;
  /** Pushes a new theme, per NAP-THEME's shell-initiated `theme.changed`. */
  setTheme(theme: NappletTheme): void;
}

export interface MountOptions extends NappletRuntimeConfig {
  /**
   * Distinguishes two copies of the same napplet on one page, for
   * instance-scoped storage. Must be stable across reloads.
   */
  instanceId: string;
  onStatus?: (status: NappletStatus) => void;
  /** Shared between every napplet on the page, so one socket serves all. */
  pool?: RelayPool;
}

/**
 * Resolves, verifies and runs the napplet a reference names, inside `host`.
 *
 * Returns as soon as the frame exists; progress arrives through `onStatus`,
 * because resolving involves relays and Blossom and the caller has a placeholder
 * to keep on screen meanwhile.
 */
export function mountNapplet(
  host: HTMLElement,
  reference: string,
  options: MountOptions,
): MountedNapplet {
  const view = host.ownerDocument.defaultView ?? window;
  listen(view);

  const controller = new AbortController();
  let frame: HTMLIFrameElement | null = null;
  let session: NappletSession | null = null;
  let ownedPool: RelayPool | null = null;
  let destroyed = false;

  const report = (status: NappletStatus) => {
    if (!destroyed) options.onStatus?.(status);
  };

  report({ state: 'loading' });

  const ref = decodeNappletRef(reference);
  if (!ref) {
    report({ state: 'error', message: 'That is not a napplet identifier.' });
    return { destroy() {}, setTheme() {} };
  }

  const relays = resolveRelays(ref, options.relays);
  const pool = options.pool ?? (ownedPool = new RelayPool(relays));

  (async () => {
    let resolved;
    try {
      resolved = await resolveNapplet(ref, {
        relays: options.relays,
        blossomServers: options.blossomServers,
        pool,
        signal: controller.signal,
      });
    } catch (error) {
      report({
        state: 'error',
        message: error instanceof Error ? error.message : 'The napplet could not be loaded.',
      });
      return;
    }

    if (destroyed) return;

    const { manifest, identity, html } = resolved;

    /*
     * The frame is created empty and inserted before it is given anything to
     * run, because `contentWindow` is what the session is keyed on and a frame
     * outside the document has none. Setting `srcdoc` afterwards is what starts
     * the napplet, by which point the mapping is already in place.
     */
    frame = host.ownerDocument.createElement('iframe');
    frame.setAttribute('sandbox', NAPPLET_SANDBOX);
    frame.setAttribute('title', describeNapplet(manifest));
    frame.setAttribute('loading', 'lazy');
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;';

    host.appendChild(frame);

    const target = frame.contentWindow;
    if (!target) {
      report({ state: 'error', message: 'The napplet frame could not be created.' });
      return;
    }

    session = new NappletSession(
      identity,
      (message) => {
        // '*' is required: the frame has an opaque origin, so there is no
        // origin string that would ever match it.
        frame?.contentWindow?.postMessage(message, '*');
      },
      pool,
      relays,
      options.instanceId,
      options.theme ?? pageTheme(),
    );
    sessions.set(target, session);

    frame.srcdoc = nappletSrcdoc(html, [...GRANTED_DOMAINS]);

    const missing = manifest.requires.filter(
      (domain) => !GRANTED_DOMAINS.includes(domain as (typeof GRANTED_DOMAINS)[number]),
    );

    report({
      state: 'ready',
      title: describeNapplet(manifest),
      identity,
      ...(missing.length ? { missing } : {}),
    });
  })();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();

      const target = frame?.contentWindow;
      if (target) sessions.delete(target);

      session?.destroy();
      frame?.remove();
      ownedPool?.destroy();
    },
    setTheme(theme) {
      session?.setTheme(theme);
    },
  };
}
