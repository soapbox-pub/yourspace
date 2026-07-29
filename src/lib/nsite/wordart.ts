import type { Component, Editor } from 'grapesjs';

/**
 * Word art: a line of text wearing a preset.
 *
 * The point of it is that the effect is *chosen*, not assembled. Every one of
 * these could be built out of the element panel's own fields — a gradient, a
 * clip, four text shadows and a skew — but nobody arrives at chrome lettering
 * by typing `-webkit-background-clip: text` into a box. The gallery is the
 * feature; the CSS underneath it is an implementation detail the user never has
 * to meet.
 *
 * Which is also why a preset is applied by writing plain properties onto the
 * component rather than by adding a class. The page ships as standalone HTML
 * with no stylesheet of ours alongside it, so an effect that lived in a class
 * would need that class published too — and would then be one more thing to
 * keep in step when a page is imported back. Written as properties, the styles
 * are simply part of the element, and a word art heading that reaches a browser
 * we have never heard of still looks like itself.
 */

/**
 * What marks word art in the stored HTML, and which preset it is wearing.
 *
 * An attribute for the reason the layout and napplet types use one: the page is
 * serialized and re-parsed on every page switch, every code-panel edit and
 * every import, and an attribute is the only thing that survives all of them.
 * The styles alone could not be read back into a preset — a user who nudges the
 * font size has not stopped using Chrome — so the choice is recorded rather
 * than inferred.
 */
const WORDART_ATTR = 'data-wordart';

export const WORDART_TYPE = 'wordart';

/** The text a freshly dropped block carries. */
const DEFAULT_TEXT = 'Word Art';

/**
 * Font stacks, all web-safe.
 *
 * Nothing here reaches for the font installer. A preset that needed a
 * downloaded face would be a preset that renders as plain Arial for as long as
 * the download takes and forever if it fails — and the whole appeal is that the
 * effect is there the instant you pick it. Impact in particular is the shape
 * this kind of lettering is built on, and it has shipped with every desktop OS
 * for twenty-five years.
 */
const IMPACT = "Impact, 'Haettenschweiler', 'Franklin Gothic Bold', 'Arial Narrow Bold', sans-serif";
const COMIC = "'Comic Sans MS', 'Chalkboard SE', 'Segoe Print', cursive";
const GROTESK = "'Trebuchet MS', 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Every property a preset is allowed to set.
 *
 * Switching preset clears the whole list before writing the new one, so an
 * effect never inherits half of the one before it — the gradient left behind by
 * Chrome would otherwise sit underneath Neon's glow, and Wave's skew would
 * follow you into every preset after it. Anything not on this list is the
 * user's: the font size, the alignment, the margins, and whatever else the
 * element panel wrote.
 */
const WORDART_PROPS = [
  'font-family',
  'font-weight',
  'font-style',
  'letter-spacing',
  'color',
  'background-image',
  'background-clip',
  '-webkit-background-clip',
  '-webkit-text-fill-color',
  '-webkit-text-stroke',
  'text-shadow',
  'filter',
  'transform',
  'transform-origin',
] as const;

/**
 * The styles a word art block carries whatever preset it wears.
 *
 * `inline-block` so the box is the width of the words rather than the width of
 * the page, which is what makes centring it and sizing it behave the way the
 * lettering looks like it should. Written once into the markup and never
 * touched again, so the element panel can override any of it.
 */
const BASE_STYLE: Record<string, string> = {
  display: 'inline-block',
  margin: '0',
  'font-size': '56px',
  'line-height': '1.2',
  // A long enough phrase wraps instead of running off the side of the page.
  'max-width': '100%',
};

/**
 * A solid extrusion, receding down and to the right.
 *
 * Every offset is in `em`, here and in every preset below, so that the depth of
 * the effect is a proportion of the lettering rather than a fixed number of
 * pixels — word art dragged from 56px to 140px should get *more* extrusion, not
 * the same eighth of an inch on much bigger letters. CSS paints the first
 * shadow in a list on top, so stepping the offsets up in order stacks them from
 * the face of the letter backwards.
 */
