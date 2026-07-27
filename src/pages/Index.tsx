import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { builderDemos } from '@/lib/nsiteDemo';

const Index = () => {
  useSeoMeta({
    title: 'WYSIWYG builders for Nostr nsites',
    description:
      'Side-by-side demos of open source visual page builders, evaluated for building and publishing Nostr homepages.',
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <header className="max-w-3xl">
          <Badge variant="secondary" className="mb-4">
            Evaluation
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Picking a WYSIWYG builder for Nostr nsites
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Each demo builds the same thing — a personal Nostr homepage — using a different open
            source editor, so the comparison is about the editing experience rather than the theme.
            Nothing publishes or saves; state lives in memory.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builderDemos.map((demo) => (
            <Card key={demo.slug} className="group transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-2xl">{demo.name}</CardTitle>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {demo.license}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{demo.tagline}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-base leading-relaxed text-muted-foreground">{demo.summary}</p>
                <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {demo.pkg}
                </code>
                <Link
                  to={demo.path}
                  className="inline-flex items-center gap-2 text-base font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Open demo
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mt-16 rounded-xl border border-dashed p-6">
          <h2 className="text-xl font-semibold">Not demoed here</h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            The source article also covers <strong>Storyblok</strong> and <strong>Builder.io</strong>
            , and <strong>WebStudio</strong> was requested as a sixth. None can be embedded in this
            app: the Storyblok and Builder.io npm packages only render content, with the editors
            themselves running as proprietary hosted services, and WebStudio&rsquo;s builder is a
            standalone AGPL application rather than a library. Judging their look and feel means
            using their own sites.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Index;
