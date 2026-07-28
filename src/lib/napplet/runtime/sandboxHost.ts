import { bytesToBase64, utf8ToBase64 } from '@/lib/sandbox/base64';

/**
 * The parent half of iframe.diy's protocol, without React.
 *
 * `SandboxFrame` already speaks this, but it is a React component and the
 * napplet runtime also has to run as a plain script inside somebody's published
 * page. This is the same handshake and the same JSON-RPC dialect, driven from
 * ordinary DOM.
 *
 * Two kinds of traffic share the channel:
 *
 * - **`fetch`** — the frame's Service Worker asking for a file. Answered from
 *   the verified napplet bytes, so nothing the napplet loads comes off the
 *   network unchecked.
 * - **`napplet`** — NAP messages. iframe.diy relays any JSON-RPC method it does
 *   not reserve, in both directions, which is the only reason NAP traffic can
 *   cross at all: the frame drops anything that is not JSON-RPC 2.0, so the raw
 *   NIP-5D envelope would never arrive. The shim wraps and unwraps it.
 */

/** Methods iframe.diy handles itself and will not relay. */
const RESERVED = new Set(['ready', 'init', 'fetch']);

/** The method NAP traffic travels under. Anything unreserved would do. */
export const NAPPLET_METHOD = 'napplet';

export interface ServedFile {
  status: number;
  contentType: string;
  body: Uint8Array | string;
}

export interface SandboxHostOptions {
  /** The frame element. Its `contentWindow` is the only accepted sender. */
  frame: HTMLIFrameElement;
  /** `https://<subdomain>.<sandboxDomain>` — the only accepted origin. */
  origin: string;
  /** Answers one pathname, or `null` for a 404. */
  resolveFile: (pathname: string) => Promise<ServedFile | null>;
  /** Receives one unwrapped NAP message from the napplet. */
  onNapplet: (message: Record<string, unknown>) => void;
}

function body(file: ServedFile): string {
  return typeof file.body === 'string' ? utf8ToBase64(file.body) : bytesToBase64(file.body);
}

/**
 * Serves one napplet frame for as long as it is on the page.
 *
 * Returns a handle for pushing NAP messages down to the napplet and for tearing
 * the listener down again.
 */
