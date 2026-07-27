import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { builderDemos } from '@/lib/nsiteDemo';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BuilderShellProps {
  /** Matches a `slug` in `builderDemos`. */
  slug: (typeof builderDemos)[number]['slug'];
  docsUrl: string;
  children: ReactNode;
}

/**
 * Chrome shared by every builder demo: a switcher across the three editors plus
 * a header naming the package under test.
 */
export function BuilderShell({ slug, docsUrl, children }: BuilderShellProps) {
  const { pathname } = useLocation();
  const demo = builderDemos.find((d) => d.slug === slug);

  if (!demo) throw new Error(`Unknown builder demo: ${slug}`);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All builders
          </Link>

          <nav aria-label="Builder demos" className="flex items-center gap-1">
            {builderDemos.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.slug}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="font-mono text-xs">
              {demo.pkg}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {demo.license}
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
