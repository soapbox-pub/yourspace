import { useId, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { GripVertical } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Alien, Bat, Bunny, Cat, DevilHeart } from '@/components/Characters';
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

/* Darken a hex color, for text and borders on the pastel cards. */
function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v * (1 - f));
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
      <circle cx="33" cy="40" r="3" fill="#ffffff" />
      <circle cx="61" cy="40" r="3" fill="#ffffff" />
      <ellipse cx="24" cy="58" rx="6" ry="4" fill="#ff2d9e" opacity="0.55" />
      <ellipse cx="76" cy="58" rx="6" ry="4" fill="#ff2d9e" opacity="0.55" />
      <path d="M50 55 L45 63 L55 63 Z" fill="#131a3a" />
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
    <span className={className} style={style} aria-hidden="true">
      <svg viewBox="0 0 140 100" className="block h-auto w-full">
        <polygon points="118,52 25,18 116,44" fill="#ffffff" opacity="0.55" />
        <polygon points="120,64 33,58 118,56" fill="#ff2d9e" opacity="0.55" />
        <polygon points="112,40 45,4 108,32" fill="#00d9ff" opacity="0.55" />
      </svg>
      <GlossyStar color="#ffd400" className="absolute right-0 top-1/2 w-1/3 -translate-y-1/2 rotate-12" />
    </span>
  );
}

/*
 * A chaotic gel-pen border, sketchbook style: a lazy vine weaving down the
 * strip with fat spiral curls sprouting off it, hatched hearts and stars
 * tossed in at random tilts, dash bursts, squiggles, and dots, all in
 * full-strength gel-pen purple. The tile meets itself end to end, so the
 * strips repeat seamlessly.
 */
function DoodleBorderTile() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      {/* the vine, weaving */}
      <path d="M30 0 C46 18 12 30 20 54 C26 72 52 66 50 88 C48 108 14 104 15 128 C16 150 50 146 47 170 C44 192 12 188 17 212 C21 234 44 234 34 260" />
      {/* fat spiral curls */}
      <path d="M20 54 Q34 46 40 34 Q44 24 36 21 Q29 19 28 27 Q27 35 36 36" strokeWidth="2.5" />
      <path d="M15 128 Q4 118 6 106 Q8 97 15 100 Q21 103 17 110" strokeWidth="2.5" />
      <path d="M47 170 Q58 162 57 151 Q56 142 48 145 Q42 148 46 155" strokeWidth="2.5" />
      {/* hatched heart, tilted */}
      <g transform="rotate(-16 44 116)">
        <path d="M44 128 Q32 117 32 109 Q32 102 38 102 Q43 102 44 107 Q45 102 50 102 Q56 102 56 109 Q56 117 44 128 Z" strokeWidth="2.5" />
        <path d="M37 107 L42 112 M36 113 L43 120 M46 121 L51 114" strokeWidth="1.6" />
      </g>
      {/* half-hatched star with a dash burst */}
      <g transform="rotate(18 24 226)">
        <path d="M24 214 L27.5 221 L35.5 221 L29.5 226 L31.5 234 L24 229.5 L16.5 234 L18.5 226 L12.5 221 L20.5 221 Z" strokeWidth="2.5" />
        <path d="M25 216 L29 220 M22 218 L28 224" strokeWidth="1.6" />
      </g>
      <path d="M40 208 L44 204 M44 214 L49 212 M42 220 L47 221" strokeWidth="1.8" />
      {/* loose hearts and stars at odd angles */}
      <g transform="rotate(24 52 24)">
        <path d="M52 30 Q46 24.5 46 21 Q46 18 49 18 Q51.5 18 52 20.5 Q52.5 18 55 18 Q58 18 58 21 Q58 24.5 52 30 Z" strokeWidth="2" />
      </g>
      <g transform="rotate(-20 10 78)">
        <path d="M10 72 L11.5 76 L15.5 76 L12.5 78.5 L13.5 82.5 L10 80 L6.5 82.5 L7.5 78.5 L4.5 76 L8.5 76 Z" strokeWidth="1.8" />
      </g>
      <g transform="rotate(30 54 192)">
        <path d="M54 198 Q48 192.5 48 189 Q48 186 51 186 Q53.5 186 54 188.5 Q54.5 186 57 186 Q60 186 60 189 Q60 192.5 54 198 Z" strokeWidth="2" />
      </g>
      {/* squiggle and dots */}
      <path d="M46 246 Q50 240 54 246 Q58 252 62 246" strokeWidth="2" />
      <circle cx="8" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="56" cy="60" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="160" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="244" r="1.5" fill="currentColor" stroke="none" />
    </g>
  );
}

