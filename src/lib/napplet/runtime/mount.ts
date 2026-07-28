import { deriveIframeSubdomain } from '@/lib/iframeSubdomain';
import { getMimeType } from '@/lib/sandbox/mimeTypes';

import { decodeNappletRef, describeNapplet, NAPPLET_ENTRY } from '../manifest';
import { guestShim } from './guest';
import { NAPPLET_ALLOW, NAPPLET_SANDBOX, SHIM_PATH, withShim } from './frame';
import { RelayPool } from './relayPool';
import { fetchNappletBlob, resolveNapplet, resolveRelays } from './resolve';
import { serveSandbox, type ServedFile } from './sandboxHost';
import { GRANTED_DOMAINS, NappletSession } from './session';
import type { NappletRuntimeConfig, NappletStatus, NappletTheme } from './types';

/**
 * Putting a napplet on a page.
 *
 * The order is the security model. Bytes are resolved and verified first, the
 * origin is derived from the identity those bytes produced, and only then does
 * a frame exist to run them in — so a napplet's origin is a function of what it
 * is, and two versions of the same napplet never share one.
 */

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

interface MountOptions extends NappletRuntimeConfig {
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
 * Returns as soon as the mount is under way; progress arrives through
 * `onStatus`, because resolving involves relays and Blossom and the caller has
 * a placeholder to keep on screen meanwhile.
 */
export function mountNapplet(
  host: HTMLElement,
  reference: string,
  options: MountOptions,
): MountedNapplet {
  const controller = new AbortController();

  let frame: HTMLIFrameElement | null = null;
  let session: NappletSession | null = null;
  let sandbox: ReturnType<typeof serveSandbox> | null = null;
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

    const { manifest, identity, html, servers } = resolved;

    /*
     * The origin is keyed on the napplet's identity, then run through the
     * device secret, so it is stable for this browser and unguessable from
     * outside. Two napplets never collide, and neither do two versions of one:
     * a napplet whose bytes change gets a new origin and starts with empty
     * storage rather than inheriting state written by code that no longer runs.
     */
    const subdomain = deriveIframeSubdomain(
      'napplet',
      `${identity.dTag}:${identity.aggregateHash}`,
    );
    const origin = `https://${subdomain}.${options.sandboxDomain}`;

    const entry = withShim(html);
    const shim = guestShim([...GRANTED_DOMAINS]);
    const byPath = new Map(manifest.paths.map(({ path, sha256 }) => [path, sha256]));

    /**
     * Everything the napplet's frame is allowed to load.
     *
     * The shim and the entry document are the runtime's own. Every other path
     * has to appear in the signed manifest and digest to the hash recorded
     * there, so a napplet cannot be served a file its author never published.
     */
    const resolveFile = async (pathname: string): Promise<ServedFile | null> => {
      if (pathname === SHIM_PATH) {
        return { status: 200, contentType: 'application/javascript', body: shim };
      }

      /*
       * The entry document, with the shim linked into it — served for its own
       * path, for the root, and for anything that names no file at all, which
       * is what lets a napplet's own client-side routes resolve. Checked before
       * the manifest so the raw, unshimmed `/index.html` blob is never served.
       */
      if (pathname === '/' || pathname === NAPPLET_ENTRY || !/\.[a-z0-9]+$/i.test(pathname)) {
        return { status: 200, contentType: 'text/html', body: entry };
      }

      const sha256 = byPath.get(pathname);
      if (!sha256) return null;

      const bytes = await fetchNappletBlob(sha256, servers, controller.signal);
      if (!bytes) return null;

      return {
        status: 200,
        // The manifest path decides the type. Blossom is content-addressed and
        // routinely reports the wrong one, which browsers refuse to execute.
        contentType: getMimeType(pathname),
        body: new Uint8Array(bytes),
      };
    };

    frame = host.ownerDocument.createElement('iframe');
    frame.setAttribute('sandbox', NAPPLET_SANDBOX);
    frame.setAttribute('allow', NAPPLET_ALLOW);
    frame.setAttribute('title', describeNapplet(manifest));
    frame.src = `${origin}/`;
    /*
     * Positioned rather than sized. The host is a `min-height` box with no
     * definite height of its own, and a percentage height resolves against a
     * definite one — so `height:100%` here computes to nothing and the frame
     * collapses to a 0px line. Filling the positioned host sidesteps the
     * question entirely.
     */
    frame.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;border:0;';

    session = new NappletSession(
      identity,
      (message) => sandbox?.push(message),
      pool,
      relays,
      options.instanceId,
      options.theme ?? pageTheme(),
    );

    sandbox = serveSandbox({
      frame,
      origin,
      resolveFile,
      onNapplet: (message) => session?.handle(message),
    });

    host.appendChild(frame);

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

      sandbox?.destroy();
      session?.destroy();
      frame?.remove();
      ownedPool?.destroy();
    },
    setTheme(theme) {
      session?.setTheme(theme);
    },
  };
}
