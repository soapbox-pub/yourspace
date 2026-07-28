import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Code2,
  Globe,
  Heart,
  Layout,
  MousePointerClick,
  Music,
  Radio,
  Shield,
  Sparkles,
  Star,
  Wand2,
  Zap,
} from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Logo } from '@/components/Logo';
import { NsiteShowcase } from '@/components/NsiteShowcase';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/** The six drifting dots scattered behind the hero card. */
const SPARKS = [
  { className: 'top-1/4 left-1/4 size-1.5 bg-violet-400/40', delay: '0s' },
  { className: 'top-1/3 right-1/3 size-1 bg-blue-400/50', delay: '2s' },
  { className: 'bottom-1/3 left-1/2 size-2 bg-indigo-400/30', delay: '1s' },
  { className: 'top-1/2 right-1/4 size-1 bg-violet-300/60', delay: '3s' },
  { className: 'bottom-1/4 right-1/2 size-1.5 bg-blue-300/40', delay: '1.5s' },
  { className: 'top-3/4 left-1/3 size-1 bg-cyan-300/50', delay: '0.5s' },
];

const FEATURES = [
  {
    icon: Globe,
    medallion: 'from-violet-500 to-purple-600',
    rule: 'from-violet-400 to-purple-400',
    title: 'A page that is actually yours',
    body: 'Your homepage lives under your own keypair, not on someone else’s platform. Nobody can suspend it, rank it, or wrap it in ads.',
    points: [
      { icon: Star, className: 'text-yellow-400', text: 'You own the identity — no corporation in the middle' },
      { icon: Shield, className: 'text-emerald-400', text: 'Nothing to take down, because there is nothing to take it down from' },
      { icon: Heart, className: 'text-rose-400', text: 'No ads, no tracking, no algorithm deciding who sees it' },
    ],
  },
  {
    icon: Layout,
    medallion: 'from-cyan-500 to-blue-600',
    rule: 'from-cyan-400 to-blue-400',
    title: 'Drag, drop, done',
    body: 'Build the page the way you want it from ready-made blocks. Click anything to restyle it. No HTML knowledge required.',
    points: [
      { icon: MousePointerClick, className: 'text-cyan-400', text: 'Visual editing on a live page, not a form' },
      { icon: Music, className: 'text-violet-400', text: 'Profile headers, link lists, note feeds, galleries' },
      { icon: Zap, className: 'text-yellow-400', text: 'Lightning zaps wired straight into the page' },
    ],
  },
  {
    icon: Radio,
    medallion: 'from-amber-500 to-orange-600',
    rule: 'from-amber-400 to-orange-400',
    title: 'Real HTML, published to Nostr',
    body: 'What you build is an nsite — ordinary HTML and CSS, addressed by your pubkey and served from anywhere that speaks the protocol.',
    points: [
      { icon: Code2, className: 'text-orange-400', text: 'Plain HTML and CSS you can read and take with you' },
      { icon: Sparkles, className: 'text-cyan-400', text: 'Import a published nsite and keep editing it' },
      { icon: Globe, className: 'text-blue-400', text: 'Opens in any nsite viewer, not just this one' },
    ],
  },
];

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'YourSpace — Build a homepage that is actually yours',
    description:
      'Where nostalgia meets innovation. Design your own homepage with drag-and-drop blocks and publish it to Nostr as an nsite — no platform, no takedowns, no algorithm.',
  });

  return (
    <div className="ys-min-below-bar bg-slate-950 text-white">
      {/* Hero */}
      <div className="ys-aurora relative overflow-hidden">
        {/* Drifting sparks. Decorative, so hidden from the accessibility tree. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {SPARKS.map((spark) => (
            <span
              key={spark.className}
              className={`ys-float absolute rounded-full ${spark.className}`}
              style={{ animationDelay: spark.delay }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-24 text-center sm:pt-24 sm:pb-32">
          <div className="ys-glass rounded-3xl p-8 shadow-2xl sm:p-12">
            <div className="mb-8 flex items-center justify-center gap-4">
              <Globe className="ys-float size-9 text-violet-400" aria-hidden="true" />
              <h1 className="ys-wordmark text-5xl font-bold tracking-tight sm:text-7xl">
                YourSpace
              </h1>
              <Wand2
                className="ys-float size-9 text-cyan-400"
                style={{ animationDelay: '0.5s' }}
                aria-hidden="true"
              />
            </div>

            <p className="mb-6 text-3xl font-bold sm:text-4xl">
              Where nostalgia meets{' '}
              <span className="bg-linear-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
                innovation
              </span>
            </p>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Remember when your homepage was something you made? Build one again — laid out
              block by block, styled however you like, and published to Nostr so it stays yours.
            </p>

            {user ? (
              <Button asChild size="lg" className="group h-14 px-8 text-lg">
                <Link to="/edit">
                  Open the editor
                  <ArrowRight
                    className="size-5 transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <LoginArea className="w-full max-w-xs" />
                <Link
                  to="/edit"
                  className="text-base text-slate-300 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  or look around the editor first
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        Published homepages, on the app's own surface rather than the dark
        marketing one — these are other people's pages, and they read better
        against a neutral background than inside the aurora.
      */}
      <section className="bg-background px-6 py-20 text-foreground">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Fresh off the press</h2>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Homepages published to Nostr, newest first. Every one of them is a real
              site owned by the person who made it.
            </p>
          </div>

          <NsiteShowcase />
        </div>
      </section>

      {/* Features */}
      <section className="bg-linear-to-b from-slate-950 to-indigo-950 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-5xl">
              <span className="bg-linear-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Your corner of the internet
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-300">
              Everything you make here is an nsite: a real website, addressed by your key.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="ys-glass-card rounded-xl p-8">
                <div className="mb-6 text-center">
                  <span
                    className={`mb-4 inline-flex size-16 items-center justify-center rounded-full bg-linear-to-br ${feature.medallion}`}
                  >
                    <feature.icon className="size-8 text-white" aria-hidden="true" />
                  </span>
                  <h3 className="mb-4 text-xl font-bold">{feature.title}</h3>
                  <span
                    className={`mx-auto block h-0.5 w-12 rounded-full bg-linear-to-r ${feature.rule}`}
                  />
                </div>

                <p className="mb-4 text-base leading-relaxed text-slate-300">{feature.body}</p>

                <ul className="space-y-2 text-sm text-slate-300">
                  {feature.points.map((point) => (
                    <li key={point.text} className="flex items-start gap-2">
                      <point.icon
                        className={`mt-0.5 size-4 shrink-0 ${point.className}`}
                        aria-hidden="true"
                      />
                      {point.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action. Kept dark so the violet "Join" button stands off it. */}
      <section className="bg-linear-to-b from-indigo-950 via-violet-950 to-slate-950 px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-bold sm:text-5xl">Ready to make something yours?</h2>
          <p className="mb-10 text-lg leading-relaxed text-slate-300 sm:text-xl">
            No walled gardens, no data mining, no feed to please. Just a page, made by you.
          </p>

          <div className="flex justify-center">
            {user ? (
              <Button asChild size="lg" variant="secondary" className="group h-14 px-8 text-lg">
                <Link to="/edit">
                  Start building
                  <ArrowRight
                    className="size-5 transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            ) : (
              <LoginArea className="w-full max-w-xs" />
            )}
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-sm text-slate-400 sm:flex-row sm:justify-between sm:text-left">
          <Logo className="text-base text-slate-300" />
          <p>
            Built on{' '}
            <a
              href="https://github.com/nostr-protocol/nips"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4 hover:text-white"
            >
              Nostr
            </a>{' '}
            and nsites (NIP-5A).
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