export function serveSandbox(options: SandboxHostOptions): {
  push: (message: Record<string, unknown>) => void;
  destroy: () => void;
} {
  const { frame, origin, resolveFile, onNapplet } = options;

  let destroyed = false;
  let sawReady = false;

  /**
   * Traces one napplet's conversation with its frame.
   *
   * On by default and labelled with the frame's own subdomain, because a
   * napplet that never finishes its handshake is otherwise indistinguishable
   * from one that is merely slow — the frame's spinner is all either of them
   * shows. Silenced with `localStorage['napplet:quiet'] = '1'`.
   */
  const label = `[napplet ${new URL(origin).hostname.split('.')[0].slice(0, 8)}]`;

  const log = (...parts: unknown[]) => {
    try {
      if (localStorage.getItem('napplet:quiet')) return;
    } catch {
      // No storage here; log anyway.
    }
    console.info(label, ...parts);
  };

  const post = (message: Record<string, unknown>) => {
    if (destroyed) return;
    frame.contentWindow?.postMessage(message, origin);
  };

  async function handleFetch(id: unknown, params: { request?: { url?: string } }): Promise<void> {
    const url = params?.request?.url;
    if (!url) {
      post({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Invalid request' } });
      return;
    }

    let pathname: string;
    try {
      const parsed = new URL(url);
      // The frame may only ask for its own origin. Anything else would make
      // this an open proxy borrowing the page's network position.
      if (parsed.origin !== origin) {
        post({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Origin mismatch' } });
        return;
      }
      pathname = parsed.pathname;
    } catch {
      post({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Invalid URL' } });
      return;
    }

    try {
      const file = await resolveFile(pathname);

      if (!file) {
        post({
          jsonrpc: '2.0',
          id,
          result: {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' },
            body: utf8ToBase64('Not Found'),
          },
        });
        return;
      }

      post({
        jsonrpc: '2.0',
        id,
        result: {
          status: file.status,
          statusText: 'OK',
          headers: { 'Content-Type': file.contentType, 'Cache-Control': 'no-cache' },
          body: body(file),
        },
      });
    } catch (error) {
      post({ jsonrpc: '2.0', id, error: { code: -32002, message: String(error) } });
    }
  }

  function onMessage(event: MessageEvent): void {
    if (destroyed) return;

    const data = event.data as { jsonrpc?: string; method?: string } | null;

    /*
     * Only messages that look like they were meant for us, so an unrelated
     * postMessage on a shared window doesn't fill the console. A message that
     * gets this far and is then refused is the interesting case, and is why the
     * refusals below say which check failed.
     */
    const relevant = Boolean(data && typeof data === 'object' && data.jsonrpc === '2.0');

    // The outer frame relays the inner document's messages, so every legitimate
    // message arrives from that one Window and that one origin.
    if (event.origin !== origin) {
      if (relevant) {
        log('ignored: origin mismatch', { got: event.origin, want: origin, method: data?.method });
      }
      return;
    }
    if (event.source !== frame.contentWindow) {
      if (relevant) {
        log('ignored: not this frame’s window', {
          method: data?.method,
          hasContentWindow: Boolean(frame.contentWindow),
        });
      }
      return;
    }

    const message = event.data;
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') return;

    log('recv', message.method ?? '(response)', message.id ?? '');

    const { id, method, params } = message as {
      id?: unknown;
      method?: string;
      params?: Record<string, unknown>;
    };

    // `ready` is a notification and repeats until it is answered.
    if (method === 'ready' && id === undefined) {
      // Repeated until answered, so only the first one is worth a line.
      if (!sawReady) log('handshake: ready received, sending init');
      sawReady = true;
      post({ jsonrpc: '2.0', method: 'init', params: { version: 1 } });
      return;
    }

    if (method === 'fetch' && id !== undefined) {
      const asked = (params as { request?: { url?: string } })?.request?.url;
      log('serve', asked ? new URL(asked).pathname : '(no url)');
      void handleFetch(id, (params ?? {}) as { request?: { url?: string } });
      return;
    }

    if (method === NAPPLET_METHOD && id !== undefined) {
      /*
       * Answered straight away, before the message is acted on. The relay holds
       * a slot per outstanding id so it knows which document to route the reply
       * to, and NAP results arrive later as pushes correlated by their own id —
       * so the JSON-RPC reply is an acknowledgement whose only job is to let
       * that slot go.
       */
      post({ jsonrpc: '2.0', id, result: null });
      if (params) onNapplet(params);
      return;
    }

    if (!method || RESERVED.has(method)) return;
  }

  /*
   * A frame posts to `window.parent`, so the listener has to be on whichever
   * window ends up owning this one — and that is not knowable when the frame is
   * created.
   *
   * In the editor, GrapesJS builds component elements in the *app* document
   * (Backbone mints them from the global `document`) and only adopts them into
   * the canvas document afterwards. A listener bound to `ownerDocument` at
   * creation time can therefore end up on the app window while the frame ends
   * up parented by the canvas window, and the handshake is simply never heard:
   * the frame retries `ready` forever and shows a spinner that never clears.
   *
   * So every candidate window is listened on, and the set is topped up whenever
   * the frame loads — which is also exactly when a frame moved between
   * documents starts over. The checks inside `onMessage` are what make this
   * safe to spread around: a message still has to come from this frame's own
   * Window and its own origin, whichever window carried it.
   */
  const bound = new Set<Window>();

  const bind = (candidate: Window | null | undefined, why: string) => {
    if (destroyed || !candidate || bound.has(candidate)) return;
    bound.add(candidate);
    candidate.addEventListener('message', onMessage);
    log('listening on', why, `(${bound.size} window${bound.size === 1 ? '' : 's'})`);
  };

  const bindAll = () => {
    const owner = frame.ownerDocument.defaultView;
    bind(owner, owner === window ? 'owner window (same as app)' : 'owner window (canvas)');
    bind(typeof window === 'undefined' ? null : window, 'app window');
  };

  bindAll();
  frame.addEventListener('load', () => {
    log('frame load', { connected: frame.isConnected });
    bindAll();
  });

  /*
   * The frame's own spinner runs until it is answered, so a handshake that
   * never arrives looks exactly like a napplet that is merely slow. Since the
   * usual cause is the listener sitting on a different window than the one the
   * frame is parented by, say so plainly rather than leaving a spinner to be
   * interpreted.
   */
  const watchdog = setTimeout(() => {
    if (destroyed || sawReady) return;

    console.warn(
      '[napplet] no handshake from the sandbox frame after 6s.',
      {
        origin,
        connected: frame.isConnected,
        boundWindows: bound.size,
        // The telling case: the frame is parented by a window nobody is
        // listening on.
        ownerIsListening: bound.has(frame.ownerDocument.defaultView as Window),
      },
      'Append `?debug` to the frame URL for iframe.diy\u2019s own logging.',
    );
  }, 6000);

  return {
    push(message) {
      // A notification, which is what the relay forwards to the inner document
      // without expecting anything back.
      post({ jsonrpc: '2.0', method: NAPPLET_METHOD, params: message });
    },
    destroy() {
      destroyed = true;
      clearTimeout(watchdog);
      frame.removeEventListener('load', bindAll);
      for (const candidate of bound) candidate.removeEventListener('message', onMessage);
      bound.clear();
    },
  };
}