/*
 * A strip of the border: repeats DoodleBorderTile down its full length.
 * Vertical by default; `horizontal` lays two tiles along the top or bottom
 * edge, anchored so the chain meets the corner on the right.
 */
function DoodleBorderStrip({ horizontal = false, className }: { horizontal?: boolean; className?: string }) {
  const id = useId();
  if (horizontal) {
    return (
      <svg viewBox="0 0 520 64" className={className} aria-hidden="true">
        <g transform="translate(520 0) rotate(90)">
          {[0, 260].map((y) => (
            <g key={y} transform={`translate(0 ${y})`}>
              <DoodleBorderTile />
            </g>
          ))}
        </g>
      </svg>
    );
  }
  return (
    <svg className={className} aria-hidden="true">
      <defs>
        <pattern id={id} width="64" height="260" patternUnits="userSpaceOnUse">
          <DoodleBorderTile />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/*
 * The crew as margin doodles: chibi pen sketches of the site's characters
 * (ghost, skull, cat, bat, alien, devil heart, bunny) tumbling down the
 * margin at odd tilts, with hearts, stars, sparkles, dash bursts, and
 * spirals scribbled in the gaps. The tile repeats seamlessly every 520px.
 */
function DoodleCrewTile() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      {/* ghost, listing to port */}
      <g transform="rotate(-9 32 34)">
        <path d="M12 60 L12 26 Q12 8 32 8 Q52 8 52 26 L52 60 Q47 55 42 60 Q37 55 32 60 Q27 55 22 60 Q17 55 12 60 Z" />
        <ellipse cx="25" cy="32" rx="2.5" ry="4" fill="currentColor" stroke="none" />
        <ellipse cx="39" cy="32" rx="2.5" ry="4" fill="currentColor" stroke="none" />
        <path d="M29 41 Q32 44 35 41" />
        <path d="M19 38 L22 36 M42 36 L45 38" strokeWidth="1.6" />
      </g>
      <g transform="rotate(28 57 8)">
        <path d="M57 12 Q53 8 53 5.5 Q53 3 55.2 3 Q57 3 57 4.8 Q57 3 58.8 3 Q61 3 61 5.5 Q61 8 57 12 Z" strokeWidth="2" />
      </g>
      <path d="M55 30 L60 28 M55 37 L61 37 M54 44 L59 47" strokeWidth="1.8" />
      <g transform="rotate(-15 7 46)">
        <path d="M7 42 L7 50 M3 46 L11 46" strokeWidth="2" />
      </g>
      {/* skull, tipped back */}
      <g transform="translate(3 0) rotate(11 32 100)">
        <path d="M32 78 Q14 78 14 95 Q14 105 20 109 L20 117 Q20 121 24 121 L40 121 Q44 121 44 117 L44 109 Q50 105 50 95 Q50 78 32 78 Z" />
        <circle cx="25" cy="96" r="3.8" fill="currentColor" stroke="none" />
        <circle cx="39" cy="96" r="3.8" fill="currentColor" stroke="none" />
        <path d="M32 103 L30 107 L34 107 Z" fill="currentColor" stroke="none" />
        <path d="M28 115 L28 120 M32 115 L32 120 M36 115 L36 120" strokeWidth="2" />
        <path d="M45 80 L39 75 L41 82 Z M45 80 L51 75 L51 82 Z" strokeWidth="2" />
      </g>
      <g transform="rotate(-18 9 71)">
        <path d="M9 66 L10.5 70 L14.5 70 L11.5 72.5 L12.5 76.5 L9 74 L5.5 76.5 L6.5 72.5 L3.5 70 L7.5 70 Z" strokeWidth="1.8" />
      </g>
      <path d="M8 96 Q14 92 15 86" strokeWidth="1.8" />
      <circle cx="55" cy="128" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="50" cy="135" r="1" fill="currentColor" stroke="none" />
      {/* cat, leaning in */}
      <g transform="translate(-3 2) rotate(-13 32 176)">
        <path d="M22 160 L17 146 L29 154 Q32 153 35 154 L47 146 L42 160 Q50 168 50 180 Q50 198 32 198 Q14 198 14 180 Q14 168 22 160 Z" />
        <ellipse cx="25" cy="176" rx="2.5" ry="4" fill="currentColor" stroke="none" />
        <ellipse cx="39" cy="176" rx="2.5" ry="4" fill="currentColor" stroke="none" />
        <path d="M32 184 L30 187 L34 187 Z" fill="currentColor" stroke="none" />
        <path d="M28 191 Q30 194 32 191 Q34 194 36 191" strokeWidth="2" />
        <path d="M6 176 L14 178 M6 184 L14 183 M58 176 L50 178 M58 184 L50 183" strokeWidth="2" />
      </g>
      <g transform="rotate(-26 56 148)">
        <path d="M56 152 Q52 148 52 145.5 Q52 143 54.2 143 Q56 143 56 144.8 Q56 143 57.8 143 Q60 143 60 145.5 Q60 148 56 152 Z" strokeWidth="2" />
      </g>
      <path d="M8 206 Q16 202 18 195 Q19 189 13 188 Q8 188 9 193 Q10 198 15 198" strokeWidth="1.8" />
      {/* bat, banking right */}
      <g transform="rotate(7 32 246)">
        <path d="M16 246 Q4 240 2 252 Q8 250 8 258 Q14 255 17 262" strokeWidth="2.5" />
        <path d="M48 246 Q60 240 62 252 Q56 250 56 258 Q50 255 47 262" strokeWidth="2.5" />
        <path d="M22 238 L18 226 L28 233 M42 238 L46 226 L36 233" />
        <circle cx="32" cy="250" r="16" />
        <circle cx="26" cy="248" r="3" fill="currentColor" stroke="none" />
        <circle cx="38" cy="248" r="3" fill="currentColor" stroke="none" />
        <path d="M28 257 L30 261 L32 257 M32 257 L34 261 L36 257" strokeWidth="2" />
      </g>
      <g transform="rotate(21 9 226)">
        <path d="M9 222 L9 230 M5 226 L13 226" strokeWidth="2" />
      </g>
      <path d="M50 224 L54 220 M53 230 L58 228" strokeWidth="1.8" />
      <circle cx="54" cy="272" r="1.4" fill="currentColor" stroke="none" />
      {/* alien, tilting away */}
      <g transform="translate(2 0) rotate(-10 32 318)">
        <path d="M26 296 Q24 290 20 289 M38 296 Q40 290 44 289" strokeWidth="2" />
        <circle cx="19" cy="288" r="2.5" strokeWidth="2" />
        <circle cx="45" cy="288" r="2.5" strokeWidth="2" />
        <path d="M32 294 Q50 294 50 314 Q50 334 32 342 Q14 334 14 314 Q14 294 32 294 Z" />
        <ellipse cx="25" cy="316" rx="4" ry="6" fill="currentColor" stroke="none" />
        <ellipse cx="39" cy="316" rx="4" ry="6" fill="currentColor" stroke="none" />
        <path d="M30 330 Q32 332 34 330" strokeWidth="2" />
      </g>
      <g transform="rotate(22 56 305)">
        <path d="M56 300 L57.5 304 L61.5 304 L58.5 306.5 L59.5 310.5 L56 308 L52.5 310.5 L53.5 306.5 L50.5 304 L54.5 304 Z" strokeWidth="1.8" />
      </g>
      <g transform="rotate(-12 8 340)">
        <path d="M8 336 L8 344 M4 340 L12 340" strokeWidth="2" />
      </g>
      {/* devil heart, scribble-shaded */}
      <g transform="translate(-2 0) rotate(15 32 396)">
        <path d="M20 376 Q16 368 12 367 Q17 366 22 370 M44 376 Q48 368 52 367 Q47 366 42 370" strokeWidth="2" />
        <path d="M32 418 Q12 400 12 386 Q12 374 22 374 Q30 374 32 382 Q34 374 42 374 Q52 374 52 386 Q52 400 32 418 Z" />
        <path d="M22 384 L28 387 M42 384 L36 387" strokeWidth="2" />
        <circle cx="25" cy="392" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="39" cy="392" r="2.5" fill="currentColor" stroke="none" />
        <path d="M28 399 L30 403 L32 399 M32 399 L34 403 L36 399" strokeWidth="2" />
        <path d="M20 396 L26 402 M24 406 L30 411" strokeWidth="1.6" />
      </g>
      <circle cx="56" cy="412" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="8" cy="380" r="1" fill="currentColor" stroke="none" />
      <path d="M54 380 L59 377 M56 388 L61 388" strokeWidth="1.8" />
      {/* bunny, head cocked */}
      <g transform="rotate(-8 32 470)">
        <path d="M24 462 Q20 440 26 437 Q31 437 30 460" />
        <path d="M38 460 Q38 440 46 437 Q53 436 52 443 Q46 442 44 452 Q43 457 43 461" />
        <ellipse cx="32" cy="482" rx="17" ry="14" />
        <circle cx="26" cy="478" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="38" cy="478" r="2.5" fill="currentColor" stroke="none" />
        <path d="M29 486 L35 486 L35 491 L29 491 Z M32 486 L32 491" strokeWidth="2" />
        <path d="M20 484 L23 482 M41 482 L44 484" strokeWidth="1.6" />
      </g>
      <g transform="rotate(-30 10 447)">
        <path d="M10 452 Q6 448 6 445.5 Q6 443 8.2 443 Q10 443 10 444.8 Q10 443 11.8 443 Q14 443 14 445.5 Q14 448 10 452 Z" strokeWidth="2" />
      </g>
      <g transform="rotate(12 56 474)">
        <path d="M56 470 L56 478 M52 474 L60 474" strokeWidth="2" />
      </g>
      <circle cx="12" cy="508" r="1.4" fill="currentColor" stroke="none" />
      <g transform="rotate(14 32 509)">
        <path d="M32 504 L33.5 508 L37.5 508 L34.5 510.5 L35.5 514.5 L32 512 L28.5 514.5 L29.5 510.5 L26.5 508 L30.5 508 Z" strokeWidth="1.8" />
      </g>
    </g>
  );
}

