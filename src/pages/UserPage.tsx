import { useSeoMeta } from '@unhead/react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

import { NsiteFrame } from '@/components/NsiteFrame';
import { Spinner } from '@/components/Spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip05 } from '@/hooks/useNip05';
import { useNsite } from '@/hooks/useNsite';
import { ROOT_SITE_KIND, type NsiteRef } from '@/lib/nsite/manifest';
import { tryParseUserParam } from '@/lib/userParam';
import NotFound from './NotFound';

/** A page filling everything below the bar, for the states that aren't a site. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ys-below-bar overflow-y-auto px-safe-or-6 pt-16 pb-safe-offset-16">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

export function UserPage() {
  const { user = '' } = useParams<{ user: string }>();

  const parsed = useMemo(() => tryParseUserParam(user), [user]);

  // Only a NIP-05 needs the network before we know whose page this is.
  const nip05 = useNip05(parsed?.kind === 'nip05' ? parsed.identifier : undefined);

  const pubkey = parsed?.kind === 'ref' ? parsed.ref.pubkey : nip05.data ?? undefined;

  const siteRef: NsiteRef | undefined = useMemo(() => {
    if (parsed?.kind === 'ref') return parsed.ref;
    return pubkey ? { kind: ROOT_SITE_KIND, pubkey } : undefined;
  }, [parsed, pubkey]);

  const nsite = useNsite(siteRef);
  const author = useAuthor(pubkey);

  const displayName =
    author.data?.metadata?.name ??
    (pubkey ? `${nip19.npubEncode(pubkey).slice(0, 12)}…` : user);

  const title = nsite.data?.tags.find(([name]) => name === 'title')?.[1];

  useSeoMeta({
    title: title ? `${title} — YourSpace` : `${displayName} — YourSpace`,
    description: nsite.data?.tags.find(([name]) => name === 'description')?.[1],
  });

  // Nothing that names a page — an nsec, a note id, a typo.
  if (!parsed) return <NotFound />;

  // Both of these are waits for a site to appear, so they look like the one
  // the frame shows rather than like a document that isn't coming.
  if (nip05.isPending && parsed.kind === 'nip05') {
    return <Spinner className="ys-below-bar" />;
  }

  if (parsed.kind === 'nip05' && !pubkey) {
    return (
      <Shell>
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <h1 className="mb-2 text-xl font-semibold">Nobody at that address</h1>
            <p className="text-muted-foreground">
              <span className="font-mono">{user}</span> doesn’t resolve to a Nostr key.
              The domain may not publish a NIP-05 record for that name.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (nsite.isPending) {
    return <Spinner className="ys-below-bar" />;
  }

  if (!nsite.data) {
    return (
      <Shell>
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <h1 className="mb-2 text-xl font-semibold">No page here yet</h1>
            <p className="mb-6 text-muted-foreground">
              {displayName} hasn’t published a homepage, or it isn’t on the relays
              this app is reading from.
            </p>
            <Button asChild>
              <Link to="/edit">Build yours</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // The site gets everything the bar doesn't. It scrolls itself, so the page
  // around it must not also scroll — hence a fixed height rather than min-h.
  //
  // Deliberately no safe-area padding: this is somebody's whole website, and
  // insetting it would frame it in a strip of app background. Running under
  // the home indicator is what it does at its own URL too.
  return (
    <div className="ys-below-bar">
      <NsiteFrame
        event={nsite.data}
        siteRef={siteRef!}
        title={title ?? `${displayName}’s homepage`}
        className="h-full w-full border-0"
      />
    </div>
  );
}

export default UserPage;
