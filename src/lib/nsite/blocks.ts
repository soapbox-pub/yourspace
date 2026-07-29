import type {
  Component,
  ComponentResizeEventUpdateProps,
  Editor,
  ResizerOptions,
} from 'grapesjs';

import { isForeign } from '@/lib/nsite/foreign';
import { isLayoutRow } from '@/lib/nsite/layout';
import { wordArtMarkup } from '@/lib/nsite/wordart';

/**
 * The nsite content the builder starts from: its blocks and its starting page.
 *
 * GrapesJS renders the page inside an iframe and edits real HTML/CSS, so the
 * app's Tailwind classes do not apply. Blocks are therefore written as
 * self-contained markup with inline styles — which is how you would author them
 * for GrapesJS in production anyway.
 */

/**
 * Relay data — signatures prove authorship, not trustworthiness — is
 * interpolated into markup that runs in a same-origin iframe, where injected
 * script could read the `nsec` out of localStorage. Every value that reaches
 * the canvas from an event is escaped first.
 */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

/** Block content as GrapesJS accepts it: markup, or a component reference. */
export type BlockContent = string | { type: string; style?: Record<string, string> };

export interface NsiteBlockDef {
  id: string;
  label: string;
  /** One line of "what does dropping this give me", shown in the studio palette. */
  description: string;
  content: BlockContent;
}

export const nsiteBlockDefs: NsiteBlockDef[] = [
  {
    id: 'heading',
    label: 'Heading',
    description: 'A single section heading',
    content: '<h2 style="font-size:24px;font-weight:600;">Section heading</h2>',
  },
  {
    id: 'text',
    label: 'Text',
    description: 'An editable paragraph',
    content: '<p style="font-size:18px;line-height:1.7;color:#475569;">Write something here.</p>',
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Placeholder image, swap via the asset picker',
    content: { type: 'image', style: { width: '100%', 'border-radius': '12px' } },
  },
  {
    id: 'wordart',
    label: 'Word art',
    description: 'Big lettering, styled from a gallery of effects',
    content: wordArtMarkup(),
  },
];

/**
 * A page of this site: the given body inside the head every page needs.
 *
 * A whole document rather than a fragment, because that is what a site ships,
 * and because the doctype is what `serializePage` reads to decide whether to
 * serialize one — starting without it means the `<head>` only appears once
 * something else puts it there. What is in the head is the minimum a published
 * page needs and nothing that would render: a charset so the bytes are read as
 * UTF-8, and a viewport so phones lay the page out at their own width instead
 * of zooming out from 980px.
 */
