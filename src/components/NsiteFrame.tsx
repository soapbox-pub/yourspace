import type { NostrEvent } from '@nostrify/nostrify';
import { useCallback, useMemo } from 'react';

import { SandboxFrame } from '@/components/SandboxFrame';
import { useAppContext } from '@/hooks/useAppContext';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { deriveIframeSubdomain } from '@/lib/iframeSubdomain';
import { extensionOf, mimeForPath } from '@/lib/nsite/files';
import { blobServers, fetchBlob } from '@/lib/nsite/blobs';
import { parseManifest, type NsiteRef } from '@/lib/nsite/manifest';
import { getNsiteSubdomain } from '@/lib/nsite/subdomain';
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

/**
 * Renders a published nsite.
 *
 * Files are pulled from Blossom on demand rather than downloaded up front, so
 * a large site starts painting as soon as its entry page arrives. Everything
 * runs inside `SandboxFrame` on an origin of its own — the site's scripts are
 * the author's, not ours, and this app's localStorage holds nsec.
 */
export function NsiteFrame({ event, siteRef, title, className }: NsiteFrameProps) {
  const { config } = useAppContext();

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

      const bytes = await fetchBlob(sha256, extensionOf(servingPath), servers);
      if (!bytes) return null;

      return {
        status: 200,
        // The manifest path decides the type. Blossom is content-addressed and
        // routinely reports the wrong one, which browsers refuse to execute.
        contentType: mimeForPath(servingPath),
        body: new Uint8Array(bytes),
      };
    },
    [paths, servers],
  );

  return (
    <SandboxFrame
      key={subdomain}
      id={subdomain}
      resolveFile={resolveFile}
      injectedScripts={[PATH_FIXUP]}
      className={className}
      title={title}
    />
  );
}
