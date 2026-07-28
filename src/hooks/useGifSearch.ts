import { useQuery } from '@tanstack/react-query';

import { searchGifs } from '@/lib/gifcities';

/**
 * GifCities results for `query`, or nothing at all for an empty one.
 *
 * Cached without expiry: GeoCities has been closed since 2009, so a query's
 * answer is the same every time it is asked, and the answers are large enough
 * that asking twice is worth avoiding. Callers should debounce, since a
 * response runs to megabytes and a keystroke is not a search.
 */
export function useGifSearch(query: string) {
  return useQuery({
    queryKey: ['gifcities', query],
    queryFn: ({ signal }) => searchGifs(query, signal),
    enabled: query.length > 0,
    staleTime: Infinity,
    retry: false,
  });
}
