import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /**
   * Paints the wordmark in the brand gradient instead of `currentColor`. Only
   * legible on the dark aurora — the gradient stops are all light.
   */
  onAurora?: boolean;
}

/** The sparkle mark and the YourSpace wordmark. Mirrors `public/favicon.svg`. */
export function Logo({ className, onAurora }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-bold', className)}>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-cyan-500">
        <Sparkles className="size-5 text-white" aria-hidden="true" />
      </span>
      <span className={cn(onAurora && 'ys-wordmark')}>YourSpace</span>
    </span>
  );
}
