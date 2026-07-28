import type { NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { ExternalLink } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useAppContext } from '@/hooks/useAppContext';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05 } from '@/hooks/useNip05';
import { useScreenshot } from '@/hooks/useScreenshot';
import { nsiteGatewayUrl } from '@/lib/nsite/subdomain';
import { sanitizeUrl } from '@/lib/urlTemplate';
import { getProfileUrl } from '@/lib/userParam';

/**
 * A colour for the backdrop, taken from the pubkey.
 *
 * It sits behind every thumbnail, so it is what a card shows while the
 * screenshot loads and what it keeps if the screenshot never arrives.
 * Deriving the hue from the key rather than picking one gives the grid some
 * variety, and gives each site a constant identity across reloads.
 */
function placeholderStyle(pubkey: string): React.CSSProperties {
  const hue = parseInt(pubkey.slice(0, 8), 16) % 360;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 55) % 360} 65% 35%))`,
  };
}

export function NsiteCard({ event }: { event: NostrEvent }) {
  const { config } = useAppContext();

  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;

  // The site gets a real URL only so the screenshot service has something to
  // fetch; visitors are sent to the in-app viewer.
  const gatewayUrl = nsiteGatewayUrl(event, config.nsiteGatewayDomain);
  const screenshot = useScreenshot(gatewayUrl);

  // A claimed NIP-05 only becomes a URL once it points back at this pubkey.
  const nip05 = useNip05(metadata?.nip05);
  const verified = !!metadata?.nip05 && nip05.data === event.pubkey;

  const name = metadata?.name ?? `${nip19.npubEncode(event.pubkey).slice(0, 12)}…`;
  const handle = verified ? metadata!.nip05!.replace(/^_@/, '') : name;

  const title = event.tags.find(([n]) => n === 'title')?.[1] || `${name}’s homepage`;
  const href = getProfileUrl(event.pubkey, metadata, verified);

  return (
    <Card className="group relative overflow-hidden p-0 transition-shadow hover:shadow-lg">
      <div
        // 3:2, the shape a screenshot arrives in, so none of it is cropped.
        className="relative flex aspect-[3/2] items-center justify-center"
        style={placeholderStyle(event.pubkey)}
      >
        {/* Named rather than blank, for as long as there is no screenshot. */}
        <span
          aria-hidden="true"
          className="line-clamp-3 px-6 text-center text-xl font-bold text-white drop-shadow-sm"
        >
          {title}
        </span>

        {screenshot && (
          // Already decoded by the time it gets here, so it fades in from
          // cache rather than popping in whenever the network gets to it.
          <img
            src={screenshot}
            alt=""
            className="absolute inset-0 size-full object-cover object-top motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 transition-transform motion-safe:group-hover:scale-105"
          />
        )}

        {/* Whose site it is, legible over whatever the page happens to look
            like there — hence the scrim rather than plain text. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pb-3 pt-10">
          <Avatar className="size-7 shrink-0 ring-1 ring-white/30">
            <AvatarImage src={sanitizeUrl(metadata?.picture)} alt="" />
            <AvatarFallback className="text-xs">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium text-white drop-shadow-sm">
            {handle}
          </span>
        </div>
      </div>

      {/* The card is one big link. Stretching it rather than wrapping the
          contents leaves room for a second, independent link on top. */}
      <Link
        to={href}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="sr-only">{title}</span>
      </Link>

      {/* Above the stretched link, or it would never be clickable. Shown on
          hover so that the resting card is only ever the site itself. */}
      <a
        href={gatewayUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="absolute right-2 top-2 z-20 rounded-md bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100"
      >
        <ExternalLink className="size-4" aria-hidden="true" />
        <span className="sr-only">Open {title} on the public gateway</span>
      </a>
    </Card>
  );
}
