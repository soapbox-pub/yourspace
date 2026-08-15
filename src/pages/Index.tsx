import { useId, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Logo } from '@/components/Logo';
import { NsiteShowcase } from '@/components/NsiteShowcase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/* Lighten a hex color, for the top stop of a glossy gradient. */
function lighten(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * f);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/*
 * Glossy clip-art stickers, drawn exactly like the ones in the social
 * graphics (branding/generate.mjs): gradient fill, dark outline, white
 * gloss mark. All decorative, all hidden from the accessibility tree.
 */
function useGloss(color: string) {
  const id = useId();
  return { id, stops: { light: lighten(color, 0.55), base: color } };
}

function Gloss({ id, stops }: { id: string; stops: { light: string; base: string } }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={stops.light} />
        <stop offset="1" stopColor={stops.base} />
      </linearGradient>
    </defs>
  );
}

type StickerProps = { color?: string; className?: string; style?: React.CSSProperties };

function Sparkle({ color = '#ffffff', className, style }: StickerProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <path
        d="M50 2 Q58 42 98 50 Q58 58 50 98 Q42 58 2 50 Q42 42 50 2 Z"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="34" r="8" fill="#ffffff" opacity="0.65" />
    </svg>
  );
}

function GlossyHeart({ color = '#ff2d9e', className, style }: StickerProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <path
        d="M50 30 C50 12 32 4 22 13 C10 24 12 42 26 54 L50 78 L74 54 C88 42 90 24 78 13 C68 4 50 12 50 30 Z"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <ellipse cx="33" cy="27" rx="11" ry="7" fill="#ffffff" opacity="0.55" transform="rotate(-22 33 27)" />
    </svg>
  );
}

