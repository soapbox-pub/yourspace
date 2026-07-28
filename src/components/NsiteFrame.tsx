import type { NostrEvent } from '@nostrify/nostrify';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SandboxFrame } from '@/components/SandboxFrame';
import { Spinner } from '@/components/Spinner';
import { useAppContext } from '@/hooks/useAppContext';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { deriveIframeSubdomain } from '@/lib/iframeSubdomain';
import { extensionOf, isPagePath, mimeForPath } from '@/lib/nsite/files';
import { blobServers } from '@/lib/nsite/blobs';
import { loadBlob, prefetchSite } from '@/lib/nsite/blobStore';
import { parseManifest, type NsiteRef } from '@/lib/nsite/manifest';
import { getNsiteSubdomain } from '@/lib/nsite/subdomain';
import { cn } from '@/lib/utils';
import type { FileResponse, InjectedScript } from '@/lib/sandbox';

/**
 * The sandbox loads the frame at `/index.html`, but a site's own router will
 * expect to see `/`. Rewriting before anything else runs saves every SPA from
 * having to special-case it.
 */
const PATH_FIXUP: InjectedScript = {
  path: '__yourspace__/path.js',
  content: `(function () {
  'use strict';
  if (window.location.pathname === '/index.html') {
    history.replaceState(null, '', '/');
  }
})();`,
};

interface NsiteFrameProps {
  /** The manifest event (kind 15128 or 35128). */
  event: NostrEvent;
  /** The reference the event was fetched for. Named `siteRef` because React
   * claims `ref`. */
  siteRef: NsiteRef;
  title: string;
  className?: string;
}

/** Long enough that a site which is simply fast never shows a spinner. */
const SPINNER_DELAY = 400;

/**
 * Renders a published nsite.
 *
 * The site's files start downloading the moment the manifest is in hand, in
 * parallel with the sandbox booting its Service Worker, so the frame's own
 * requests are answered from bytes already fetched or from a request already
 * in flight rather than starting one. Past that first page it is the browser's
 * job: the frame paints as its files arrive, the way any other page does.
 *
 * Everything runs inside `SandboxFrame` on an origin of its own — the site's
 * scripts are the author's, not ours, and this app's localStorage holds nsec.
 */
export function NsiteFrame({ event, siteRef, title, className }: NsiteFrameProps) {
  const { config } = useAppContext();

  // The subdomain the entry page has been handed to, rather than a flag, so
  // moving to another site puts the veil back without anything to reset.
  const [served, setServed] = useState<string | null>(null);
  const [waited, setWaited] = useState<string | null>(null);

  const manifest = useMemo(() => parseManifest(event, siteRef), [event, siteRef]);

  const paths = useMemo(
    () => new Map(manifest.paths.map(({ path, sha256 }) => [path, sha256])),
    [manifest],
  );

  const servers = useMemo(
    () =>
      blobServers(
        manifest,
        getEffectiveBlossomServers(
          config.blossomServerMetadata,
          config.useAppBlossomServers,
        ),
      ),
    [manifest, config.blossomServerMetadata, config.useAppBlossomServers],
  );

  // Keyed on the site's public identity, then run through the device secret so
  // the origin isn't guessable from the npub alone.
  const subdomain = useMemo(
    () => deriveIframeSubdomain('nsite', getNsiteSubdomain(event)),
    [event],
  );

  // Everything, straight away. The frame is booting a Service Worker on a cold
  // origin meanwhile, and none of these fetches needed to wait for that.
  useEffect(() => prefetchSite(manifest.paths, servers), [manifest, servers]);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(subdomain), SPINNER_DELAY);
    return () => clearTimeout(timer);
  }, [subdomain]);

  const resolveFile = useCallback(
    async (pathname: string): Promise<FileResponse | null> => {
      let servingPath = pathname;
      let sha256 = paths.get(pathname);

      // A path the manifest doesn't list falls back to the entry page, so a
      // site's client-side routes resolve — the bargain every static host
      // makes. Only for paths that could be routes, though: answering a
      // missing stylesheet with a page of HTML gets it parsed as CSS.
      if (!sha256 && !extensionOf(pathname)) {
        servingPath = '/index.html';
        sha256 = paths.get(servingPath);
      }
      if (!sha256) return null;

      const bytes = await loadBlob(sha256, extensionOf(servingPath), servers);
      if (!bytes) return null;

      // The page is on its way to the frame, which will start painting it and
      // asking for the rest. Watching that happen beats watching a spinner
      // until it finishes, so the veil comes off here rather than at load.
      if (isPagePath(servingPath)) setServed(subdomain);

      return {
        status: 200,
        // The manifest path decides the type. Blossom is content-addressed and
        // routinely reports the wrong one, which browsers refuse to execute.
        contentType: mimeForPath(servingPath),
        body: new Uint8Array(bytes),
      };
    },
    [paths, servers, subdomain],
  );

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <SandboxFrame
        key={subdomain}
        id={subdomain}
        resolveFile={resolveFile}
        injectedScripts={[PATH_FIXUP]}
        className="size-full border-0"
        title={title}
      />

      {served !== subdomain && (
        // Opaque, because the sandbox shell underneath is a blank white page
        // and this app may be in dark mode. The spinner arrives later than the
        // veil does: a site that opens quickly should look like it opened, not
        // like it was loading.
        <div className="absolute inset-0 bg-background">
          {waited === subdomain && <Spinner className="size-full" />}
        </div>
      )}
    </div>
  );
}
