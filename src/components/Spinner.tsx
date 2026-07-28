import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The wait for something whose shape isn't known yet.
 *
 * A skeleton is the better loading state when the result has a layout worth
 * suggesting — a feed of cards, a profile. A site is the opposite case: it
 * could be anything, and drawing bars where its text might go promises a page
 * that never arrives. This says only that something is happening.
 *
 * Sized to fill whatever it's given, so callers position it and nothing else.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex items-center justify-center', className)}
    >
      <Loader2
        className="size-12 text-muted-foreground/60 motion-safe:animate-spin"
        aria-hidden="true"
      />
    </div>
  );
}

export default Spinner;
