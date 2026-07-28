import type { NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05 } from '@/hooks/useNip05';
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

/** Only https images are worth trying, and never one from an event's tags. */
function safeImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

export function NsiteCard({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;

  // A claimed NIP-05 only becomes a URL once it points back at this pubkey;
  // until then the link is the npub, which nobody else can claim.
  const nip05 = useNip05(metadata?.nip05);
  const verified = !!metadata?.nip05 && nip05.data === event.pubkey;

  const tag = (name: string) => event.tags.find(([n]) => n === name)?.[1];

  const name = metadata?.name ?? `${nip19.npubEncode(event.pubkey).slice(0, 12)}…`;
  const title = tag('title') || `${name}’s homepage`;
  const description = tag('description') || metadata?.about;
  const banner = safeImage(metadata?.banner);
  const files = event.tags.filter(([n]) => n === 'path').length;

  return (
    <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg">
      <Link
        to={getProfileUrl(event.pubkey, metadata, verified)}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative h-28 overflow-hidden bg-linear-to-br from-violet-500 via-indigo-500 to-cyan-500">
          {banner && (
            <img
              src={banner}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
            />
          )}
        </div>

        <div className="p-5">
          {/* Pulled up so the avatar straddles the banner edge. */}
          <Avatar className="-mt-11 mb-3 size-12 border-2 border-card shadow-sm">
            <AvatarImage src={safeImage(metadata?.picture)} alt="" />
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>

          <h3 className="truncate font-semibold">{title}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {verified ? metadata!.nip05 : name}
          </p>

          {description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            {files} {files === 1 ? 'file' : 'files'} · {since(event.created_at)}
          </p>
        </div>
      </Link>
    </Card>
  );
}
