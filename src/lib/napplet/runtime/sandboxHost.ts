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

  const view = frame.ownerDocument.defaultView ?? window;
  let destroyed = false;

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
    // The outer frame relays the inner document's messages, so every legitimate
    // message arrives from that one Window and that one origin.
    if (event.origin !== origin) return;
    if (event.source !== frame.contentWindow) return;

    const message = event.data;
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') return;

    const { id, method, params } = message as {
      id?: unknown;
      method?: string;
      params?: Record<string, unknown>;
    };

    // `ready` is a notification and repeats until it is answered.
    if (method === 'ready' && id === undefined) {
      post({ jsonrpc: '2.0', method: 'init', params: { version: 1 } });
      return;
    }

    if (method === 'fetch' && id !== undefined) {
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

  view.addEventListener('message', onMessage);

  return {
    push(message) {
      // A notification, which is what the relay forwards to the inner document
      // without expecting anything back.
      post({ jsonrpc: '2.0', method: NAPPLET_METHOD, params: message });
    },
    destroy() {
      destroyed = true;
      view.removeEventListener('message', onMessage);
    },
  };
}
