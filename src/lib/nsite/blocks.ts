import type { Component, Editor, ResizerOptions } from 'grapesjs';

import { isForeign } from '@/lib/nsite/foreign';

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

/* --------------------------------------------------------------------------
 * Layout
 *
 * Structural blocks: containers with nothing in them, whose only job is to give
 * the page a shape other than one column of stacked sections.
 * ------------------------------------------------------------------------ */

/**
 * "Take an equal share of the row", spelled out.
 *
 * `flex: 1` says exactly this in one declaration, but it is a shorthand, and
 * resizing a column writes the `flex-basis` longhand — which a `flex: 1` left
 * sitting in the same rule would override. The inspector collapses `padding`
 * and `background` on edit for the same reason.
 */
const flexFill = 'flex-grow:1;flex-shrink:1;flex-basis:0%;';

/**
 * An empty drop target.
 *
 * Given a minimum height because a div with no children is zero tall and
 * therefore impossible to drag anything onto. Nothing marks it out visually:
 * the "Show element outlines" toggle already draws a dashed box around every
 * component while editing, and a border set here would survive into the
 * published page, where an empty slot should look like empty space.
 */
const dropZone = (style = flexFill) => `<div style="${style}min-height:80px;"></div>`;

const columnsBlock = (count: number) =>
  `<div style="display:flex;gap:16px;">${Array.from({ length: count }, () => dropZone()).join('')}</div>`;

/** Deliberately uneven, which is the whole reason to reach for it over "2 columns". */
const sidebarBlock = `
  <div style="display:flex;gap:16px;">
    ${dropZone('flex-grow:0;flex-shrink:0;flex-basis:30%;')}
    ${dropZone()}
  </div>
`;

const gridBlock = `
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
    ${dropZone('').repeat(6)}
  </div>
`;

/**
 * A positioning context.
 *
 * `position:relative` is what makes the children of this block placeable:
 * `core:component-drag` walks up from the element being dragged looking for an
 * ancestor styled `relative` or `absolute`, and measures its offsets from the
 * first one it finds. Without such an ancestor the coordinates are resolved
 * against the page instead, which is fine but means the group can't be moved
 * as a unit afterwards.
 */
const freeAreaBlock = `
  <div style="position:relative;min-height:320px;"></div>
`;

const spacerBlock = `<div style="height:64px;"></div>`;

/** Block content as GrapesJS accepts it: markup, or a component reference. */
export type BlockContent = string | { type: string; style?: Record<string, string> };

export interface NsiteBlockDef {
  id: string;
  label: string;
  category: 'Basic' | 'Layout';
  /** One line of "what does dropping this give me", shown in the studio palette. */
  description: string;
  content: BlockContent;
}

export const nsiteBlockDefs: NsiteBlockDef[] = [
  {
    id: 'heading',
    label: 'Heading',
    category: 'Basic',
    description: 'A single section heading',
    content: '<h2 style="font-size:24px;font-weight:600;">Section heading</h2>',
  },
  {
    id: 'text',
    label: 'Text',
    category: 'Basic',
    description: 'An editable paragraph',
    content: '<p style="font-size:18px;line-height:1.7;color:#475569;">Write something here.</p>',
  },
  {
    id: 'image',
    label: 'Image',
    category: 'Basic',
    description: 'Placeholder image, swap via the asset picker',
    content: { type: 'image', style: { width: '100%', 'border-radius': '12px' } },
  },
  {
    id: 'two-columns',
    label: '2 columns',
    category: 'Layout',
    description: 'Two equal drop zones side by side',
    content: columnsBlock(2),
  },
  {
    id: 'three-columns',
    label: '3 columns',
    category: 'Layout',
    description: 'Three equal drop zones side by side',
    content: columnsBlock(3),
  },
  {
    id: 'sidebar',
    label: 'Sidebar + main',
    category: 'Layout',
    description: 'A narrow rail beside a wide column',
    content: sidebarBlock,
  },
  {
    id: 'grid',
    label: 'Grid',
    category: 'Layout',
    description: 'Six cells in a 3-across grid, resizable',
    content: gridBlock,
  },
  {
    id: 'free-area',
    label: 'Free area',
    category: 'Layout',
    description: 'A positioned region — place anything anywhere inside it',
    content: freeAreaBlock,
  },
  {
    id: 'spacer',
    label: 'Spacer',
    category: 'Layout',
    description: 'Empty vertical room between blocks',
    content: spacerBlock,
  },
];

/*
 * An empty page, and a whole document rather than a fragment.
 *
 * Empty because everything here is the user's to write: a page that opens
 * holding someone else's sections is a page whose first editing session is
 * spent deleting them, and the palette is right there.
 *
 * A document because that is what a site ships, and because the doctype is what
 * `serializePage` reads to decide whether to serialize one — starting without
 * it means the `<head>` only appears once something else puts it there. What is
 * in the head is the minimum a published page needs and nothing that would
 * render: a charset so the bytes are read as UTF-8, and a viewport so phones
 * lay the page out at their own width instead of zooming out from 980px.
 */
export const initialPage = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body></body>
</html>
`;

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
 */
function flexItemResize(component: Component, axis: 'row' | 'column'): ResizerOptions {
  const alongMainAxis =
    axis === 'row'
      ? { keyWidth: 'flex-basis', unitWidth: '%' }
      : { keyHeight: 'flex-basis', unitHeight: '%' };

  return {
    ...alongMainAxis,
    currentUnit: false,
    onStart: () => freezeFlexSize(component, axis),
  };
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
