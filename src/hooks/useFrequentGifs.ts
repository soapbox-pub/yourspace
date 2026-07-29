import { useCallback, useMemo } from 'react';

import { useAppContext } from '@/hooks/useAppContext';
import { gifUrl, isGifChecksum, type GifCitiesGif } from '@/lib/gifcities';

/**
 * How many are remembered — comfortably more than any shelf shows, so that a
 * GIF used twice a month ago still outranks one used once today after the
 * shelf has moved on.
 */
const REMEMBERED = 24;

/**
 * The GIFs this browser has placed most often, and a way to record another.
 *
 * Kept in the app config rather than with the site, because it describes the
 * person rather than the page: the same handful of animations tends to follow
 * someone across every site they make.
 *
 * Stored as digests and re-expanded here. Nothing that arrives from storage
 * reaches the canvas as a URL — an unrecognisable digest is simply dropped.
 */
export function useFrequentGifs() {
  const { config, updateConfig } = useAppContext();
  const { frequentGifs } = config;

  const gifs = useMemo<GifCitiesGif[]>(
    () =>
      frequentGifs
        .filter((gif) => isGifChecksum(gif.checksum))
        .map(({ checksum, text, width, height }) => ({
          checksum,
          text,
          width,
          height,
          url: gifUrl(checksum),
        })),
    [frequentGifs],
  );

  const remember = useCallback(
    (gif: GifCitiesGif) => {
      updateConfig((current) => {
        const kept = current.frequentGifs ?? [];
        const seen = kept.find((entry) => entry.checksum === gif.checksum);

        const bumped = {
          checksum: gif.checksum,
          text: gif.text,
          width: gif.width,
          height: gif.height,
          uses: (seen?.uses ?? 0) + 1,
        };

        return {
          ...current,
          // The bumped one leads, and `sort` is stable, so ties are broken by
          // how recently they were used.
          frequentGifs: [bumped, ...kept.filter((entry) => entry.checksum !== gif.checksum)]
            .sort((a, b) => b.uses - a.uses)
            .slice(0, REMEMBERED),
        };
      });
    },
    [updateConfig],
  );

  return { gifs, remember };
}
