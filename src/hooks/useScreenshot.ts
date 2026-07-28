import { useEffect, useMemo, useState } from 'react';

import { useAppContext } from '@/hooks/useAppContext';
import { sanitizeUrl, templateUrl } from '@/lib/urlTemplate';

/**
 * The size the configured template must ask for.
 *
 * This is not decoration. The service answers `200` whether or not it has
 * rendered the page yet — a placeholder while it works, the screenshot once
 * it is done — so the response status says nothing. Its size is the only
 * thing that distinguishes the two, which means the app has to know what a
 * finished shot measures.
 */
const WIDTH = 600;
const HEIGHT = 400;

/** How long to keep asking. A cold render usually lands inside this. */
const DELAYS = [3000, 5000, 8000, 12000];

/**
 * A screenshot of a page, once one actually exists.
 *
 * Returns `undefined` until then, and stays `undefined` if the service never
 * produces one — callers should have something to show in the meantime.
 */
export function useScreenshot(pageUrl: string | undefined): string | undefined {
  const { config } = useAppContext();
  const { screenshotUrl } = config;

  const src = useMemo(() => {
    if (!pageUrl) return undefined;
    try {
      return sanitizeUrl(templateUrl(screenshotUrl, pageUrl));
    } catch {
      // A `d` tag can name a subdomain that isn't a URL. Nothing to shoot.
      return undefined;
    }
  }, [screenshotUrl, pageUrl]);

  // Tagged with the page it was taken of, so that pointing the hook at a new
  // one discards the old shot without having to reset anything.
  const [shot, setShot] = useState<{ of: string; url: string }>();

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;

    const probe = () => {
      // Every attempt after the first needs a URL the browser has not already
      // cached, or it will hand back the placeholder it stored last time.
      const candidate = attempt === 0
        ? src
        : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;

      const img = new Image();

      img.onload = () => {
        if (cancelled) return;

        if (img.naturalWidth === WIDTH && img.naturalHeight === HEIGHT) {
          // Decoded here, so the <img> that renders it comes from cache.
          setShot({ of: src, url: candidate });
        } else {
          retry();
        }
      };

      img.onerror = () => {
        if (!cancelled) retry();
      };

      img.src = candidate;
    };

    const retry = () => {
      const delay = DELAYS[attempt];
      attempt += 1;
      // Out of patience. Leave it unset and let the caller show its own.
      if (delay === undefined) return;
      timer = setTimeout(probe, delay);
    };

    probe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [src]);

  return shot && shot.of === src ? shot.url : undefined;
}