function extrude(steps: number, color: string): string {
  return Array.from({ length: steps }, (_, index) => {
    const offset = ((index + 1) / 100).toFixed(2);
    return `${offset}em ${offset}em 0 ${color}`;
  }).join(', ');
}

/**
 * An outline drawn *behind* the letters, as eight shadows around a circle.
 *
 * `-webkit-text-stroke` would be one declaration instead of eight, but it
 * straddles the edge of the glyph rather than sitting outside it, so half the
 * stroke eats into the fill — on a rounded face like Comic Sans a thick one
 * closes the counters up entirely. Shadows are painted under the fill by
 * definition, so the letter keeps its full weight and simply gains a border.
 * (Where the fill is transparent there is nothing to eat into, and the presets
 * below use the real stroke property.)
 */
function halo(em: number, color: string): string {
  return [0, 45, 90, 135, 180, 225, 270, 315]
    .map((degrees) => {
      const radians = (degrees * Math.PI) / 180;
      const x = (Math.cos(radians) * em).toFixed(3);
      const y = (Math.sin(radians) * em).toFixed(3);
      return `${x}em ${y}em 0 ${color}`;
    })
    .join(', ');
}

/**
 * Fills the letters with an image and knocks the text itself out.
 *
 * `background-clip: text` confines the element's background to the shape of its
 * glyphs; making the fill transparent is what lets it through. Both the
 * prefixed and unprefixed spellings are written because Safari still only
 * understands the first, and `color` alongside `-webkit-text-fill-color` for
 * the same reason in reverse — a browser with neither prefix property shows the
 * text as transparent rather than as an unstyled black word.
 *
 * The catch is that `text-shadow` is painted *behind* the glyph and so shows
 * straight through a transparent fill, which is why every preset here reaches
 * for `filter: drop-shadow()` instead: a filter applies to the element's
 * finished pixels, which by then are gradient in the shape of the word.
 */
function fillWith(image: string): Record<string, string> {
  return {
    'background-image': image,
    'background-clip': 'text',
    '-webkit-background-clip': 'text',
    '-webkit-text-fill-color': 'transparent',
    color: 'transparent',
  };
}

export interface WordArtStyle {
  id: string;
  /** Shown in the gallery, rendered in the style it names. */
  label: string;
  css: Record<string, string>;
}

