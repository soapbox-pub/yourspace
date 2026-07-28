import type { NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { ExternalLink } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useAppContext } from '@/hooks/useAppContext';
import { useAuthor } from '@/hooks/useAuthor';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { useNip05 } from '@/hooks/useNip05';
import { useScreenshot } from '@/hooks/useScreenshot';
import { nsiteGatewayUrl } from '@/lib/nsite/subdomain';
import { sanitizeUrl } from '@/lib/urlTemplate';
import { getProfileUrl } from '@/lib/userParam';

/** How long ago, at the coarseness a showcase needs. */
function since(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
}

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

  // The site gets a real URL only so the preview and screenshot services have
  // something to fetch; visitors are sent to the in-app viewer.
  const gatewayUrl = nsiteGatewayUrl(event, config.nsiteGatewayDomain);
  const preview = useLinkPreview(gatewayUrl);

  // Hardly any nsite declares an `og:image`, so scraping one leaves most of
  // the grid blank. A screenshot is something every site has.
  const screenshot = useScreenshot(gatewayUrl);

  // A claimed NIP-05 only becomes a URL once it points back at this pubkey.
  const nip05 = useNip05(metadata?.nip05);
  const verified = !!metadata?.nip05 && nip05.data === event.pubkey;

  const name = metadata?.name ?? `${nip19.npubEncode(event.pubkey).slice(0, 12)}…`;
  const handle = verified ? metadata!.nip05!.replace(/^_@/, '') : name;

  // The page's own <title> is what a visitor would see in a tab, so it beats
  // the manifest's title tag; both beat a generated fallback.
  const title =
    preview.data?.title ||
    event.tags.find(([n]) => n === 'title')?.[1] ||
    `${name}’s homepage`;

  const description =
    event.tags.find(([n]) => n === 'description')?.[1] || metadata?.about;

  const files = event.tags.filter(([n]) => n === 'path').length;
  const href = getProfileUrl(event.pubkey, metadata, verified);

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-lg">
      <Link
        to={href}
        className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="relative flex h-40 items-center justify-center overflow-hidden"
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
              // Anchored to the top: a screenshot is 3:2 and this frame is
              // wider, so cropping from the centre would cut off the header.
              className="absolute inset-0 size-full object-cover object-top motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 transition-transform motion-safe:group-hover:scale-105"
            />
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="truncate font-semibold">{title}</h3>

          {description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          )}

          {/* Authorship. The preview says what the site is; this says whose. */}
          <div className="mt-4 flex items-center gap-2 border-t pt-4">
            <Avatar className="size-7">
              <AvatarImage src={sanitizeUrl(metadata?.picture)} alt="" />
              <AvatarFallback className="text-xs">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{handle}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {since(event.created_at)}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between px-5 pb-4 text-xs text-muted-foreground">
        <span>
          {files} {files === 1 ? 'file' : 'files'}
        </span>
        <a
          href={gatewayUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          Open
          <span className="sr-only"> {title} on the public gateway</span>
        </a>
      </div>
    </Card>
  );
}
