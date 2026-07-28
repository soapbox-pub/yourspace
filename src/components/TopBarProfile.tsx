import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05 } from '@/hooks/useNip05';
import { parseUserParam } from '@/lib/userParam';
import { sanitizeUrl } from '@/lib/urlTemplate';

/**
 * Whose page you are looking at.
 *
 * The site below fills the screen and is under its author's control, including
 * whatever it claims about who made it. This is the one attribution on screen
 * that the page can't influence, so it resolves the identity independently
 * from the URL rather than from anything the site says.
 */
export function TopBarProfile({ param }: { param: string }) {
  const parsed = useMemo(() => parseUserParam(param), [param]);

  const nip05 = useNip05(parsed?.kind === 'nip05' ? parsed.identifier : undefined);

  const pubkey =
    parsed?.kind === 'pubkey'
      ? parsed.pubkey
      : parsed?.kind === 'site'
        ? parsed.ref.pubkey
        : nip05.data ?? undefined;

  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  if (!parsed) return null;

  if (!pubkey || author.isPending) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full bg-white/15" />
        <Skeleton className="h-3.5 w-24 bg-white/15" />
      </div>
    );
  }

  const name = metadata?.name ?? `${nip19.npubEncode(pubkey).slice(0, 12)}…`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={sanitizeUrl(metadata?.picture)} alt="" />
        <AvatarFallback className="bg-white/15 text-[10px] text-white">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{name}</span>
    </div>
  );
}
