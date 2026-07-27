import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Logo } from '@/components/Logo';

/** Chrome around the editor: the YourSpace mark, a way home, and the account menu. */
export function EditorShell({ children }: { children: ReactNode }) {
  return (
    // h-screen (not min-h-screen) gives the column a definite height, so the
    // editor below can size itself with percentages and flex-1.
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="z-30 shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo className="text-lg" />
          </Link>

          <LoginArea className="max-w-60" />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
