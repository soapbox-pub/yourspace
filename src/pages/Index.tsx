import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
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
  Zap,
} from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Logo } from '@/components/Logo';
import { NsiteShowcase } from '@/components/NsiteShowcase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/*
 * Glossy clip-art stickers, the same shapes as the social graphics in
 * branding/. Flat brand fill, dark outline, white gloss mark. Decorative,
 * so every one of them is hidden from the accessibility tree.
 */
function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <path
        d="M50 2 Q58 42 98 50 Q58 58 50 98 Q42 58 2 50 Q42 42 50 2 Z"
        fill="currentColor"
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="34" r="8" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

function GlossyHeart({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <path
        d="M50 30 C50 12 32 4 22 13 C10 24 12 42 26 54 L50 78 L74 54 C88 42 90 24 78 13 C68 4 50 12 50 30 Z"
        fill="currentColor"
        stroke="#0c1130"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <ellipse cx="33" cy="27" rx="11" ry="7" fill="#ffffff" opacity="0.55" transform="rotate(-22 33 27)" />
    </svg>
  );
}

function Bolt({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <polygon
        points="55,5 15,55 40,55 45,95 85,45 60,45"
        fill="currentColor"
        stroke="#0c1130"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <circle cx="45" cy="28" r="8" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

function GlossyStar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <polygon
        points="50,4 61,36 96,36 68,57 78,92 50,71 22,92 32,57 4,36 39,36"
        fill="currentColor"
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="32" r="7" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

function Note({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <g fill="currentColor">
        <polygon points="34,26 96,16 96,32 34,42" />
        <rect x="34" y="30" width="7" height="52" />
        <rect x="89" y="24" width="7" height="48" />
        <ellipse cx="28" cy="84" rx="15" ry="10" transform="rotate(-20 28 84)" />
        <ellipse cx="84" cy="74" rx="15" ry="10" transform="rotate(-20 84 74)" />
      </g>
      <ellipse cx="24" cy="81" rx="5" ry="3" fill="#ffffff" opacity="0.6" transform="rotate(-20 24 81)" />
    </svg>
  );
}

/** The wordmark: one glossy colour per letter, jittered like the OG image. */
const WORDMARK = [
  { ch: 'Y', color: 'text-ys-pink', dy: '0px' },
  { ch: 'O', color: 'text-ys-orange', dy: '-7px' },
  { ch: 'U', color: 'text-ys-yellow', dy: '3px' },
  { ch: 'R', color: 'text-ys-lime', dy: '-3px' },
  { ch: 'S', color: 'text-ys-cyan', dy: '5px' },
  { ch: 'P', color: 'text-ys-violet', dy: '-9px' },
  { ch: 'A', color: 'text-ys-pink', dy: '7px' },
  { ch: 'C', color: 'text-ys-orange', dy: '0px' },
  { ch: 'E', color: 'text-ys-yellow', dy: '-5px' },
];

const FEATURES = [
  {
    icon: Globe,
    accent: 'bg-ys-pink',
    title: 'a page that is actually yours',
    body: 'Your homepage lives under your own keypair, not on someone else’s platform. Nobody can suspend it, rank it, or wrap it in ads.',
    points: [
      { icon: Star, className: 'text-ys-yellow', text: 'You own the identity — no corporation in the middle' },
      { icon: Shield, className: 'text-ys-lime', text: 'Nothing to take down, because there is nothing to take it down from' },
      { icon: Heart, className: 'text-ys-pink', text: 'No ads, no tracking, no algorithm deciding who sees it' },
    ],
  },
  {
    icon: Layout,
    accent: 'bg-ys-cyan',
    title: 'drag, drop, done',
    body: 'Build the page the way you want it from ready-made blocks. Click anything to restyle it. No HTML knowledge required.',
    points: [
      { icon: MousePointerClick, className: 'text-ys-cyan', text: 'Visual editing on a live page, not a form' },
      { icon: Music, className: 'text-ys-violet', text: 'Profile headers, link lists, note feeds, galleries' },
      { icon: Zap, className: 'text-ys-yellow', text: 'Lightning zaps wired straight into the page' },
    ],
  },
  {
    icon: Radio,
    accent: 'bg-ys-yellow',
    title: 'real HTML, published to Nostr',
    body: 'What you build is an nsite — ordinary HTML and CSS, addressed by your pubkey and served from anywhere that speaks the protocol.',
    points: [
      { icon: Code2, className: 'text-ys-orange', text: 'Plain HTML and CSS you can read and take with you' },
      { icon: Sparkles, className: 'text-ys-cyan', text: 'Import a published nsite and keep editing it' },
      { icon: Globe, className: 'text-ys-violet', text: 'Opens in any nsite viewer, not just this one' },
    ],
  },
];

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'YourSpace: Build a homepage that is actually yours',
    description:
      'Where nostalgia meets innovation. Design your own homepage with drag-and-drop blocks and publish it to Nostr as an nsite — no platform, no takedowns, no algorithm.',
  });

  return (
    <div className="ys-min-below-bar overflow-x-hidden bg-ys-grape text-white">
      {/* Hero: dithered sky, wordmark left, ghost right */}
      <div className="ys-sky relative overflow-hidden">
        {/* Floating stickers. Decorative, so hidden from the accessibility tree. */}
        <Sparkle className="ys-float absolute top-[8%] left-[4%] w-10 text-ys-cyan sm:w-14" />
        <GlossyHeart className="ys-float absolute top-[12%] right-[6%] w-9 text-ys-pink sm:w-12" style={{ animationDelay: '0.6s' }} />
        <Bolt className="ys-float absolute bottom-[24%] left-[2%] hidden w-10 text-ys-yellow sm:block" style={{ animationDelay: '1.1s' }} />
        <GlossyStar className="ys-float absolute top-[46%] right-[3%] hidden w-9 text-ys-lime lg:block" style={{ animationDelay: '1.6s' }} />
        <Note className="ys-float absolute bottom-[10%] right-[16%] hidden w-10 text-ys-violet sm:block" style={{ animationDelay: '0.3s' }} />
        <Sparkle className="ys-float absolute bottom-[32%] left-[38%] hidden w-7 text-white lg:block" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-14 pb-24 sm:pt-20 sm:pb-28">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-4">
            <div className="flex-1 text-center lg:text-left">
              <h1 aria-label="YourSpace" className="-rotate-2 select-none">
                <span aria-hidden="true" className="inline-block">
                  {WORDMARK.map((letter, i) => (
                    <span
                      key={i}
                      className={`ys-outline inline-block font-display text-5xl font-black italic sm:text-7xl lg:text-8xl xl:text-9xl ${letter.color}`}
                      style={{ transform: `translateY(${letter.dy})` }}
                    >
                      {letter.ch}
                    </span>
                  ))}
                </span>
              </h1>

              <p className="ys-outline-sm mt-6 font-display text-2xl font-extrabold italic text-white sm:text-4xl">
                a home page that’s actually <span className="whitespace-nowrap text-ys-pink">yours !!</span>
              </p>

              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ys-lavender lg:mx-0">
                Remember when your homepage was something you made? Build one again — laid out
                block by block, styled however you like, and published to Nostr so it stays yours.
              </p>

              <div className="mt-9 flex flex-col items-center gap-4 lg:items-start">
                {user ? (
                  <Link to="/edit" className="ys-gel">
                    open the editor
                  </Link>
                ) : (
                  <>
                    <LoginArea className="w-full max-w-xs" />
                    <Link
                      to="/edit"
                      className="text-base text-ys-lavender underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ys-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-ys-purple"
                    >
                      or look around the editor first
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="relative shrink-0">
              <img
                src="/icon.svg"
                alt="The YourSpace ghost, holding a heart"
                className="ys-float w-52 -rotate-3 drop-shadow-[0_18px_24px_rgb(12_17_48/0.5)] sm:w-64 lg:w-80"
              />
            </div>
          </div>
        </div>

        {/* Zebra ribbon off the bottom of the hero */}
        <div className="absolute inset-x-0 bottom-0 overflow-hidden" aria-hidden="true">
          <div className="ys-zebra h-10 -rotate-1 scale-x-110 sm:h-12" />
        </div>
      </div>

      {/*
        Published homepages, on the app's own surface rather than the brand
        one — these are other people's pages, and they read better against a
        neutral background than on the sky.
      */}
      <section className="bg-background px-6 py-20 text-foreground">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <h2 className="mb-3 font-display text-4xl font-black italic tracking-tight sm:text-5xl">
              fresh off the press
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Homepages published to Nostr, newest first. Every one of them is a real
              site owned by the person who made it.
            </p>
          </div>

          <NsiteShowcase />
        </div>
      </section>

      {/* Features, back on the sky */}
      <section className="ys-sky relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="ys-outline mb-4 font-display text-4xl font-black italic text-white sm:text-6xl">
              your corner of the internet
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-ys-lavender">
              Everything you make here is an nsite: a real website, addressed by your key.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="ys-card-gloss p-8">
                <span className={`mb-6 block h-2 w-16 rounded-full ${feature.accent}`} aria-hidden="true" />
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full border-[3px] border-ys-edge ${feature.accent}`}
                  >
                    <feature.icon className="size-6 text-ys-navy" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-2xl font-extrabold italic text-white">
                    {feature.title}
                  </h3>
                </div>

                <p className="mb-4 text-base leading-relaxed text-ys-lavender">{feature.body}</p>

                <ul className="space-y-2 text-sm text-ys-lavender">
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

      {/* Closing call to action */}
      <section className="relative bg-ys-grape">
        <div className="overflow-hidden" aria-hidden="true">
          <div className="ys-zebra h-10 rotate-1 scale-x-110 sm:h-12" />
        </div>

        <div className="px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <img
              src="/icon.svg"
              alt=""
              aria-hidden="true"
              className="ys-float mx-auto mb-6 w-24 rotate-6"
            />
            <h2 className="ys-outline mb-6 font-display text-4xl font-black italic text-white sm:text-6xl">
              ready to make something yours?
            </h2>
            <p className="mb-10 text-lg leading-relaxed text-ys-lavender sm:text-xl">
              No walled gardens, no data mining, no feed to please. Just a page, made by you.
            </p>

            <div className="flex justify-center">
              {user ? (
                <Link to="/edit" className="ys-gel">
                  start building
                </Link>
              ) : (
                <LoginArea className="w-full max-w-xs" />
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-ys-edge px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-sm text-ys-lavender sm:flex-row sm:justify-between sm:text-left">
          <Logo className="text-white" />
          <p>
            Built on{' '}
            <a
              href="https://github.com/nostr-protocol/nips"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4 hover:text-ys-pink"
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