export const wordArtStyles: WordArtStyle[] = [
  {
    id: 'rainbow',
    label: 'Rainbow',
    css: {
      'font-family': IMPACT,
      'letter-spacing': '0.01em',
      ...fillWith(
        'linear-gradient(92deg,#ff1b6b 0%,#ff8a00 20%,#ffe000 40%,#12d640 58%,#00c2ff 76%,#a12bff 100%)',
      ),
      filter: 'drop-shadow(0.03em 0.04em 0 rgba(15,23,42,0.45))',
    },
  },
  {
    id: 'chrome',
    label: 'Chrome',
    css: {
      'font-family': IMPACT,
      'letter-spacing': '0.02em',
      // The hard stop either side of the midpoint is the horizon line: metal
      // reads as metal because the reflection flips there, not because it is grey.
      ...fillWith(
        'linear-gradient(180deg,#ffffff 0%,#d7e3f0 32%,#7d8fa3 48%,#41505f 52%,#b9c9d9 62%,#ffffff 100%)',
      ),
      '-webkit-text-stroke': '0.012em #33414f',
      filter: 'drop-shadow(0 0.03em 0.01em rgba(15,23,42,0.55))',
    },
  },
  {
    id: 'gold',
    label: 'Gold',
    css: {
      'font-family': IMPACT,
      'letter-spacing': '0.02em',
      ...fillWith(
        'linear-gradient(180deg,#fff9d6 0%,#ffe985 26%,#c8912a 48%,#8a5a0b 53%,#ffd75e 66%,#fff7cf 100%)',
      ),
      '-webkit-text-stroke': '0.012em #6b4406',
      filter: 'drop-shadow(0 0.03em 0.01em rgba(69,39,3,0.55))',
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    css: {
      'font-family': GROTESK,
      'font-weight': '700',
      // Tube letters are drawn as strokes, and strokes need air between them.
      'letter-spacing': '0.08em',
      color: '#f2fdff',
      'text-shadow':
        '0 0 0.06em #ffffff, 0 0 0.18em #22d3ee, 0 0 0.4em #22d3ee, 0 0 0.8em #0ea5e9, 0 0 1.4em #2563eb',
    },
  },
  {
    id: 'fire',
    label: 'Fire',
    css: {
      'font-family': IMPACT,
      ...fillWith(
        'linear-gradient(0deg,#7f1d1d 0%,#dc2626 28%,#f97316 58%,#fbbf24 82%,#fef3c7 100%)',
      ),
      // Two filters: the glow the letters throw, then the shadow they cast.
      filter:
        'drop-shadow(0 0 0.12em rgba(249,115,22,0.75)) drop-shadow(0 0.04em 0.02em rgba(69,10,10,0.6))',
    },
  },
  {
    id: 'ice',
    label: 'Ice',
    css: {
      'font-family': IMPACT,
      ...fillWith('linear-gradient(180deg,#ffffff 0%,#dbf4ff 28%,#7dd3fc 62%,#2563eb 100%)'),
      filter:
        'drop-shadow(0 0 0.14em rgba(125,211,252,0.9)) drop-shadow(0 0.03em 0.01em rgba(30,64,175,0.45))',
    },
  },
  {
    id: 'hollow',
    label: 'Hollow',
    css: {
      'font-family': IMPACT,
      'letter-spacing': '0.03em',
      color: 'transparent',
      '-webkit-text-fill-color': 'transparent',
      '-webkit-text-stroke': '0.035em #0f172a',
    },
  },
  {
    id: 'popup',
    label: 'Pop-up',
    css: {
      'font-family': IMPACT,
      color: '#facc15',
      'text-shadow': `${extrude(9, '#b45309')}, 0.12em 0.14em 0.14em rgba(15,23,42,0.45)`,
    },
  },
  {
    id: 'retro',
    label: 'Retro',
    css: {
      'font-family': GROTESK,
      'font-weight': '700',
      'font-style': 'italic',
      'letter-spacing': '0.04em',
      ...fillWith('linear-gradient(180deg,#fef08a 0%,#fb7185 46%,#a855f7 100%)'),
      // Two hard offsets rather than one soft: the look is printed, not lit.
      filter: 'drop-shadow(0.05em 0.05em 0 #1e1b4b) drop-shadow(0.09em 0.09em 0 #f0abfc)',
    },
  },
  {
    id: 'tilt',
    label: 'Tilt',
    css: {
      'font-family': IMPACT,
      ...fillWith('linear-gradient(180deg,#93c5fd 0%,#3b82f6 45%,#1d4ed8 100%)'),
      filter: 'drop-shadow(0.03em 0.05em 0 #0b1e4d)',
      // Laid back rather than bent: a real arc needs the text on a path, and
      // that would cost the block its editable text and its reflow. Pinning the
      // origin to the baseline keeps the letters standing on the line they were
      // dropped on while the tops lean away.
      transform: 'perspective(320px) rotateX(24deg)',
      'transform-origin': 'center bottom',
    },
  },
  {
    id: 'wave',
    label: 'Wave',
    css: {
      'font-family': IMPACT,
      color: '#ec4899',
      'text-shadow': extrude(8, '#831843'),
      transform: 'skewY(-7deg) skewX(-9deg)',
    },
  },
  {
    id: 'candy',
    label: 'Candy',
    css: {
      'font-family': COMIC,
      'font-weight': '700',
      // Stripe widths in `em` for the same reason the shadows are: they are a
      // proportion of the lettering, and a barber pole scaled to 140px should
      // not be forty hairline stripes.
      ...fillWith(
        'repeating-linear-gradient(45deg,#f43f5e 0 0.12em,#fff1f2 0.12em 0.24em)',
      ),
      '-webkit-text-stroke': '0.02em #9f1239',
      filter: 'drop-shadow(0.03em 0.04em 0 rgba(159,18,57,0.5))',
    },
  },
  {
    id: 'bubble',
    label: 'Bubble',
    css: {
      'font-family': COMIC,
      'font-weight': '700',
      color: '#fde047',
      'text-shadow': `${halo(0.04, '#1e293b')}, 0.07em 0.08em 0 rgba(30,41,59,0.35)`,
    },
  },
];

export const DEFAULT_WORDART_STYLE = wordArtStyles[0].id;

/** The named preset, or the default — an unknown name is still word art. */
export function wordArtStyle(id: string): WordArtStyle {
  return wordArtStyles.find((style) => style.id === id) ?? wordArtStyles[0];
}

/**
 * The markup the palette drops onto the page.
 *
 * Nothing here is interpolated from a relay: the preset names, the CSS and the
 * placeholder text are all literals from this module, and the font stacks quote
 * with `'` while the attribute quotes with `"`, so there is nothing to escape.
 * Any future caller passing text in would have to escape it first.
 */
export function wordArtMarkup(id: string = DEFAULT_WORDART_STYLE): string {
  const style = wordArtStyle(id);
  const css = Object.entries({ ...BASE_STYLE, ...style.css })
    .map(([property, value]) => `${property}:${value}`)
    .join(';');

  return `<div ${WORDART_ATTR}="${style.id}" style="${css}">${DEFAULT_TEXT}</div>`;
}

export function isWordArt(component: Component): boolean {
  return component.get('type') === WORDART_TYPE;
}

/** Which preset this block is wearing. */
export function wordArtStyleId(component: Component): string {
  const value = component.getAttributes()[WORDART_ATTR];
  return wordArtStyle(typeof value === 'string' ? value : '').id;
}

/**
 * Wears a different preset.
 *
 * The clear-then-write is the whole reason `WORDART_PROPS` exists; see the note
 * there. Writing `''` is how GrapesJS drops a property — the key stays in the
 * bag but falsy values are skipped when the stylesheet is serialized.
 */
export function applyWordArtStyle(component: Component, id: string) {
  const style = wordArtStyle(id);
  const cleared = Object.fromEntries(WORDART_PROPS.map((property) => [property, '']));

  component.addStyle({ ...cleared, ...style.css });
  component.addAttributes({ [WORDART_ATTR]: style.id });
}

/**
 * Registered as a plugin, because `grapesjs.init` loads plugins before parsing
 * `components` — a type registered afterwards would leave the word art on an
 * already-open page parsed as an anonymous `<div>`, and the gallery would have
 * nothing to attach to.
 *
 * Extends `text` rather than `default` so the words are edited where they are,
 * by double-clicking them on the canvas. That is the only sensible way to edit
 * lettering whose whole character is its size and shape: typing into a field in
 * the side panel and looking across to see what happened is not it.
 */
export function wordArtComponents(editor: Editor) {
  editor.DomComponents.addType(WORDART_TYPE, {
    extend: 'text',

    isComponent: (el) =>
      el.tagName === 'DIV' && el.hasAttribute?.(WORDART_ATTR) ? { type: WORDART_TYPE } : undefined,

    model: {
      defaults: {
        name: 'Word art',
        tagName: 'div',
        // It is a piece of lettering, not a container. Dropping a block inside
        // one would put an element in the middle of a word.
        droppable: false,
        // The preset is picked from the gallery, which is a better control than
        // a text field holding `chrome` — and it is the only setting there is.
        traits: [],
      },
    },
  });
}
