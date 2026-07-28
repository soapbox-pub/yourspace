import { useCallback, useEffect, useMemo, useRef, type IframeHTMLAttributes } from 'react';

import { useAppContext } from '@/hooks/useAppContext';
import { bytesToBase64, injectScriptTags, utf8ToBase64 } from '@/lib/sandbox';
import type { FileResponse, InjectedScript, SerialisedRequest } from '@/lib/sandbox';

export interface SandboxFrameProps
  extends Omit<IframeHTMLAttributes<HTMLIFrameElement>, 'src' | 'id' | 'sandbox'> {
  /** The subdomain to run on. Use `deriveIframeSubdomain`, never a raw npub. */
  id: string;
  /** Resolve a pathname to bytes, or `null` for a 404. */
  resolveFile: (pathname: string) => Promise<FileResponse | null>;
  /** Scripts served at their virtual path and injected into every HTML response. */
  injectedScripts?: InjectedScript[];
  /**
   * Runs when the frame announces itself, before it is allowed to start
   * fetching. Returning a pending promise holds the frame at the handshake,
   * which is how a slow manifest load avoids answering requests with 404s.
   */
  onReady?: () => void | Promise<void>;
}

/**
 * Capabilities delegated to the frame.
 *
 * A cross-origin iframe gets none of these unless the embedder hands them
 * over, so the list is what an ordinary web page may reasonably want.
 *
 * Withheld on purpose, because the content is untrusted and these either cost
 * money or impersonate a trust prompt: `payment`, `publickey-credentials-*`
 * (passkey phishing), `otp-credentials`, `identity-credentials-get`, and
 * `local-fonts` (pure fingerprinting surface). Raw device access — `bluetooth`,
 * `hid`, `serial`, `usb` — is withheld too; it is gesture-gated, but nothing
 * an nsite does needs it.
 */
const SANDBOX_ALLOW = [
  'accelerometer',
  'autoplay',
  'camera',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'gamepad',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'midi',
  'picture-in-picture',
  'pointer-lock',
  'screen-wake-lock',
  'web-share',
  'xr-spatial-tracking',
].join('; ');

/**
 * Serve one request: an injected script if the path matches, otherwise
 * whatever the consumer's resolver returns.
 */
async function serve(
  pathname: string,
  resolveFile: (pathname: string) => Promise<FileResponse | null>,
  scripts: InjectedScript[],
  respond: (result: Record<string, unknown>) => void,
  respondError: (code: number, message: string) => void,
): Promise<void> {
  const virtual = scripts.find((s) => pathname === `/${s.path}` || pathname === s.path);
  if (virtual) {
    respond({
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' },
      body: utf8ToBase64(virtual.content),
    });
    return;
  }

  try {
    const file = await resolveFile(pathname);

    if (!file) {
      respond({
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/plain' },
        body: utf8ToBase64('Not Found'),
      });
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': file.contentType,
      'Cache-Control': 'no-cache',
    };

    let body: string;
    if (file.contentType === 'text/html' && scripts.length > 0) {
      const html = new TextDecoder().decode(file.body);
      body = utf8ToBase64(injectScriptTags(html, scripts.map((s) => `/${s.path}`)));
    } else {
      body = bytesToBase64(file.body);
      headers['Content-Length'] = String(file.body.byteLength);
    }

    respond({ status: file.status, statusText: 'OK', headers, body });
  } catch (err) {
    respondError(-32002, String(err));
  }
}

/**
 * Runs untrusted content in a frame on its own origin.
 *
 * The frame is loaded from `<id>.<sandboxDomain>` — an iframe.diy deployment,
 * which registers a Service Worker and forwards every request it makes back
 * here over `postMessage` as JSON-RPC. Nothing is served over the network by
 * the sandbox itself: `resolveFile` answers each request, so the embedder
 * decides what exists.
 *
 * The isolation comes from the origin, not the `sandbox` attribute. Because
 * each site gets a distinct subdomain, its storage and its scripts cannot
 * reach this app or any other site.
 */
export function SandboxFrame({
  id,
  resolveFile,
  injectedScripts,
  onReady,
  ...iframeProps
}: SandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { config } = useAppContext();

  const origin = useMemo(
    () => `https://${id}.${config.sandboxDomain}`,
    [id, config.sandboxDomain],
  );

  // Held in refs so a consumer re-rendering with a new callback doesn't tear
  // down and re-register the listener mid-handshake.
  const resolveFileRef = useRef(resolveFile);
  const injectedScriptsRef = useRef(injectedScripts);
  const onReadyRef = useRef(onReady);

  useEffect(() => { resolveFileRef.current = resolveFile; }, [resolveFile]);
  useEffect(() => { injectedScriptsRef.current = injectedScripts; }, [injectedScripts]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const post = useCallback(
    (msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(msg, origin);
    },
    [origin],
  );

  useEffect(() => {
    async function handleFetch(id: string | number, params: { request?: SerialisedRequest }) {
      const reqUrl = params?.request?.url;
      if (!reqUrl) {
        post({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Invalid request' } });
        return;
      }

      let pathname: string;
      try {
        const url = new URL(reqUrl);
        // The frame may only ask for its own origin. Anything else would turn
        // this handler into an open proxy that borrows the app's credentials.
        if (url.origin !== origin) {
          post({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Origin mismatch' } });
          return;
        }
        pathname = url.pathname;
      } catch {
        post({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Invalid URL' } });
        return;
      }

      await serve(
        pathname,
        resolveFileRef.current,
        injectedScriptsRef.current ?? [],
        (result) => post({ jsonrpc: '2.0', id, result }),
        (code, message) => post({ jsonrpc: '2.0', id, error: { code, message } }),
      );
    }

    async function handleReady() {
      try {
        await onReadyRef.current?.();
      } catch (err) {
        console.error('[SandboxFrame] onReady failed:', err);
      }
      post({ jsonrpc: '2.0', method: 'init', params: { version: 1 } });
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const msg = event.data;
      if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return;

      // `ready` is a notification, so it carries no id.
      if (msg.method === 'ready' && msg.id === undefined) {
        handleReady();
        return;
      }

      if (msg.id !== undefined && msg.method === 'fetch') {
        handleFetch(msg.id, msg.params);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, post]);

  return (
    <iframe
      ref={iframeRef}
      src={`${origin}/`}
      allow={SANDBOX_ALLOW}
      // Belt and braces over the origin isolation. `allow-same-origin` reads
      // alarming but is required — without it the frame is opaque-origin and
      // cannot register the Service Worker the whole scheme depends on; it
      // grants same-origin with the *subdomain*, not with this app.
      // `allow-top-navigation` is withheld so a site cannot navigate the tab
      // out from under the visitor.
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock"
      {...iframeProps}
    />
  );
}

export default SandboxFrame;
