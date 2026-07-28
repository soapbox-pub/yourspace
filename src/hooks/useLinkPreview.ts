import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAppContext } from '@/hooks/useAppContext';
import { sanitizeUrl, templateUrl } from '@/lib/urlTemplate';

/**
 * The OEmbed subset the preview endpoint returns. Everything is optional
 * because it is scraped from whatever the page happened to declare — most
 * hand-written homepages have a `<title>` and nothing else.
 */
const OEmbedSchema = z.object({
  type: z.enum(['link', 'photo', 'video', 'rich']).optional(),
  title: z.string().optional(),
  author_name: z.string().optional(),
  provider_name: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

export interface LinkPreview {
  title?: string;
  authorName?: string;
  /** Absolute https, resolved against the previewed page. */
  image?: string;
}

/**
 * Fetch a preview for a page.
 *
 * The endpoint fetches and parses the page server-side, which is the only way
 * to do this from a browser — the gateway sends no CORS headers, so the app
 * can't read the HTML itself.
 */
export function useLinkPreview(url: string | undefined) {
  const { config } = useAppContext();

  return useQuery({
    queryKey: ['link-preview', url, config.linkPreviewUrl],
    queryFn: async ({ signal }): Promise<LinkPreview | null> => {
      const response = await fetch(templateUrl(config.linkPreviewUrl, url!), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const parsed = OEmbedSchema.safeParse(await response.json());
      if (!parsed.success) return null;

      const { title, author_name, thumbnail_url } = parsed.data;

      return {
        title,
        authorName: author_name,
        // A scraped `og:image` is frequently a site-relative path, and always
        // third-party data — resolve it, then insist on https.
        image: sanitizeUrl(thumbnail_url, url),
      };
    },
    enabled: !!url,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
