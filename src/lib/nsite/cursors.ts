import { toCssUrl } from './siteHtml';

/**
 * Ready-made mouse pointers, offered as one-click tiles in the page panel.
 *
 * Every preset is a CSS keyword rather than a picture, which is what makes the
 * list worth having. A keyword cursor is drawn by the operating system, so it
 * arrives sharp on a retina screen, respects whatever the person browsing has
 * set as their pointer size, and cannot fail to load. An image cursor is a file
 * that has to be small enough for the browser to accept — and when it isn't,
 * nothing is reported and the arrow simply stays an arrow. That case is still
 * reachable under "Custom"; it just isn't what the gallery is made of.
 *
 * Nothing here claims the page is broken or busy when it isn't. `wait` and
 * `not-allowed` are as available to anyone writing their own CSS as they have
 * always been, but a page-wide "no entry" sign is a joke told to visitors
 * rather than to yourself — and the canvas wears the choice while you are still
 * editing, so it would be told to you for an hour first.
 */
export interface CursorPreset {
  id: string;
  /** Named for what it looks like rather than for the CSS keyword. */
  label: string;
  /** The `cursor` value. Empty clears the property, restoring the default. */
  value: string;
}

export const cursorPresets: CursorPreset[] = [
  { id: 'normal', label: 'Normal', value: '' },
  { id: 'pointer', label: 'Hand', value: 'pointer' },
  { id: 'crosshair', label: 'Crosshair', value: 'crosshair' },
  { id: 'text', label: 'Text', value: 'text' },
  { id: 'help', label: 'Help', value: 'help' },
  { id: 'grab', label: 'Grab', value: 'grab' },
  { id: 'move', label: 'Move', value: 'move' },
  { id: 'zoom-in', label: 'Zoom', value: 'zoom-in' },
  { id: 'cell', label: 'Cell', value: 'cell' },
  { id: 'copy', label: 'Copy', value: 'copy' },
  { id: 'progress', label: 'Busy', value: 'progress' },
];

/**
 * An image as a `cursor` value, or `''` when the URL isn't one this app will
 * write.
 *
 * The trailing keyword is not decoration: `cursor: url(...)` on its own is
 * invalid and the whole declaration is dropped, so a cursor that failed to
 * download would take the rest of the rule with it. `auto` is the value the
 * property already had, which makes the fallback invisible when it is used.
 *
 * No hotspot is given, so the browser points with the image's top-left corner.
 * That is right for anything arrow-shaped and wrong for a crosshair, but the
 * alternative is two number fields in a panel that is otherwise all pictures,
 * asked of someone who has not yet been told what a hotspot is.
 */
export function toCursorImage(url: string): string {
  const value = toCssUrl(url);
  return value ? `${value}, auto` : '';
}

/**
 * The image URL inside a cursor value, or `''`.
 *
 * Deliberately not `parseCssUrl`, which wants the value to be a `url()` and
 * nothing else: a cursor always has its fallback keyword after it.
 */
export function cursorImageUrl(value: string): string {
  return /^url\(\s*(['"]?)([^)'"]*)\1\s*\)/i.exec(value.trim())?.[2]?.trim() ?? '';
}
