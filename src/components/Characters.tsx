import { useId } from 'react';

/*
 * The character crew: cute-punk mascots drawn exactly like their sources in
 * branding/generate.mjs (charCat, charBat, charAlien, charDevil, charBunny).
 * Same recipe as the ghost: glossy gradient body, thick navy outline, shiny
 * navy eyes, pink blush. All decorative, all hidden from the accessibility
 * tree.
 */

type CharProps = { color?: string; className?: string; style?: React.CSSProperties };

function lighten(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * f);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

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

/* The shared face: shiny navy eyes and pink blush; the mouth varies. */
function Face({
  eyeY = 46,
  eyeDx = 12,
  eyeRx = 8,
  eyeRy = 12,
  blushY = 58,
  blushDx = 22,
  blushRx = 7,
}: {
  eyeY?: number;
  eyeDx?: number;
  eyeRx?: number;
  eyeRy?: number;
  blushY?: number;
  blushDx?: number;
  blushRx?: number;
}) {
  return (
    <>
      <ellipse cx={50 - eyeDx} cy={eyeY} rx={eyeRx} ry={eyeRy} fill="#131a3a" />
      <ellipse cx={50 + eyeDx} cy={eyeY} rx={eyeRx} ry={eyeRy} fill="#131a3a" />
      <circle cx={50 - eyeDx - 3} cy={eyeY - 4} r="3" fill="#ffffff" />
      <circle cx={50 + eyeDx - 3} cy={eyeY - 4} r="3" fill="#ffffff" />
      <ellipse cx={50 - blushDx} cy={blushY} rx={blushRx} ry="4" fill="#ff2d9e" opacity="0.55" />
      <ellipse cx={50 + blushDx} cy={blushY} rx={blushRx} ry="4" fill="#ff2d9e" opacity="0.55" />
    </>
  );
}

