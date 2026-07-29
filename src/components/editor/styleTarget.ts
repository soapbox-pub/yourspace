import type { Editor } from 'grapesjs';

import { toCssUrl } from '@/lib/nsite/siteHtml';

/* --------------------------------------------------------------------------
 * Style plumbing
 *
 * Values are read from and written to the component itself rather than through
 * the StyleManager, which is switched off on this page. `getStyle`/`addStyle`
 * already resolve against the active device, so a change made while the mobile
 * breakpoint is selected lands in that media query — the same behaviour the
 * stock Style Manager has.
 *
 * Shared by the inspector and the page background picker, which both write the
 * same properties to the same targets.
 * ------------------------------------------------------------------------ */

/**
 * Anything with a style bag: a component, or a bare CSS rule. The page's own
 * background is the second kind — see `pageTarget`.
 */
export interface StyleTarget {
  getStyle(): Record<string, unknown>;
  addStyle(patch: Record<string, string>): unknown;
}

export function styleValue(target: StyleTarget, prop: string): string {
  const value = target.getStyle()[prop];
  return typeof value === 'string' ? value : '';
}

/**
 * Writing `''` is how a property is cleared: GrapesJS keeps the key but skips
 * falsy values when serializing, so nothing reaches the exported CSS.
 */
export function setStyle(target: StyleTarget, patch: Record<string, string>) {
  target.addStyle(patch);
}

const PAGE_SELECTOR = 'body';

/** Everything the page's cursor has to cover. See `cursorTarget`. */
const CURSOR_SELECTOR = 'body, a';

/**
 * The page's own styles, held as a `body` rule rather than on the wrapper
 * component.
 *
 * GrapesJS is willing to style the wrapper — its `stylable` list is exactly the
 * background properties — but component styles are keyed to a generated id, and
 * the wrapper's is minted fresh for each editor session. A `#i3f{…}` rule
 * written today would match nothing when the site is opened again tomorrow,
 * because the `<body id>` it refers to is dropped when a stored page is unwrapped
 * for the canvas. `body{…}` has neither problem: it is the element the canvas
 * frame already is, and it means the same thing in the published file.
 */
export function pageTarget(editor: Editor): StyleTarget {
  return {
    getStyle: () => editor.Css.getRule(PAGE_SELECTOR)?.getStyle() ?? {},
    addStyle: (patch) =>
      (editor.Css.getRule(PAGE_SELECTOR) ?? editor.Css.setRule(PAGE_SELECTOR, {})).addStyle(patch),
  };
}

/**
 * The page's cursor, which needs a wider rule than the rest of the page's
 * styles and so gets one of its own.
 *
 * `cursor` inherits, so `body{…}` reaches almost everything — but inheritance
 * only applies where nothing else matches, and browsers ship `a:any-link {
 * cursor: pointer }` in their own stylesheet. Author rules beat the user agent
 * whatever their specificity, so naming `a` at all is enough; not naming it
 * leaves every link on the page wearing the arrow while the text between them
 * wears the choice, which reads as a bug rather than as a decision.
 *
 * Form fields are left out on purpose. Their cursors say where you can type and
 * that is worth more than the effect, which is the same reason the caret is
 * still a caret inside a text box on a page that has set one.
 *
 * Kept apart from `pageTarget` rather than folded into it because a grouped
 * selector is one rule to GrapesJS: `body, a{…}` is parsed back as itself, and
 * the properties written there would be invisible to a `getRule('body')` — so
 * the two targets read and write cleanly past each other.
 */
export function cursorTarget(editor: Editor): StyleTarget {
  return {
    getStyle: () => editor.Css.getRule(CURSOR_SELECTOR)?.getStyle() ?? {},
    addStyle: (patch) =>
      (editor.Css.getRule(CURSOR_SELECTOR) ?? editor.Css.setRule(CURSOR_SELECTOR, {})).addStyle(
        patch,
      ),
  };
}

/* --------------------------------------------------------------------------
 * Background
 * ------------------------------------------------------------------------ */

/** Values that stand in for an image: a file, a gradient, or nothing. */
const IMAGE_VALUE = /^(url|[a-z-]*gradient|image-set|cross-fade|element)\(|^none$/i;

/**
 * Splits a `background` shorthand into the two parts this panel edits.
 *
 * Returns null for anything richer, in the same spirit as `parseBoxShorthand`:
 * a shorthand carrying a position, a size or a repeat alongside its colour
 * cannot become two longhands without dropping the rest.
 */
function parseBackgroundShorthand(value: string): { color: string; image: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // One bare token (`#fff`, `red`, `transparent`), or one function call
  // (`rgb(…)`, `linear-gradient(…)`) with nothing after it.
  const single = /^[^\s(]+$/.test(trimmed) || /^[a-z-]+\(.*\)$/is.test(trimmed);
  if (!single) return null;

  return IMAGE_VALUE.test(trimmed) ? { color: '', image: trimmed } : { color: trimmed, image: '' };
}

/** Longhand wins where present, otherwise fall back to the shorthand. */
export function backgroundValues(target: StyleTarget): { color: string; image: string } {
  const shorthand = parseBackgroundShorthand(styleValue(target, 'background'));
  return {
    color: styleValue(target, 'background-color') || shorthand?.color || '',
    image: styleValue(target, 'background-image') || shorthand?.image || '',
  };
}

/**
 * Edits collapse the shorthand into longhands, for the reason `setBoxSide`
 * does: a `background` declaration left in the rule would reset whichever of
 * the colour and the image was not just written. A shorthand too rich to split
 * is lost at that point, which is why nothing here writes one back.
 */
export function setBackground(target: StyleTarget, patch: Record<string, string>) {
  const { color, image } = backgroundValues(target);
  setStyle(target, {
    background: '',
    'background-color': color,
    'background-image': image,
    ...patch,
  });
}

/** How an image covers its element. */
export type BackgroundFit = 'cover' | 'contain' | 'tile';

/** CSS repeats a background at its natural size by default, which is a tile. */
export function backgroundFit(target: StyleTarget): BackgroundFit {
  const size = styleValue(target, 'background-size').trim().toLowerCase();
  return size === 'cover' || size === 'contain' ? size : 'tile';
}

export const fitPatches: Record<BackgroundFit, Record<string, string>> = {
  cover: {
    'background-size': 'cover',
    'background-repeat': 'no-repeat',
    'background-position': 'center',
  },
  contain: {
    'background-size': 'contain',
    'background-repeat': 'no-repeat',
    'background-position': 'center',
  },
  // Cleared rather than set to `auto` / `0 0`: those are the CSS defaults, and
  // a declaration that changes nothing is noise in the exported stylesheet.
  tile: { 'background-size': '', 'background-repeat': 'repeat', 'background-position': '' },
};

/** Every background property a picked image writes, cleared. */
export const noImagePatch: Record<string, string> = {
  'background-image': '',
  'background-size': '',
  'background-repeat': '',
  'background-position': '',
};

/**
 * What the user typed, as a `background-image` value.
 *
 * A gradient is as much a background image as a file is, and the free-text
 * fields elsewhere in this panel already take CSS, so anything that reads as an
 * image value is kept as written. The rest is treated as a URL, and has to
 * survive the scheme allowlist to be used.
 */
export function toBackgroundImage(input: string): string {
  const value = input.trim();
  if (!value) return '';
  return IMAGE_VALUE.test(value) ? value : toCssUrl(value);
}