export function sitePage(body = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>${body}</body>
</html>
`;
}

/*
 * The page the editor opens on, empty.
 *
 * Empty because everything on it is the user's to write: a page that opens
 * holding someone else's sections is a page whose first editing session is
 * spent deleting them, and the palette is right there. A page can be given a
 * shape without being given content, which is what the starter layouts offer
 * instead — see `starters.ts`.
 */
export const initialPage = sitePage();

/**
 * Resize handles on everything.
 *
 * `resizable` defaults to false for every type but `image`, so without this the
 * only way to size an element is to type a value into the inspector. GrapesJS
 * already adapts the handles to how the element is being laid out: its resizer
 * writes `top`/`left` alongside the new size *only* when the component is in a
 * drag mode, so in normal flow the handles change width and height and nothing
 * else, and in free layout they reposition as you'd expect from a design tool.
 *
 * Registered as a plugin, and listening rather than setting defaults, because
 * types like `text` and `image` bring their own model class — extending the
 * `default` type would not reach them. `component:create` fires for every
 * component whatever its type, and plugins run before anything is parsed, so
 * the page the editor opens on is covered too.
 *
 * Set silently: this is a property of the editor's chrome, not an edit to the
 * page, and it should not land in the undo stack or mark the project dirty.
 */
export function resizableComponents(editor: Editor) {
  editor.on('component:create', (component: Component) => {
    // A bare text node has no element of its own to put handles on.
    if (component.get('type') === 'textnode') return;
    // A placeholder serializes to the markup it stands for, so a size written
    // onto it would be discarded on save — handles that do nothing.
    if (isForeign(component)) return;
    // A layout row is sized by its own panel, and the width a handle writes
    // would fight the max-width that panel sets. Its columns keep their
    // handles: dragging the edge between two of them is how a row is shared out.
    if (isLayoutRow(component)) return;
    if (component.get('resizable')) return;

    component.set('resizable', true, { silent: true });
  });

  /*
   * `component:resize:init` hands out a payload whose `resizable` the listener
   * is meant to rewrite, which is the only place these options can be decided:
   * whether a handle should write `width` or `flex-basis` depends on the
   * parent, and a component has no parent yet when it is created.
   */
  editor.on('component:resize:init', (event: ResizeInitEvent) => {
    const { component } = event;
    if (!component || !event.resizable) return;

    const axis = flexAxis(component.parent()?.getEl());
    if (axis) event.resizable = flexItemResize(component, axis);
  });

  /*
   * The cap, enforced on the value actually being written.
   *
   * `maxDim` stops the resizer's own rectangle, which is what makes the handle
   * stop alongside the column rather than running on ahead of it — but it is a
   * single number applied to both axes, so it can only be set for a drag along
   * one of them. This is the backstop underneath it: the room is read again on
   * every move, only the property carrying the column's share of the row is
   * touched, and nothing here depends on which handle was grabbed.
   */
  editor.on('component:resize:update', (event: ComponentResizeEventUpdateProps) => {
    const { component, rect, style, updateStyle, convertPxToUnit } = event;
    const el = component?.getEl();
    const axis = flexAxis(component?.parent()?.getEl());
    if (!el || !axis) return;

    const room = lineRoom(el, axis);
    if (room === undefined) return;

    const dragged = axis === 'row' ? rect.w : rect.h;
    if (dragged <= room) return;

    // TEMPORARY: remove once the cap is confirmed in a browser.
    console.info('[column resize] clamped', { dragged, room });

    updateStyle({
      ...style,
      // `el` is already bound inside, and re-stating it is how the exported
      // signature is satisfied — the same element either way.
      'flex-basis': convertPxToUnit({
        el,
        valuePx: room,
        unit: '%',
        isHeight: axis === 'column',
      }),
    });
  });
}



/** The mutable half of the `component:resize:init` payload. */
interface ResizeInitEvent {
  component?: Component;
  resizable?: boolean | ResizerOptions;
}

/**
 * The axis a container lays its children out along, or null if it is not a flex
 * container.
 *
 * Read from the canvas rather than from the component's own style bag, so that
 * a rule arriving in an imported site's stylesheet counts for as much as one
 * set here — the style bag only holds what this editor wrote or parsed inline.
 */
function flexAxis(el: HTMLElement | undefined): 'row' | 'column' | null {
  const view = el?.ownerDocument.defaultView;
  if (!el || !view) return null;

  const { display, flexDirection } = view.getComputedStyle(el);
  if (display !== 'flex' && display !== 'inline-flex') return null;

  return flexDirection.startsWith('column') ? 'column' : 'row';
}

/**
 * Resize options for a child of a flex container.
 *
 * The resizer writes `width`, but a flex item's size along the main axis comes
 * from `flex-basis` — and `flex: 1` is shorthand for a basis of `0%`, which
 * beats any width. Dragging the side handle of an equal column therefore moved
 * nothing at all.
 *
 * Pointing the resizer at `flex-basis` fixes that, in percent so that a column
 * sized against the desktop frame still means the same thing in a narrower one.
 * `currentUnit` has to be switched off alongside it, or the unit is replaced on
 * mousedown by whichever one the element's current basis happens to carry.
 *
 * Growing is dropped at the same time. A column still on `flex-grow: 1` takes
 * its share of the leftover space *on top of* the basis just written, so it
 * settles wider than where it was dropped; without it the column is exactly its
 * basis, and its siblings — which are still growing — absorb the difference.
 * That is what makes the rest of the row give way as one column is dragged.
 *
 * `maxDim` is what stops the drag before the line wraps — see `lineRoom`. It is
 * always assigned, never left alone, because the options object it lands on is
 * the resizer's own and outlives a single drag.
 */
function flexItemResize(component: Component, axis: 'row' | 'column'): ResizerOptions {
  const alongMainAxis =
    axis === 'row'
      ? { keyWidth: 'flex-basis', unitWidth: '%' }
      : { keyHeight: 'flex-basis', unitHeight: '%' };

  return {
    ...alongMainAxis,
    currentUnit: false,
    onStart: (_event, { config, el, resizer }) => {
      freezeFlexSize(component, axis);

      /*
       * Only when the drag is along the main axis alone. A corner drags the
       * cross axis with it, and `maxDim` is one number for both — it would cap
       * the column's height at the width it may not exceed. Those are left to
       * the backstop in `resizableComponents`, which clamps the written value
       * rather than the rectangle.
       */
      const sideHandles = axis === 'row' ? ['cl', 'cr'] : ['tc', 'bc'];
      const handler = resizer.handlerAttr ?? '';
      config.maxDim = sideHandles.includes(handler) ? lineRoom(el, axis) : undefined;
    },
  };
}

/**
 * How far the dragged edge can travel before its line wraps, in pixels.
 *
 * A wrapping flex container breaks lines on each item's *hypothetical* main
 * size — its basis clamped by min and max — and only shrinks what is left over
 * afterwards, within a line it has already decided on. So widening one column
 * squeezes its neighbours right up to their floors and then, with nowhere left
 * to take the space from, drops the column onto a line of its own. That is the
 * mobile stacking behaviour firing at desktop width, because the drag has
 * manufactured exactly the condition a narrow viewport would.
 *
 * Capping the drag there is what makes the floor legible: the column stops
 * against its neighbours instead of tipping over into a different layout.
 * `maxDim` clamps the resizer's own rectangle rather than just the style it
 * writes, so the handle stops with the column and the drag feels like it has
 * hit something.
 *
 * The cap is in the pixel space the resizer works in, which is the same space
 * `freezeFlexSize` measures. GrapesJS converts that to a percentage of the
 * parent's `offsetWidth` while CSS resolves it against the content box, so the
 * column settles a padding's worth short of the cap — erring towards stopping
 * early, which is the safe direction for a limit whose whole job is to prevent
 * a wrap.
 */
function lineRoom(el: HTMLElement, axis: 'row' | 'column'): number | undefined {
  const parentEl = el.parentElement;
  const view = el.ownerDocument.defaultView;
  if (!parentEl || !view) return undefined;

  const parent = view.getComputedStyle(parentEl);
  // Nothing to hold back: a container that cannot wrap overflows instead, which
  // is a different problem and one the container itself owns.
  if (parent.flexWrap === 'nowrap') return undefined;

  const horizontal = axis === 'row';

  // `clientWidth` carries the padding and leaves out the border and any
  // scrollbar, so the padding is all that has to come off to reach the box the
  // items are actually laid out in.
  const inner = horizontal
    ? parentEl.clientWidth - lengthOf(parent.paddingLeft) - lengthOf(parent.paddingRight)
    : parentEl.clientHeight - lengthOf(parent.paddingTop) - lengthOf(parent.paddingBottom);

  /*
   * No `instanceof HTMLElement` here. The canvas is an iframe, so these nodes
   * belong to a different realm than the one this module was loaded in, and the
   * check quietly evaluated false for every child — leaving the row looking
   * childless and the cap set to the full width of it. `children` is already an
   * element-only collection, so the identity test is the whole filter.
   */
  const siblings = Array.from(parentEl.children).filter(
    (child): child is HTMLElement => child !== el,
  );

  // One gap per sibling is one fewer than the number of items, which is right.
  const claimed = siblings.reduce(
    (total, sibling) => total + itemFloor(sibling, view.getComputedStyle(sibling), horizontal),
    lengthOf(horizontal ? parent.columnGap : parent.rowGap) * siblings.length,
  );

  return Math.max(inner - claimed, 0);
}

/**
 * The least main-axis room a sibling will give up.
 *
 * `flex-shrink` buys nothing at this stage, because line breaking happens
 * before shrinking does: an item that could shrink still claims its `min-width`
 * when the line is being formed, and one that cannot shrink claims every pixel
 * it currently occupies.
 *
 * A `min-width` of `auto` claims nothing. Its real floor is the item's
 * min-content size, which is content-dependent and not worth modelling here —
 * and reading it as zero errs towards letting the drag continue rather than
 * stopping it somewhere the user cannot see a reason for.
 */
function itemFloor(el: HTMLElement, style: CSSStyleDeclaration, horizontal: boolean): number {
  const min = lengthOf(horizontal ? style.minWidth : style.minHeight);
  // `|| 0` because the collection can hold an element without offsets — an
  // inline SVG, say — and one `undefined` would turn the whole sum into NaN.
  const rendered = (horizontal ? el.offsetWidth : el.offsetHeight) || 0;

  return lengthOf(style.flexShrink) === 0 ? Math.max(rendered, min) : min;
}

/** A computed length in pixels, treating keywords like `auto` as no claim. */
function lengthOf(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Pins a flex item to the size it is currently rendered at, as the drag begins.
 *
 * Dropping `flex-grow` is what makes the column settle where it was dropped
 * rather than growing past it — but an equal column's basis is `0%`, and
 * clearing the grow on its own would collapse it to nothing the instant the
 * handle was grabbed, before the pointer had moved. Measuring first and writing
 * that back as the basis means the column is the same size either side of the
 * change, and the drag continues from where it looks like it should.
 *
 * Measured from `offsetWidth` against the parent's, which is how GrapesJS's own
 * resizer converts a pixel drag into a percentage — the point is to agree with
 * the values the drag is about to write, not to be independently exact.
 */
function freezeFlexSize(component: Component, axis: 'row' | 'column') {
  const el = component.getEl();
  const parentEl = el?.parentElement;
  if (!el || !parentEl) return;

  const [size, parentSize] =
    axis === 'row'
      ? [el.offsetWidth, parentEl.offsetWidth]
      : [el.offsetHeight, parentEl.offsetHeight];

  component.addStyle({
    // The shorthand goes too: it carries a grow factor and a basis of its own,
    // and a `flex: 1` left in the rule would put back what the longhands clear.
    flex: '',
    'flex-grow': '0',
    'flex-basis': `${Math.round((size / (parentSize || 1)) * 1000) / 10}%`,
  });
}

export const nsiteDevices = [
  { id: 'desktop', name: 'Desktop', width: '' },
  { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
  { id: 'mobile', name: 'Mobile', width: '375px', widthMedia: '575px' },
];

/**
 * The one rule the canvas document needs, whatever it is showing.
 *
 * GrapesJS gives the wrapper `min-height: 100vh` — it only skips that for an
 * auto-height frame, which neither demo uses — so the body already fills the
 * viewport exactly. The UA's default 8px margins on top of that push the
 * document past it, leaving a scrollbar with nothing to scroll.
 *
 * That makes this compensation for an editor artifact rather than page styling,
 * which is why it applies to an imported site as much as to the starting page.
 * Everything else a page needs it brings itself, or gets from behind the frame:
 * the backdrop is on `.gjs-frame`.
 *
 * The app's CSP forbids `data:` stylesheets, so this is injected as an inline
 * `<style>` into the canvas document rather than passed to `canvas.styles`.
 */
export const canvasResetCss = `body{margin:0;}`;
