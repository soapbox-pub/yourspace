import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

/** The ghost mark and the YourSpace wordmark. Mirrors `public/favicon.svg`. */
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img src="/icon.svg" alt="" className="size-8 shrink-0" />
      <span className="font-display text-xl font-black italic tracking-tight">yourspace</span>
    </span>
  );
}
