import { Heart, MessageCircle, Repeat2, Zap } from 'lucide-react';

import { demoNotes, formatSats } from '@/lib/nsiteDemo';

/**
 * Presentational blocks for the demo nsite homepage.
 *
 * These are deliberately plain — styling lives here rather than in any editor's
 * config, so Puck and Tiptap render visually identical output and the
 * comparison is about the editing experience, not the theme.
 */

export function HeroBlock({
  name,
  tagline,
  nip05,
  avatar,
  banner,
}: {
  name: string;
  tagline: string;
  nip05: string;
  avatar: string;
  banner: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-card">
      <div
        className="h-32 w-full bg-gradient-to-br from-purple-500 via-indigo-500 to-sky-400 bg-cover bg-center sm:h-44"
        style={banner ? { backgroundImage: `url(${encodeURI(banner)})` } : undefined}
        role="presentation"
      />
      <div className="px-6 pb-6">
        <img
          src={avatar}
          alt=""
          className="-mt-10 size-20 rounded-full border-4 border-card bg-muted object-cover sm:size-24"
        />
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
        {nip05 && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            <span aria-hidden="true">&#10003; </span>
            {nip05}
          </p>
        )}
        {tagline && <p className="mt-3 text-lg text-muted-foreground">{tagline}</p>}
      </div>
    </section>
  );
}

export function AboutBlock({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

export function LinksBlock({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; url: string }[];
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {(links ?? []).map((link, i) => (
          <li key={`${link.url}-${i}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-base font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
              <span aria-hidden="true" className="text-muted-foreground">
                &rarr;
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotesBlock({ heading, count }: { heading: string; count: number }) {
  const notes = demoNotes.slice(0, Math.max(0, Math.min(count ?? 3, demoNotes.length)));

  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-4 space-y-3">
        {notes.map((note, i) => (
          <article key={i} className="rounded-lg border p-4">
            <p className="text-base leading-relaxed">{note.content}</p>
            <div className="mt-3 flex items-center gap-5 text-sm text-muted-foreground">
              <span>{note.timeAgo}</span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-4" aria-hidden="true" />
                {note.replies}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Repeat2 className="size-4" aria-hidden="true" />
                {note.reposts}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-4" aria-hidden="true" />
                {formatSats(note.zaps)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ZapBlock({
  heading,
  lightningAddress,
}: {
  heading: string;
  lightningAddress: string;
}) {
  return (
    <section className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-100 p-6 dark:from-amber-950/40 dark:to-orange-950/30">
      <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Zap className="size-6 text-amber-500" aria-hidden="true" />
        {heading}
      </h2>
      <p className="mt-2 text-lg text-muted-foreground">
        Send sats to{' '}
        <span className="font-mono font-medium text-foreground">{lightningAddress}</span>
      </p>
    </section>
  );
}

export function FooterBlock({ npub }: { npub: string }) {
  return (
    <footer className="rounded-xl border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">Verify this page against my key</p>
      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{npub}</p>
      <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        Published on Nostr <Heart className="size-3.5 text-pink-500" aria-hidden="true" /> Blossom
      </p>
    </footer>
  );
}
