import { APP_BLOSSOM_SERVERS } from '@/lib/appBlossom';
import { APP_RELAYS } from '@/lib/appRelays';

import { mountNapplet, pageTheme, type MountedNapplet } from './mount';
import { isRelayUrl, RelayPool } from './relayPool';
import { resolveRelays } from './resolve';
import type { NappletStatus } from './types';
import { NAPPLET_ATTR, NAPPLET_RUNTIME_PATH } from '../constants';
import { decodeNappletRef } from '../manifest';

/**
 * The standalone runtime: what runs inside a published page.
 *
 * This module is bundled on its own and shipped as a file of the site, because
 * a published nsite is a static page on somebody else's host with no access to
 * this app. It finds the napplet placeholders the editor left behind and turns
 * each into a verified, sandboxed frame.
 *
 * Everything it needs, it carries: relay defaults, Blossom defaults, and the
 * whole of NIP-5D. A site can override the first two from the script tag, so a
 * page is not tied forever to the relays this app happened to prefer.
 */

const CHROME_CLASS = 'napplet-status';

/**
 * Where napplets run when a page doesn't say otherwise.
 *
 * Baked in rather than read from app config, because by the time this matters
 * there is no app — just a published page and whatever the runtime was built
 * knowing.
 */
const DEFAULT_SANDBOX_DOMAIN = 'iframe.diy';

/** Splits a whitespace/comma separated attribute into a list. */
function list(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Relays and Blossom servers, from the script tag if it says, else the
 * defaults this app was built with.
 */
function config(): { relays: string[]; blossomServers: string[]; sandboxDomain: string } {
  const script = document.currentScript as HTMLScriptElement | null;
  const el = script ?? document.querySelector(`script[src$="${NAPPLET_RUNTIME_PATH}"]`);

  const relays = list(el?.getAttribute('data-relays')).filter(isRelayUrl);
  const servers = list(el?.getAttribute('data-blossom-servers'));
  const domain = (el?.getAttribute('data-sandbox-domain') ?? '').trim();

  return {
    relays: relays.length ? relays : APP_RELAYS.relays.filter((r) => r.read).map((r) => r.url),
    blossomServers: servers.length ? servers : [...APP_BLOSSOM_SERVERS.servers],
    // Only a bare hostname: this becomes the origin napplets run on, so a value
    // carrying a scheme or a path would build a URL that means something else.
    sandboxDomain: /^[a-z0-9.-]+$/i.test(domain) ? domain : DEFAULT_SANDBOX_DOMAIN,
  };
}

/**
 * The placeholder shown while a napplet resolves, and the notice shown if it
 * cannot.
 *
 * Deliberately plain and inline-styled: this is injected into a stranger's
 * page, so it may not assume a stylesheet, a font, or a colour scheme, and it
 * inherits rather than imposes.
 */
function chrome(host: HTMLElement, status: NappletStatus): void {
  const existing = host.querySelector(`:scope > .${CHROME_CLASS}`);

  if (status.state === 'ready' && !status.missing?.length) {
    existing?.remove();
    return;
  }

  const note =
    status.state === 'error'
      ? status.message
      : status.state === 'loading'
        ? 'Loading napplet…'
        : `This page cannot provide: ${status.missing?.join(', ')}.`;

  /*
   * A napplet that is loading or has failed covers its whole slot, so the page
   * doesn't reflow under the reader as each one resolves. A napplet that is
   * running but short of a capability gets a footnote instead, because there is
   * something behind it worth seeing.
   */
  const covering = status.state !== 'ready';

  const el = (existing as HTMLElement | null) ?? document.createElement('div');
  el.className = CHROME_CLASS;
  el.textContent = note;
  el.style.cssText = [
    'position:absolute',
    covering ? 'inset:0' : 'inset:auto 0 0 0',
    covering ? 'display:flex' : 'display:block',
    'align-items:center',
    'justify-content:center',
    'padding:8px 12px',
    'font:14px/1.5 system-ui,-apple-system,sans-serif',
    'text-align:center',
    'opacity:.75',
    status.state === 'error' ? 'background:rgba(220,38,38,.08)' : 'background:rgba(0,0,0,.04)',
  ].join(';');

  if (!existing) host.appendChild(el);
}

/**
 * Boots every napplet placeholder in the document.
 *
 * One relay pool is shared by all of them: a page with four napplets should
 * open four frames, not four sets of sockets.
 */
export function bootNapplets(root: ParentNode = document): () => void {
  const hosts = [...root.querySelectorAll<HTMLElement>(`[${NAPPLET_ATTR}]`)];
  if (!hosts.length) return () => {};

  const { relays, blossomServers, sandboxDomain } = config();
  const theme = pageTheme();

  // Every relay any napplet on the page might need, so the shared pool has a
  // socket open for each before the first subscription asks for one.
  const all = new Set(relays);
  for (const host of hosts) {
    const ref = decodeNappletRef(host.getAttribute(NAPPLET_ATTR) ?? '');
    if (ref) for (const url of resolveRelays(ref, relays)) all.add(url);
  }

  const pool = new RelayPool([...all]);
  const mounted: MountedNapplet[] = [];

  hosts.forEach((host, index) => {
    const reference = host.getAttribute(NAPPLET_ATTR) ?? '';

    // Whatever the editor left here was a still picture of the napplet. The
    // real one is about to replace it.
    host.textContent = '';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    chrome(host, { state: 'loading' });

    mounted.push(
      mountNapplet(host, reference, {
        relays,
        blossomServers,
        sandboxDomain,
        theme,
        pool,
        // Stable across reloads, and distinct between two copies of the same
        // napplet, which is exactly what NAP-STORAGE's instance scope requires.
        instanceId: `${location.pathname}#${index}`,
        onStatus: (status) => chrome(host, status),
      }),
    );
  });

  return () => {
    for (const napplet of mounted) napplet.destroy();
    pool.destroy();
  };
}

// Self-starting: the script is injected into pages that have napplets, and
// nothing on those pages is going to call this.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootNapplets());
} else {
  bootNapplets();
}