function BrokenHeart({ color = '#ff2d9e', className, style }: StickerProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <g transform="rotate(-7 50 50) translate(-4 0)">
        <path
          d="M50 30 C50 12 32 4 22 13 C10 24 12 42 26 54 L50 78 L46 66 L56 54 L46 42 L54 34 Z"
          fill={`url(#${id})`}
          stroke="#0c1130"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <ellipse cx="30" cy="26" rx="9" ry="6" fill="#ffffff" opacity="0.55" transform="rotate(-22 30 26)" />
      </g>
      <g transform="rotate(8 50 50) translate(4 0)">
        <path
          d="M50 30 C50 12 68 4 78 13 C90 24 88 42 74 54 L50 78 L56 66 L46 54 L56 42 L44 34 Z"
          fill={`url(#${id})`}
          stroke="#0c1130"
          strokeWidth="6"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

function Bolt({ color = '#ffd400', className, style }: StickerProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <polygon
        points="55,5 15,55 40,55 45,95 85,45 60,45"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <circle cx="45" cy="28" r="8" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

function GlossyStar({ color = '#ffd400', className, style }: StickerProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <polygon
        points="50,4 61,36 96,36 68,57 78,92 50,71 22,92 32,57 4,36 39,36"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="32" r="7" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

function Note({ color = '#b14dff', className, style }: StickerProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <g fill={`url(#${id})`}>
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

/* The scene skull with the pink hair bow, straight off the banner. */
function Skull({ className, style }: StickerProps) {
  const white = useGloss('#f2f4fc');
  const pink = useGloss('#ff2d9e');
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={white.id} stops={white.stops} />
      <Gloss id={pink.id} stops={pink.stops} />
      <path
        d="M50 8 C28 8 16 24 16 42 C16 54 22 62 30 66 L30 80 C30 85 34 88 39 88 L61 88 C66 88 70 85 70 80 L70 66 C78 62 84 54 84 42 C84 24 72 8 50 8 Z"
        fill={`url(#${white.id})`}
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <ellipse cx="36" cy="44" rx="9" ry="12" fill="#131a3a" />
      <ellipse cx="64" cy="44" rx="9" ry="12" fill="#131a3a" />
      <path d="M50 56 L45 64 L55 64 Z" fill="#131a3a" />
      <rect x="42" y="72" width="3" height="12" fill="#131a3a" />
      <rect x="48.5" y="72" width="3" height="12" fill="#131a3a" />
      <rect x="55" y="72" width="3" height="12" fill="#131a3a" />
      <g transform="translate(74 14) rotate(18)">
        <polygon points="0,0 -17,-10 -15,8" fill={`url(#${pink.id})`} stroke="#0c1130" strokeWidth="4" strokeLinejoin="round" />
        <polygon points="0,0 17,-10 15,8" fill={`url(#${pink.id})`} stroke="#0c1130" strokeWidth="4" strokeLinejoin="round" />
        <circle r="5" fill={`url(#${pink.id})`} stroke="#0c1130" strokeWidth="4" />
      </g>
    </svg>
  );
}

/* Shooting star with three tapering trails. */
function ShootingStar({ className, style }: StickerProps) {
  return (
    <span className={`relative inline-block ${className ?? ''}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 140 100" className="block h-auto w-full">
        <polygon points="118,52 25,18 116,44" fill="#ffffff" opacity="0.55" />
        <polygon points="120,64 33,58 118,56" fill="#ff2d9e" opacity="0.55" />
        <polygon points="112,40 45,4 108,32" fill="#00d9ff" opacity="0.55" />
      </svg>
      <GlossyStar color="#ffd400" className="absolute right-0 top-1/2 w-1/3 -translate-y-1/2 rotate-12" />
    </span>
  );
}

/* Rainbow with cloud ends, like the one on the banner and background. */
function Rainbow({ className, style }: StickerProps) {
  const bands = ['#ff2d9e', '#ff8a00', '#ffd400', '#8fe800', '#00d9ff', '#b14dff'];
  return (
    <svg viewBox="0 0 460 240" className={className} style={style} aria-hidden="true">
      {bands.map((c, i) => (
        <path
          key={c}
          d={`M ${230 - (210 - i * 22)} 220 A ${210 - i * 22} ${210 - i * 22} 0 0 1 ${230 + (210 - i * 22)} 220`}
          fill="none"
          stroke={c}
          strokeWidth="22"
        />
      ))}
      <g fill="#ffffff">
        <circle cx="52" cy="216" r="26" />
        <circle cx="86" cy="200" r="34" />
        <circle cx="120" cy="216" r="26" />
        <rect x="46" y="216" width="80" height="24" rx="12" />
        <circle cx="342" cy="216" r="26" />
        <circle cx="376" cy="200" r="34" />
        <circle cx="410" cy="216" r="26" />
        <rect x="336" y="216" width="80" height="24" rx="12" />
      </g>
    </svg>
  );
}

/*
 * The zebra ribbon, as actual SVG: a pink band with navy teeth and navy
 * edges, identical to the one in the graphics.
 */
function ZebraStrip({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const teeth = [];
  for (let x = 0; x < 1200; x += 48) {
    teeth.push(`M${x} 0 L${x + 28} 0 L${x + 14} 26 Z`);
    teeth.push(`M${x + 24} 60 L${x + 52} 60 L${x + 38} 34 Z`);
  }
  return (
    <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <rect width="1200" height="60" fill="#ff2d9e" />
      <path d={teeth.join(' ')} fill="#131a3a" />
      <rect width="1200" height="5" fill="#0c1130" />
      <rect y="55" width="1200" height="5" fill="#0c1130" />
    </svg>
  );
}

/* The scrolling strip from the OG image and banner, verbatim. */
function Marquee() {
  const text = '*.:* WELCOME 2 YOURSPACE *:. UR OWN HOME PAGE ON NOSTR .:* ';
  return (
    <div className="ys-marquee border-y-4 border-ys-edge bg-ys-navy py-3" aria-hidden="true">
      <div className="ys-marquee-inner font-display text-xl font-extrabold italic text-ys-lime">
        <span className="inline-block pr-2">{text.repeat(4)}</span>
        <span className="inline-block pr-2">{text.repeat(4)}</span>
      </div>
    </div>
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

/** Demo page options. */
const ACCENTS = ['#ff2d9e', '#ff8a00', '#ffd400', '#8fe800', '#00d9ff', '#b14dff', '#14ff89'];
const PATTERNS = ['plain', 'checker', 'stripes', 'zebra'] as const;
const STICKERS = ['heart', 'star', 'skull', 'bolt', 'note', 'broken'] as const;

function patternStyle(pattern: (typeof PATTERNS)[number]): React.CSSProperties {
  if (pattern === 'checker') {
    return {
      background:
        'repeating-conic-gradient(rgb(0 0 0 / 0.18) 0% 25%, rgb(255 255 255 / 0.04) 0% 50%) 0 0 / 18px 18px, #1b2350',
    };
  }
  if (pattern === 'stripes') {
    return {
      background:
        'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.05) 0 8px, transparent 8px 22px), #1b2350',
    };
  }
  return { background: '#1b2350' };
}

function DemoSticker({ kind, accent, className }: { kind: (typeof STICKERS)[number]; accent: string; className?: string }) {
  if (kind === 'heart') return <GlossyHeart color={accent} className={className} />;
  if (kind === 'star') return <GlossyStar color={accent} className={className} />;
  if (kind === 'bolt') return <Bolt color={accent} className={className} />;
  if (kind === 'note') return <Note color={accent} className={className} />;
  if (kind === 'broken') return <BrokenHeart color={accent} className={className} />;
  return <Skull className={className} />;
}

const Index = () => {
  const { user } = useCurrentUser();
  const [accent, setAccent] = useState('#14ff89');
  const [pattern, setPattern] = useState<(typeof PATTERNS)[number]>('checker');
  const [sticker, setSticker] = useState<(typeof STICKERS)[number]>('heart');
  const [name, setName] = useState('ur demo page');
  const [glitter, setGlitter] = useState(true);

  useSeoMeta({
    title: 'YourSpace: Build a homepage that is actually yours',
    description:
      'Where nostalgia meets innovation. Design your own homepage with drag-and-drop blocks and publish it to Nostr as an nsite — no platform, no takedowns, no algorithm.',
  });

  return (
    <div className="ys-min-below-bar overflow-x-hidden bg-ys-grape text-white">
      {/* Hero: dithered sky, wordmark left, ghost right, the banner cast scattered */}
      <div className="ys-sky relative overflow-hidden">
        {/* The banner cast, as glitter clusters with a two-frame twinkle */}
        <ShootingStar className="absolute top-[4%] left-[2%] w-36 sm:w-44" />
        <div className="absolute top-[16%] left-[5%] -rotate-6" aria-hidden="true">
          <GlossyStar color="#ffd400" className="w-10 sm:w-14" />
          <Sparkle color="#00d9ff" className="ys-twinkle absolute -right-4 top-7 w-5 sm:w-7" />
        </div>
        <div className="absolute top-[6%] right-[4%] rotate-12" aria-hidden="true">
          <GlossyHeart color="#ff2d9e" className="w-9 sm:w-12" />
          <Sparkle color="#ffffff" className="ys-twinkle absolute -left-4 -top-2 w-5" style={{ animationDelay: '0.4s' }} />
        </div>
        <Skull className="absolute top-[10%] right-[22%] hidden w-16 rotate-6 lg:block" />
        <div className="absolute bottom-[24%] left-[2%] hidden rotate-6 sm:block" aria-hidden="true">
          <Bolt color="#ffd400" className="w-10" />
          <Sparkle color="#8fe800" className="absolute -right-4 top-8 w-5" />
        </div>
        <div className="absolute right-[10%] bottom-[14%] hidden -rotate-12 sm:block" aria-hidden="true">
          <Note color="#b14dff" className="w-12" />
          <Sparkle color="#ff2d9e" className="ys-twinkle absolute -left-5 top-7 w-5" style={{ animationDelay: '0.7s' }} />
        </div>
        <BrokenHeart color="#ff2d9e" className="absolute bottom-[8%] left-[30%] hidden w-12 -rotate-6 lg:block" />
        <GlossyHeart color="#2a1245" className="absolute top-[38%] right-[2%] hidden w-9 -rotate-12 lg:block" />
        <Sparkle color="#ffffff" className="ys-twinkle absolute bottom-[34%] left-[38%] hidden w-6 lg:block" style={{ animationDelay: '0.2s' }} />

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

            {/* Ghost with the rainbow arcing over it, like the banner */}
            <div className="relative shrink-0">
              <Rainbow className="absolute -top-24 -right-16 hidden w-80 rotate-3 lg:block" />
              <img
                src="/icon.svg"
                alt="The YourSpace ghost, holding a heart"
                className="relative w-52 -rotate-3 drop-shadow-[0_18px_24px_rgb(12_17_48/0.5)] sm:w-64 lg:w-80"
              />
            </div>
          </div>
        </div>

        {/* Zebra ribbon off the bottom of the hero */}
        <div className="absolute inset-x-0 bottom-0 overflow-hidden" aria-hidden="true">
          <ZebraStrip className="block h-10 w-full -rotate-1 scale-x-110 sm:h-12" />
        </div>
      </div>

      <Marquee />

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

      {/*
        The demo. No feature lists: a little page built from blocks, and the
        visitor restyles it themselves — color, background, sticker, name,
        glitter. Scene wallpaper behind it, pinstripes instead of checker.
      */}
      <section className="ys-scene relative overflow-hidden px-6 py-24">
        {/* Wallpaper scatter */}
        <GlossyStar color="#14ff89" className="absolute top-[8%] left-[4%] w-10 -rotate-6" />
        <Sparkle color="#ffffff" className="ys-twinkle absolute top-[14%] left-[10%] w-5" />
        <GlossyHeart color="#ff2d9e" className="absolute top-[10%] right-[5%] w-9 rotate-12" />
        <Bolt color="#ffd400" className="absolute bottom-[12%] left-[3%] hidden w-9 rotate-6 sm:block" />
        <Note color="#00d9ff" className="absolute right-[4%] bottom-[16%] hidden w-10 -rotate-12 sm:block" />
        <Sparkle color="#14ff89" className="ys-twinkle absolute right-[12%] top-[40%] hidden w-6 lg:block" style={{ animationDelay: '0.5s' }} />
        <Skull className="absolute bottom-[6%] right-[30%] hidden w-12 rotate-6 lg:block" />

        <div className="relative mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="ys-outline mb-4 font-display text-4xl font-black italic text-white sm:text-6xl">
              go ahead, touch it
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-[#c8f5dd]">
              This page is built from blocks, the way yours will be. Make it yours:
            </p>
          </div>

          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
            {/* The demo page itself */}
            <div className="ys-card-gloss w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between border-b-[3px] border-ys-edge bg-[#1b2350] px-4 py-2.5">
                <span className="font-display text-sm font-bold italic text-ys-lavender">demo-page.html</span>
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#c9cfe8]" />
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#c9cfe8]" />
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#ff2d9e]" />
                </span>
              </div>

              {pattern === 'zebra' && <ZebraStrip className="block h-6 w-full" />}

              <div className="relative space-y-4 p-5 transition-colors" style={patternStyle(pattern)}>
                {glitter && (
                  <>
                    <Sparkle color="#ffffff" className="ys-twinkle absolute top-2 right-3 w-4" />
                    <Sparkle color={accent} className="ys-twinkle absolute bottom-3 right-6 w-5" style={{ animationDelay: '0.5s' }} />
                  </>
                )}

                <div
                  className="relative flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors"
                  style={{ borderColor: accent }}
                >
                  <img
                    src="/icon.svg"
                    alt=""
                    aria-hidden="true"
                    className="w-14 rounded-lg border-2 bg-ys-purple transition-colors"
                    style={{ borderColor: accent }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl font-black italic transition-colors" style={{ color: accent }}>
                      {name || 'ur demo page'}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-ys-lavender">
                      <span className="inline-block size-2 rounded-full bg-[#2ee86c]" aria-hidden="true" />
                      online now!
                    </p>
                  </div>
                  <DemoSticker kind={sticker} accent={accent} className="w-10 shrink-0 rotate-6" />
                </div>

                <div
                  className="rounded-lg border-2 border-dashed p-3 text-sm leading-relaxed text-ys-lavender transition-colors"
                  style={{ borderColor: accent }}
                >
                  hi !! this is ur demo page. every block on it can be moved, restyled, or
                  deleted — that’s the whole editor.
                </div>

                <div
                  className="flex flex-wrap gap-2 rounded-lg border-2 border-dashed p-3 transition-colors"
                  style={{ borderColor: accent }}
                >
                  {['my blog', 'my pics', 'zap me !!'].map((label) => (
                    <span
                      key={label}
                      className="rounded-full px-4 py-1.5 font-display text-sm font-extrabold italic text-ys-navy transition-colors"
                      style={{ backgroundColor: accent }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div
                  className="flex items-center gap-2 rounded-lg border-2 border-dashed p-3 text-sm text-ys-lavender transition-colors"
                  style={{ borderColor: accent }}
                >
                  <Note color={accent} className="w-6 shrink-0 transition-colors" />
                  now playing: something emo
                </div>
              </div>
            </div>

            {/* The controls */}
            <div className="w-full max-w-md space-y-5 lg:max-w-56">
              <div>
                <p className="mb-2 font-display text-lg font-extrabold italic text-white">color</p>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Accent color">
                  {ACCENTS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccent(color)}
                      aria-label={`Accent color ${color}`}
                      aria-pressed={accent === color}
                      className={`size-9 rounded-full border-[3px] border-ys-edge transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        accent === color ? 'ring-4 ring-white' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-display text-lg font-extrabold italic text-white">background</p>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Background pattern">
                  {PATTERNS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPattern(p)}
                      aria-label={`Background ${p}`}
                      aria-pressed={pattern === p}
                      className={`h-9 w-14 overflow-hidden rounded-md border-[3px] border-ys-edge transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        pattern === p ? 'ring-4 ring-white' : ''
                      }`}
                      style={patternStyle(p)}
                    >
                      {p === 'zebra' && <ZebraStrip className="block h-full w-full" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-display text-lg font-extrabold italic text-white">sticker</p>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Page sticker">
                  {STICKERS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSticker(k)}
                      aria-label={`Sticker ${k}`}
                      aria-pressed={sticker === k}
                      className={`flex size-11 items-center justify-center rounded-full border-[3px] border-ys-edge bg-[#1b2350] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        sticker === k ? 'ring-4 ring-white' : ''
                      }`}
                    >
                      <DemoSticker kind={k} accent={accent} className="w-7" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="demo-name" className="mb-2 block font-display text-lg font-extrabold italic text-white">
                  page name
                </label>
                <input
                  id="demo-name"
                  type="text"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border-[3px] border-ys-edge bg-[#1b2350] px-3 py-2 text-white placeholder:text-ys-lavender/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  placeholder="ur demo page"
                />
              </div>

              <div>
                <p className="mb-2 font-display text-lg font-extrabold italic text-white">glitter</p>
                <button
                  type="button"
                  onClick={() => setGlitter((g) => !g)}
                  aria-pressed={glitter}
                  className="rounded-full border-[3px] border-ys-edge px-5 py-1.5 font-display text-sm font-extrabold italic transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{ backgroundColor: glitter ? '#14ff89' : '#1b2350', color: glitter ? '#131a3a' : '#d9c8ff' }}
                >
                  {glitter ? 'on !!' : 'off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing call to action: the page that could be yours */}
      <section className="relative bg-ys-grape">
        <div className="overflow-hidden" aria-hidden="true">
          <ZebraStrip className="block h-10 w-full rotate-1 scale-x-110 sm:h-12" />
        </div>

        <div className="px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="ys-outline mb-10 font-display text-4xl font-black italic text-white sm:text-6xl">
              ur page is waiting
            </h2>

            <div className="ys-card-gloss overflow-hidden text-left">
              <div className="flex items-center justify-between border-b-[3px] border-ys-edge bg-[#1b2350] px-4 py-2.5">
                <span className="font-display text-sm font-bold italic text-ys-lavender">ur-space.html</span>
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#c9cfe8]" />
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#c9cfe8]" />
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#ff2d9e]" />
                </span>
              </div>

              <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
                <img
                  src="/icon.svg"
                  alt="The YourSpace ghost"
                  className="w-28 shrink-0 rounded-xl border-[3px] border-ys-edge bg-ys-purple"
                />
                <div className="text-center sm:text-left">
                  <p className="font-display text-3xl font-black italic text-white">ur page</p>
                  <p className="mt-1 text-sm text-ys-lavender">currently: under construction ♥</p>
                  <p className="mt-3 text-sm leading-relaxed text-ys-lavender">
                    no walled gardens, no algorithm, no feed to please. the pic, the colors, the
                    blocks — all up to u. published under ur own key, so it stays urs.
                  </p>

                  <div className="mt-6">
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
