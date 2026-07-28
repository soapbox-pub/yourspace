import { Link, useLocation, useMatch } from 'react-router-dom';
import { PenLine } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Logo } from '@/components/Logo';
import { TopBarProfile } from '@/components/TopBarProfile';
import { Button } from '@/components/ui/button';

/** Routes that own a single path segment but aren't somebody's page. */
const RESERVED = new Set(['edit']);

/**
 * The one piece of chrome that is always on screen.
 *
 * Most of what this app shows is somebody else's website, rendered edge to
 * edge in a frame that owns its own scrolling. Without a strip that belongs
 * unambiguously to YourSpace there would be no way back out — the visitor
 * would be looking at a stranger's page with no visible sign of whose app
 * they were in. So it stays put on every route, signed in or not, the way a
 * WordPress admin bar does.
 */
export function TopBar() {
  const { pathname } = useLocation();
  const onEditor = pathname === '/edit';

  // `useMatch` reads the location directly, so this works even though the bar
  // sits outside `<Routes>` and has no route params of its own.
  const match = useMatch('/:user');
  const param = match?.params.user;
  const viewing = param && !RESERVED.has(param) ? param : undefined;

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--ys-bar)] border-b border-white/10 bg-slate-950 text-white">
      {/* Full-bleed rather than matching the page's content width: what sits
          below is often a framed site with its own layout, and a bar that
          stopped short of the edges would read as part of it. */}
      <div className="relative flex h-full items-center gap-2 px-3 sm:px-4">
        {/* The mark doubles as the way out of whatever is framed below. */}
        <Link
          to="/"
          className="z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="YourSpace home"
        >
          <Logo className="text-sm" />
        </Link>

        <div className="flex-1" />

        {/*
          Absolutely positioned so it is centred on the bar itself rather than
          in the gap between the mark and the account menu, which are different
          widths. Hidden on small screens, where there is no gap to centre in.
        */}
        {viewing && (
          <div className="pointer-events-none absolute inset-x-0 hidden justify-center sm:flex">
            <div className="max-w-[40%]">
              <TopBarProfile param={viewing} />
            </div>
          </div>
        )}

        {!onEditor && (
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="z-10 h-7 gap-1.5 px-2.5 text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/edit">
              <PenLine className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Editor</span>
            </Link>
          </Button>
        )}

        <LoginArea compact className="z-10 max-w-40" />
      </div>
    </header>
  );
}
