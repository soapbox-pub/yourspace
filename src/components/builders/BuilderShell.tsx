import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

interface BuilderShellProps {
  name: string;
  pkg: string;
  license: string;
  docsUrl: string;
  children: ReactNode;
}

/** Chrome around the builder: a way back home and a header naming the package under it. */
export function BuilderShell({ name, pkg, license, docsUrl, children }: BuilderShellProps) {
  return (
    // h-screen (not min-h-screen) gives the column a definite height, so the
    // editor below can size itself with percentages and flex-1.
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="z-30 shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>

          <h1 className="text-sm font-semibold">{name}</h1>

          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="font-mono text-xs">
              {pkg}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {license}
            </Badge>
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Docs
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
