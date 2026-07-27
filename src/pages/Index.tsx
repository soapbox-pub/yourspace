import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

const Index = () => {
  useSeoMeta({
    title: 'A WYSIWYG builder for Nostr nsites',
    description:
      'Build a personal Nostr homepage in the browser with GrapesJS, and export it as plain HTML and CSS.',
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Badge variant="secondary" className="mb-4">
          GrapesJS · BSD-3-Clause
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          A WYSIWYG builder for Nostr nsites
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Assemble a personal Nostr homepage from ready-made blocks, import an existing nsite to
          edit, and read back real HTML and CSS. The editor is GrapesJS with every stock panel
          replaced by React, so selecting an element shows its settings immediately. Nothing
          publishes or saves; state lives in memory.
        </p>

        <Link
          to="/builders/grapesjs-studio"
          className="group mt-10 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Open the builder
          <ArrowRight
            className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </div>
  );
};

export default Index;
