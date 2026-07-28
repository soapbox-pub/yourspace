import { useState } from 'react';

import { NsiteCard } from '@/components/NsiteCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowPack } from '@/hooks/useFollowPack';
import { useFollows } from '@/hooks/useFollows';
import { useNsiteFeed } from '@/hooks/useNsiteFeed';

function FeedSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="overflow-hidden p-0">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-2 p-5">
            <Skeleton className="-mt-11 mb-3 size-12 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="px-8 py-12 text-center">
        <p className="mx-auto max-w-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

function Feed({
  authors,
  isPending,
  empty,
}: {
  authors: string[] | undefined;
  isPending: boolean;
  empty: React.ReactNode;
}) {
  const feed = useNsiteFeed(authors);

  if (isPending || (feed.isPending && !!authors?.length)) return <FeedSkeleton />;
  if (!feed.data?.length) return <Empty>{empty}</Empty>;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {feed.data.map((event) => (
        <NsiteCard key={event.id} event={event} />
      ))}
    </div>
  );
}

/**
 * Homepages people have published, as two answers to "whose?".
 *
 * Discover is a curated follow pack, which keeps the front page populated for
 * someone who has just arrived and follows nobody. Follows is the better feed
 * once it has anything in it, so it wins by default — but only then, since an
 * empty tab is a worse first impression than a curated one.
 */
export function NsiteShowcase() {
  const { config } = useAppContext();
  const { user } = useCurrentUser();

  const pack = useFollowPack(config.discoverPackNaddr);
  const follows = useFollows();

  const hasFollows = !!follows.data?.length;
  const [tab, setTab] = useState<string | undefined>();

  // Undefined until the contact list lands, so the default can depend on it
  // without the tab jumping under someone who has already made a choice.
  const active = tab ?? (user && hasFollows ? 'follows' : 'discover');

  return (
    <Tabs value={active} onValueChange={setTab}>
      <TabsList className="mb-8">
        <TabsTrigger value="discover">Discover</TabsTrigger>
        <TabsTrigger value="follows" disabled={!user}>
          Follows
        </TabsTrigger>
      </TabsList>

      <TabsContent value="discover">
        <Feed
          authors={pack.data?.pubkeys}
          isPending={pack.isPending}
          empty="Nobody in this pack has published a homepage to these relays yet."
        />
      </TabsContent>

      <TabsContent value="follows">
        <Feed
          authors={follows.data}
          isPending={follows.isPending && !!user}
          empty={
            hasFollows
              ? 'Nobody you follow has published a homepage yet.'
              : 'Follow some people and their homepages will show up here.'
          }
        />
      </TabsContent>
    </Tabs>
  );
}