/* Punk kitty: hoop earring, whiskers. Takes the accent color. */
export function Cat({ color = '#b14dff', className, style }: CharProps) {
  const { id, stops } = useGloss(color);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <path
        d="M22 38 L15 8 L40 21 C43 20 57 20 60 21 L85 8 L78 38 C83 45 86 53 86 62 C86 81 70 92 50 92 C30 92 14 81 14 62 C14 53 17 45 22 38 Z"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M25 30 L21 14 L34 21 Z" fill="#ff2d9e" opacity="0.8" />
      <path d="M75 30 L79 14 L66 21 Z" fill="#ff2d9e" opacity="0.8" />
      <path d="M4 54 Q13 55 21 57 M6 64 Q14 63 21 62" fill="none" stroke="#131a3a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M96 54 Q87 55 79 57 M94 64 Q86 63 79 62" fill="none" stroke="#131a3a" strokeWidth="2.5" strokeLinecap="round" />
      <Face eyeY={50} blushY={63} blushDx={24} />
      <path d="M46 59 L54 59 L50 64 Z" fill="#ff2d9e" stroke="#131a3a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M44 67 Q47 71 50 67 Q53 71 56 67" fill="none" stroke="#131a3a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* Baby bat: night-purple, scallop wings, tiny fangs. */
export function Bat({ className, style }: CharProps) {
  const { id, stops } = useGloss('#2a1245');
  const wing = 'M42 46 Q8 24 0 60 Q13 53 15 70 Q26 61 30 78 Q37 69 45 73 Z';
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <path d={wing} fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" strokeLinejoin="round" />
      <g transform="scale(-1 1) translate(-100 0)">
        <path d={wing} fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" strokeLinejoin="round" />
      </g>
      <path d="M32 36 L26 12 L46 24 Z" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" strokeLinejoin="round" />
      <path d="M68 36 L74 12 L54 24 Z" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="50" cy="54" r="31" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" />
      <Face eyeY={50} blushY={62} blushDx={19} blushRx={6} />
      <path d="M44 62 Q47 66 50 62 Q53 66 56 62" fill="none" stroke="#d9c8ff" strokeWidth="3" strokeLinecap="round" />
      <path d="M43.5 62.5 L46 70 L48.5 64 Z" fill="#ffffff" stroke="#d9c8ff" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M51.5 64 L54 70 L56.5 62.5 Z" fill="#ffffff" stroke="#d9c8ff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* Mall-goth martian: lime, cyan antenna balls. */
export function Alien({ className, style }: CharProps) {
  const lime = useGloss('#8fe800');
  const cyan = useGloss('#00d9ff');
  return (
    <svg viewBox="0 -3 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={lime.id} stops={lime.stops} />
      <Gloss id={cyan.id} stops={cyan.stops} />
      <path d="M40 12 Q34 4 29 3" fill="none" stroke="#0c1130" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 12 Q66 4 71 3" fill="none" stroke="#0c1130" strokeWidth="4" strokeLinecap="round" />
      <circle cx="27" cy="4" r="6" fill={`url(#${cyan.id})`} stroke="#0c1130" strokeWidth="4" />
      <circle cx="73" cy="4" r="6" fill={`url(#${cyan.id})`} stroke="#0c1130" strokeWidth="4" />
      <path
        d="M50 10 C72 10 86 26 86 45 C86 68 68 90 50 90 C32 90 14 68 14 45 C14 26 28 10 50 10 Z"
        fill={`url(#${lime.id})`}
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <Face eyeY={46} eyeDx={15} eyeRx={10} eyeRy={14} blushY={62} blushDx={24} />
      <path d="M44 66 Q47 70 50 66 Q53 70 56 66" fill="none" stroke="#131a3a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* Heartbreaker devil: horns, angry brows, fangs. Takes the accent color. */
export function DevilHeart({ color = '#ff2d9e', className, style }: CharProps) {
  const { id, stops } = useGloss(color);
  const yellow = useGloss('#ffd400');
  return (
    <svg viewBox="0 -6 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <Gloss id={yellow.id} stops={yellow.stops} />
      <path
        d="M50 30 C50 12 32 4 22 13 C10 24 12 42 26 54 L50 78 L74 54 C88 42 90 24 78 13 C68 4 50 12 50 30 Z"
        fill={`url(#${id})`}
        stroke="#0c1130"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M22 17 C16 7 18 -3 27 -4 C25 4 28 11 34 14 Z" fill={`url(#${yellow.id})`} stroke="#0c1130" strokeWidth="4" strokeLinejoin="round" />
      <path d="M78 17 C84 7 82 -3 73 -4 C75 4 72 11 66 14 Z" fill={`url(#${yellow.id})`} stroke="#0c1130" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="33" cy="27" rx="11" ry="7" fill="#ffffff" opacity="0.55" transform="rotate(-22 33 27)" />
      <path d="M30 20 L42 25" fill="none" stroke="#131a3a" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M70 20 L58 25" fill="none" stroke="#131a3a" strokeWidth="3.5" strokeLinecap="round" />
      <Face eyeY={38} eyeDx={13} eyeRx={7} eyeRy={10} blushY={49} blushDx={24} blushRx={6} />
      <path d="M44 52 Q47 56 50 52 Q53 56 56 52" fill="none" stroke="#131a3a" strokeWidth="3" strokeLinecap="round" />
      <path d="M43.5 52.5 L46 60 L48.5 54 Z" fill="#ffffff" stroke="#131a3a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M51.5 54 L54 60 L56.5 52.5 Z" fill="#ffffff" stroke="#131a3a" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* Emo bunny: one flopped ear with a hoop, buck teeth. */
export function Bunny({ className, style }: CharProps) {
  const { id, stops } = useGloss('#d9c8ff');
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <Gloss id={id} stops={stops} />
      <path d="M32 44 C24 18 28 4 37 4 C45 4 47 20 45 44 Z" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" strokeLinejoin="round" />
      <path d="M35 36 C32 20 33 12 37 11 C40 11 41 22 40 36 Z" fill="#ff2d9e" opacity="0.6" />
      <path d="M55 44 C55 20 60 6 70 4 C80 2 88 8 86 14 C79 10 71 14 68 24 C66 31 66 38 66 44 Z" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="50" cy="64" rx="35" ry="29" fill={`url(#${id})`} stroke="#0c1130" strokeWidth="5" />
      <Face eyeY={60} blushY={72} blushDx={25} />
      <path d="M44 72 Q47 76 50 72 Q53 76 56 72" fill="none" stroke="#131a3a" strokeWidth="3" strokeLinecap="round" />
      <rect x="45" y="74" width="10" height="8" rx="2" fill="#ffffff" stroke="#131a3a" strokeWidth="2" />
      <path d="M50 74 L50 82" stroke="#131a3a" strokeWidth="1.5" />
    </svg>
  );
}