/* A vertical strip of crew doodles, tiled to any height. */
function DoodleCrewStrip({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} aria-hidden="true">
      <defs>
        <pattern id={id} width="64" height="520" patternUnits="userSpaceOnUse">
          <DoodleCrewTile />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
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

/* Jagged starburst, like the NEW! one overlapping the banner's sticker. */
function Starburst({ label, className, style }: { label: string; className?: string; style?: React.CSSProperties }) {
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const r = i % 2 === 0 ? 78 : 44;
    const a = 0.3 + (Math.PI * i) / 9;
    pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <span className={className} style={style} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="block h-auto w-full">
        <polygon points={pts.join(' ')} fill="#ffd400" stroke="#0c1130" strokeWidth="6" />
      </svg>
      <span className="absolute inset-0 flex -rotate-6 items-center justify-center font-display text-2xl font-black italic text-ys-pink">
        {label}
      </span>
    </span>
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

/*
 * Neon slime pouring over a section's top edge: punk drip border in the
 * brand mint, glossy clip-art style with the navy outline and a few
 * detached drops mid-fall.
 */
function SlimeDrip({ className }: { className?: string }) {
  const { id, stops } = useGloss('#14ff89');
  return (
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className={className} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <path
        d="M0 26 C30 26 40 60 60 60 C80 60 78 20 100 20 C130 20 130 44 150 44 C170 44 168 84 190 84 C212 84 205 22 230 22 C260 22 258 50 280 50 C302 50 300 18 330 18 C360 18 355 70 380 70 C405 70 400 24 430 24 C460 24 458 46 480 46 C502 46 500 90 525 90 C550 90 545 20 575 20 C605 20 600 55 625 55 C650 55 648 26 675 26 C705 26 700 74 725 74 C750 74 748 22 775 22 C805 22 800 48 825 48 C850 48 848 16 880 16 C910 16 905 62 930 62 C955 62 950 24 980 24 C1010 24 1008 52 1030 52 C1052 52 1050 88 1075 88 C1100 88 1095 20 1125 20 C1155 20 1150 44 1175 44 C1200 44 1198 70 1225 70 C1252 70 1245 18 1275 18 C1305 18 1300 50 1325 50 C1350 50 1348 28 1375 28 C1405 28 1402 58 1420 58 C1435 58 1438 30 1440 26 L1440 0 L0 0 Z"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <circle cx="192" cy="102" r="5" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" />
      <circle cx="527" cy="106" r="7" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" />
      <circle cx="1077" cy="104" r="6" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" />
      <ellipse cx="130" cy="9" rx="34" ry="4" fill="#ffffff" opacity="0.45" />
      <ellipse cx="700" cy="9" rx="40" ry="4" fill="#ffffff" opacity="0.45" />
      <ellipse cx="1240" cy="9" rx="30" ry="4" fill="#ffffff" opacity="0.45" />
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
const STICKERS = ['heart', 'star', 'skull', 'cat', 'devil', 'bolt', 'note', 'broken'] as const;

function patternStyle(pattern: (typeof PATTERNS)[number]): React.CSSProperties {
  if (pattern === 'checker') {
    return {
      background:
        'repeating-conic-gradient(rgb(12 17 48 / 0.1) 0% 25%, rgb(255 255 255 / 0.5) 0% 50%) 0 0 / 18px 18px, #e7d9ff',
    };
  }
  if (pattern === 'stripes') {
    return {
      background:
        'repeating-linear-gradient(45deg, rgb(12 17 48 / 0.07) 0 8px, transparent 8px 22px), #e7d9ff',
    };
  }
  return { background: '#e7d9ff' };
}

function DemoSticker({ kind, accent, className }: { kind: (typeof STICKERS)[number]; accent: string; className?: string }) {
  if (kind === 'heart') return <GlossyHeart color={accent} className={className} />;
  if (kind === 'star') return <GlossyStar color={accent} className={className} />;
  if (kind === 'cat') return <Cat color={accent} className={className} />;
  if (kind === 'devil') return <DevilHeart color={accent} className={className} />;
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
  const [about, setAbout] = useState('hi !! this is ur demo page. every block on it can be moved, restyled, or deleted: that’s the whole editor.');
  const [links, setLinks] = useState(['my blog', 'my pics', 'zap me !!']);
  const [blocks, setBlocks] = useState(['header', 'about', 'links', 'music']);
  const [glitter, setGlitter] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragBlock = useRef<string | null>(null);

  /* The accent, deepened so it reads as text and borders on the pastel cards. */
  const accentDark = darken(accent, 0.25);

  /* Drag a block by its grip onto another block: it lands before it. */
  const dropProps = (target: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(target);
    },
    onDragLeave: () => setDropTarget((t) => (t === target ? null : t)),
    onDrop: () => {
      const dragged = dragBlock.current;
      dragBlock.current = null;
      setDropTarget(null);
      if (!dragged || dragged === target) return;
      setBlocks((cur) => {
        const next = cur.filter((b) => b !== dragged);
        next.splice(next.indexOf(target), 0, dragged);
        return next;
      });
    },
  });

  useSeoMeta({
    title: 'YourSpace: Build a homepage that is actually yours',
    description:
      'Where nostalgia meets innovation. Design your own homepage with drag-and-drop blocks and publish it to Nostr as an nsite: no platform, no takedowns, no algorithm.',
  });

  return (
    <div className="ys-min-below-bar overflow-x-hidden bg-ys-grape text-white">
      {/*
        The hero is the banner's content, live: the wordmark huge on the
        left, the ghost free on the right with the rainbow overhead and a
        starburst on its corner, deco at the corners and edges only, and the
        marquee at the foot. Motion is a two-frame twinkle.
      */}
      <div className="ys-sky relative overflow-hidden">
        <ShootingStar className="absolute top-[4%] left-[2%] w-36 sm:w-44" />
        <div className="absolute top-[10%] right-[4%] rotate-12" aria-hidden="true">
          <GlossyHeart color="#ff2d9e" className="w-9 sm:w-12" />
          <Sparkle color="#ffffff" className="ys-twinkle absolute -left-4 -top-2 w-5" style={{ animationDelay: '0.4s' }} />
        </div>
        <div className="absolute bottom-[30%] left-[2%] hidden rotate-6 sm:block" aria-hidden="true">
          <Bolt color="#ffd400" className="w-10" />
          <Sparkle color="#8fe800" className="absolute -right-4 top-8 w-5" />
        </div>
        <div className="absolute right-[3%] bottom-[26%] hidden -rotate-12 sm:block" aria-hidden="true">
          <Note color="#b14dff" className="w-12" />
          <Sparkle color="#ff2d9e" className="ys-twinkle absolute -left-5 top-7 w-5" style={{ animationDelay: '0.7s' }} />
        </div>
        <Bat className="absolute top-[42%] right-[2%] hidden w-14 -rotate-12 lg:block" />
        <Sparkle color="#ffffff" className="ys-twinkle absolute bottom-[18%] left-[36%] hidden w-6 lg:block" style={{ animationDelay: '0.2s' }} />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-20 sm:pt-16 sm:pb-24">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-4">
            <div className="flex-1 text-center lg:text-left">
              <h1 aria-label="YourSpace" className="-rotate-2 select-none">
                <span aria-hidden="true" className="inline-block">
                  {WORDMARK.map((letter, i) => (
                    <span
                      key={i}
                      className={`ys-outline inline-block font-display text-6xl font-black italic sm:text-8xl lg:text-9xl ${letter.color}`}
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
                remember when ur homepage was something u made? bring it back: stack some
                blocks, glitter it up however u like, and publish it to nostr. it's urs
                4ever: no takedowns, no algorithm, no corporate overlords.
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

            {/* The ghost, free: rainbow overhead, starburst on its corner */}
            <div className="relative shrink-0 pt-10 lg:pt-0">
              <Rainbow className="absolute -top-40 -right-16 hidden w-72 rotate-3 lg:block" />
              <Skull className="absolute -left-24 top-0 hidden w-16 -rotate-6 lg:block" />
              <img
                src="/icon.svg"
                alt="The YourSpace ghost, holding a heart"
                className="relative w-52 -rotate-3 drop-shadow-[0_18px_24px_rgb(12_17_48/0.5)] sm:w-64 lg:w-80"
              />
              <Starburst label="NEW!" className="absolute -top-10 -right-10 w-24 sm:w-28" />
            </div>
          </div>
        </div>

        {/* Zebra ribbon, then the marquee: the banner's foot, attached */}
        <div className="relative overflow-hidden" aria-hidden="true">
          <ZebraStrip className="block h-10 w-full -rotate-1 scale-x-110 sm:h-12" />
        </div>
        <Marquee />
      </div>

      {/*
        Published homepages, on the app's own surface rather than the brand
        one: these are other people's pages, and they read better against a
        neutral background than on the sky.
      */}
      <section className="relative overflow-hidden bg-background px-6 py-20 text-foreground">
        {/* Lined notebook paper: ruled lines, a margin line, ballpoint doodles */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(90deg, transparent 80px, rgb(255 45 158 / 0.16) 80px, rgb(255 45 158 / 0.16) 82px, transparent 82px), repeating-linear-gradient(transparent 0 31px, rgb(77 124 255 / 0.14) 31px 32px)',
          }}
        />
        {/* The border, doodled corner to corner like a bored study period */}
        <div className="pointer-events-none absolute inset-0 text-[#8429e0]" aria-hidden="true">
          <DoodleCrewStrip className="absolute inset-y-0 left-0 h-full w-16" />
          <DoodleBorderStrip className="absolute inset-y-0 right-0 hidden h-full w-16 -scale-x-100 sm:block" />
          <DoodleBorderStrip horizontal className="absolute top-0 right-16 hidden h-16 w-[520px] md:block" />
          <DoodleBorderStrip horizontal className="absolute bottom-0 right-16 hidden h-16 w-[520px] -scale-y-100 md:block" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-10">
            <h2 className="mb-0 font-display text-4xl font-black italic tracking-tight sm:text-5xl">
              other people’s spaces
              <Alien className="ml-3 inline-block w-9 -rotate-6 align-[-0.3em] sm:w-11" />
            </h2>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              browse the latest homepages published to nostr
            </p>
          </div>

          <NsiteShowcase />
        </div>
      </section>

      {/*
        The demo. No feature lists: a little page built from blocks, and the
        visitor works it directly: drag blocks by their grips, type in the
        boxes, restyle it from the sidebar. The wallpaper is the punk
        retro-internet image from branding/.
      */}
      <section className="ys-section-img relative overflow-hidden px-6 pb-24 pt-32">
        <SlimeDrip className="absolute inset-x-0 top-0 h-24 w-full" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="ys-outline mb-4 font-display text-4xl font-black italic text-white sm:text-6xl">
              make it urs !!
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-ys-lavender">
              this page is built from blocks, the way urs will be. drag a block by its
              grip to move it, type in its boxes, restyle it:
            </p>
          </div>

          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-stretch lg:justify-center">
            {/* The demo page itself */}
            <div className="ys-card-pastel flex w-full max-w-md flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b-[3px] border-ys-edge bg-[#1b2350] px-4 py-2.5">
                <span className="font-display text-sm font-bold italic text-ys-lavender">demo-page.html</span>
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#c9cfe8]" />
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#c9cfe8]" />
                  <span className="inline-block size-3 rounded-[3px] border border-ys-edge bg-[#ff2d9e]" />
                </span>
              </div>

              {pattern === 'zebra' && <ZebraStrip className="block h-6 w-full" />}

              <div className="relative flex flex-1 flex-col justify-center space-y-4 p-5 transition-colors" style={patternStyle(pattern)}>
                {glitter && (
                  <>
                    <Sparkle color="#ffffff" className="ys-twinkle absolute top-2 right-3 z-10 w-4" />
                    <Sparkle color={accent} className="ys-twinkle absolute bottom-3 right-6 z-10 w-5" style={{ animationDelay: '0.5s' }} />
                    <Sparkle color="#ffffff" className="ys-twinkle absolute top-10 left-4 z-10 w-3" style={{ animationDelay: '0.3s' }} />
                    <Sparkle color={accent} className="ys-twinkle absolute bottom-10 left-8 z-10 w-4" style={{ animationDelay: '0.8s' }} />
                    <Sparkle color="#ffffff" className="ys-twinkle absolute top-1/2 right-2 z-10 w-3" style={{ animationDelay: '0.6s' }} />
                    <Sparkle color={accent} className="ys-twinkle absolute top-1/3 left-1/2 z-10 w-3" style={{ animationDelay: '0.9s' }} />
                    <Sparkle color="#ffffff" className="ys-twinkle absolute bottom-6 left-1/3 z-10 w-3" style={{ animationDelay: '0.2s' }} />
                    <Sparkle color={accent} className="ys-twinkle absolute top-4 left-2/3 z-10 w-4" style={{ animationDelay: '0.7s' }} />
                  </>
                )}

                {blocks.map((block) => {
                  const shared = `relative w-full rounded-lg border-2 border-dashed bg-white p-3 pl-9 transition-colors ${
                    dropTarget === block ? 'ring-2 ring-white/80' : ''
                  }`;
                  const grip = (
                    <span
                      draggable
                      onDragStart={(e) => {
                        dragBlock.current = block;
                        e.dataTransfer.setData('text/plain', block);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        dragBlock.current = null;
                        setDropTarget(null);
                      }}
                      title="Drag to rearrange"
                      aria-label={`Drag the ${block} block to rearrange`}
                      className="absolute inset-y-0 left-0 z-10 flex w-7 cursor-grab items-center justify-center rounded-l-md bg-ys-edge/5 text-ys-edge/60 hover:bg-ys-edge/10 hover:text-ys-navy active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" aria-hidden="true" />
                    </span>
                  );
                  if (block === 'header') {
                    return (
                      <div key="header" {...dropProps('header')} className={shared} style={{ borderColor: accentDark }}>
                        {grip}
                        <span className="flex items-center gap-3 pr-5">
                          <img
                            src="/icon.svg"
                            alt=""
                            aria-hidden="true"
                            className="w-14 rounded-lg border-2 bg-ys-purple transition-colors"
                            style={{ borderColor: accentDark }}
                          />
                          <span className="min-w-0 flex-1">
                            <input
                              value={name}
                              maxLength={24}
                              onChange={(e) => setName(e.target.value)}
                              aria-label="Page name"
                              placeholder="ur demo page"
                              className="w-full truncate rounded bg-transparent font-display text-xl font-black italic transition-colors focus:outline-none focus:ring-2 focus:ring-ys-edge/25"
                              style={{ color: accentDark }}
                            />
                            <span className="flex items-center gap-1.5 text-xs text-ys-dusk">
                              <span className="inline-block size-2 rounded-full bg-[#2ee86c]" aria-hidden="true" />
                              online now!
                            </span>
                          </span>
                          <DemoSticker kind={sticker} accent={accent} className="w-10 shrink-0 rotate-6" />
                        </span>
                      </div>
                  );
                }
                if (block === 'about') {
                  return (
                    <div key="about" {...dropProps('about')} className={shared} style={{ borderColor: accentDark }}>
                      {grip}
                      <textarea
                        value={about}
                        rows={3}
                        onChange={(e) => setAbout(e.target.value)}
                        aria-label="About me text"
                        className="w-full resize-none rounded bg-transparent pr-5 text-sm leading-relaxed text-ys-dusk focus:outline-none focus:ring-2 focus:ring-ys-edge/25"
                      />
                    </div>
                  );
                }
                if (block === 'links') {
                  return (
                    <div
                      key="links"
                      {...dropProps('links')}
                      className={`${shared} flex flex-wrap gap-2 pr-5`}
                      style={{ borderColor: accentDark }}
                    >
                      {grip}
                      {links.map((label, i) => (
                        <input
                          key={i}
                          value={label}
                          maxLength={14}
                          onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))}
                          aria-label={`Link ${i + 1} label`}
                          className="rounded-full px-3 py-1.5 text-center font-display text-sm font-extrabold italic text-ys-navy transition-colors focus:outline-none focus:ring-2 focus:ring-ys-navy"
                          style={{ backgroundColor: accent, width: `${Math.max(label.length + 2, 6)}ch` }}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <div
                    key="music"
                    {...dropProps('music')}
                    className={`${shared} flex items-center gap-2 pr-5 text-sm text-ys-dusk`}
                    style={{ borderColor: accentDark }}
                  >
                    {grip}
                    <Note color={accentDark} className="w-6 shrink-0 transition-colors" />
                    now playing: something emo
                  </div>
                );
              })}
              </div>
            </div>

            {/* The controls, on their own glossy panel so they read over the wallpaper */}
            <div className="ys-card-pastel w-full max-w-md space-y-5 p-5 lg:max-w-60">
              <div>
                <p className="mb-2 font-display text-lg font-extrabold italic text-ys-navy">color</p>
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
                <p className="mb-2 font-display text-lg font-extrabold italic text-ys-navy">background</p>
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
                <p className="mb-2 font-display text-lg font-extrabold italic text-ys-navy">sticker</p>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Page sticker">
                  {STICKERS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSticker(k)}
                      aria-label={`Sticker ${k}`}
                      aria-pressed={sticker === k}
                      className={`flex size-11 items-center justify-center rounded-full border-[3px] border-ys-edge bg-white/70 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        sticker === k ? 'ring-4 ring-white' : ''
                      }`}
                    >
                      <DemoSticker kind={k} accent={accent} className="w-7" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-display text-lg font-extrabold italic text-ys-navy">glitter</p>
                <button
                  type="button"
                  onClick={() => setGlitter((g) => !g)}
                  aria-pressed={glitter}
                  className="rounded-full border-[3px] border-ys-edge px-5 py-1.5 font-display text-sm font-extrabold italic transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{ backgroundColor: glitter ? '#14ff89' : 'rgb(255 255 255 / 0.7)', color: '#131a3a' }}
                >
                  {glitter ? 'on !!' : 'off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="relative bg-[#14ff89]">
        <Bunny className="absolute top-1/2 left-[12%] w-20 -translate-y-1/2 -rotate-6 sm:w-36" />
        <DevilHeart className="absolute top-1/2 right-[12%] w-16 -translate-y-1/2 rotate-12 sm:w-32" />

        <div className="overflow-hidden" aria-hidden="true">
          <ZebraStrip className="block h-10 w-full rotate-1 scale-x-110 sm:h-12" />
        </div>

        <div className="px-6 py-24">
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="ys-outline relative z-10 mb-10 font-display text-4xl font-black italic text-white sm:text-6xl">
              your space is waiting...
            </h2>

            {user ? (
              <Link
                to="/edit"
                className="ys-gel relative z-10 px-10 py-4 text-2xl"
                style={{ background: 'linear-gradient(180deg, #dcb0ff 0%, #b14dff 55%, #8a2bd9 100%)' }}
              >
                start building
              </Link>
            ) : (
              <div className="relative z-10 flex justify-center">
                <LoginArea className="w-full max-w-xs" />
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-ys-edge px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-sm text-ys-dusk sm:flex-row sm:justify-between sm:text-left">
          <Logo className="text-white" />
          <p>
            built on{' '}
            <a
              href="https://github.com/nostr-protocol/nips"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4 hover:text-ys-pink"
            >
              nostr
            </a>{' '}
            and nsites (NIP-5A).
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
