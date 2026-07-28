import type { Component, Editor } from 'grapesjs';

import { base64ToUtf8, utf8ToBase64 } from '@/lib/sandbox/base64';

/**
 * Carrying the parts of a page that must not run in the canvas.
 *
 * `<script>`, `<iframe>` and their neighbours are the whole reason an nsite is
 * worth more than a page builder's export — but the canvas iframe is
 * same-origin with the app, and script that ran in there could read the `nsec`
 * out of localStorage. Deleting them makes the canvas safe and the editor
 * lossy: opening a site with a `<script src="/app.js">` used to drop the tag
 * while keeping `app.js` in the manifest, so republishing shipped a file
 * nothing referenced. The site went in working and came out inert.
 *
 * They are therefore swapped for a placeholder on the way in rather than
 * removed. The original markup rides along base64-encoded in an attribute —
 * base64 because the alphabet has no `<`, `"` or `&` in it, so an encoded
 * payload cannot break out of the attribute it sits in no matter what it holds.
 * A registered component type serializes the placeholder back to that original
 * markup, so `editor.getHtml()` — and with it the stored file, the publish set
 * and the code panel — sees the real tag, while the canvas only ever sees an
 * inert stand-in.
 *
 * The stand-in is a real component, which is what makes this better than
 * hiding the markup in a side table: it selects, moves, clones and deletes like
 * anything else on the page, and undo covers it, all without a line of code
 * here.
 *
 * Two carriers are needed, because a page can be a whole document. Anything in
 * `<head>` has to be an element the HTML parser will *keep* in `<head>` — an
 * unknown tag there is hoisted into the body on the next parse, which would
 * move a site's scripts out of its head every time the page was opened.
 * `<template>` is the one element valid in both places and inert in both, so it
 * carries head content; the body gets a custom element, which is stylable into
 * something visible.
 */

/** The body carrier: an unknown element, rendered as a labelled chip. */
export const FOREIGN_TAG = 'nsite-foreign';

/** Set on both carriers, to the tag name being stood in for. */
export const FOREIGN_ATTR = 'data-nsite-foreign';

/** The original `outerHTML`, base64-encoded. */
export const FOREIGN_HTML_ATTR = 'data-nsite-html';

/** What the chip prints. Read by CSS `attr()`, never parsed as markup. */
export const FOREIGN_LABEL_ATTR = 'data-nsite-label';

/**
 * The size the carried markup asked for, applied to the chip by the view.
 *
 * Deliberately not a `style` attribute. GrapesJS lifts inline styles off parsed
 * markup into stylesheet rules keyed to a generated id — and since `toHTML`
 * emits the original markup, that id is never written, so the rule is left
 * pointing at nothing. It survives into the saved page, is parsed back on the
 * next open, and joins a fresh one for the same element: a dead rule per embed
 * per edit, accumulating forever. Held as data instead, it stays out of the
 * stylesheet entirely.
 */
export const FOREIGN_WIDTH_ATTR = 'data-nsite-width';
export const FOREIGN_HEIGHT_ATTR = 'data-nsite-height';

export const FOREIGN_TYPE = 'nsite-foreign';
export const FOREIGN_HEAD_TYPE = 'nsite-foreign-head';

/**
 * Elements that exist to run or embed foreign code.
 *
 * GrapesJS's own parser drops `<script>` whatever this does — `allowScripts`
 * defaults off and it strips the nodes before any of them become components —
 * so substituting has to happen before it ever sees the markup, not after.
 */
const FOREIGN_SELECTOR =
  'script, iframe, frame, object, embed, applet, base, meta[http-equiv], noscript';

/** Dimensions worth carrying onto the chip, so an embed reserves its space. */
const SIZE_ATTRIBUTE = /^\d+(\.\d+)?%?$/;
const SIZE_DECLARATION = /(?:^|;)\s*(width|height)\s*:\s*(\d+(?:\.\d+)?(?:px|%|r?em|v[hw]))\s*(?=;|$)/gi;

/**
 * The chip's size, taken from whatever the original declared.
 *
 * Only values matched in full by one of the patterns above are carried, so an
 * embed's own `width="560"` can size the placeholder without its markup having
 * any say in what ends up being written as CSS.
 */
function sizeOf(el: Element): { width?: string; height?: string } {
  const size: { width?: string; height?: string } = {};

  for (const name of ['width', 'height'] as const) {
    const value = (el.getAttribute(name) ?? '').trim();
    if (SIZE_ATTRIBUTE.test(value)) size[name] = value.endsWith('%') ? value : `${value}px`;
  }

  for (const [, name, value] of (el.getAttribute('style') ?? '').matchAll(SIZE_DECLARATION)) {
    size[name.toLowerCase() as 'width' | 'height'] = value;
  }

  return size;
}

/** `<iframe> https://…` — enough to tell one placeholder from another. */
function labelOf(el: Element): string {
  const reference = (
    el.getAttribute('src') ??
    el.getAttribute('data') ??
    el.getAttribute('href') ??
    ''
  )
    // Cosmetic only — the value is escaped on its way into the attribute and
    // read back by CSS `attr()`, so it never becomes syntax in either language.
    // A URL split over several lines would just make an unreadable label.
    .replace(/\s+/g, ' ')
    .trim();

  const shortened =
    reference.length > 64 ? `${reference.slice(0, 63)}\u2026` : reference;

  return `<${el.tagName.toLowerCase()}>${shortened ? ` ${shortened}` : ''}`;
}

/**
 * Replaces every element the canvas must not run with a placeholder holding it.
 *
 * `asDocument` decides whether `<head>` will still exist in what comes out. For
 * a fragment there is no head to keep anything in, so everything becomes the
 * body carrier.
 */
export function stashForeign(doc: Document, asDocument: boolean): void {
  for (const el of Array.from(doc.querySelectorAll(FOREIGN_SELECTOR))) {
    // A `<noscript>` wrapping an `<iframe>` matches both, and replacing the
    // outer one detaches the inner before its turn comes. It is already
    // carried, inside its parent's payload.
    if (!el.isConnected) continue;

    const inHead = asDocument && !!el.closest('head');
    const placeholder = doc.createElement(inHead ? 'template' : FOREIGN_TAG);

    placeholder.setAttribute(FOREIGN_ATTR, el.tagName.toLowerCase());
    placeholder.setAttribute(FOREIGN_HTML_ATTR, utf8ToBase64(el.outerHTML));

    if (!inHead) {
      placeholder.setAttribute(FOREIGN_LABEL_ATTR, labelOf(el));

      const { width, height } = sizeOf(el);
      if (width) placeholder.setAttribute(FOREIGN_WIDTH_ATTR, width);
      if (height) placeholder.setAttribute(FOREIGN_HEIGHT_ATTR, height);
    }

    el.replaceWith(placeholder);
  }
}

/**
 * The markup a placeholder stands for.
 *
 * Empty for a payload that won't decode, which can only happen if someone hand
 * edited the attribute in the code panel. Dropping one element is a better
 * answer than throwing from the middle of serializing the page, which would
 * take the editor down with it.
 */
export function foreignMarkup(encoded: string): string {
  try {
    return base64ToUtf8(encoded);
  } catch {
    return '';
  }
}

/**
 * How the body carrier draws.
 *
 * The label comes from `attr()` rather than from generated markup, so the value
 * stays a string the whole way and never becomes CSS or HTML syntax. Injected
 * into the canvas alongside the rest of the editor's own styling — the
 * placeholder never reaches a published page, so neither does this.
 */
export const foreignPlaceholderCss = `
${FOREIGN_TAG}{
  display:inline-block;
  box-sizing:border-box;
  min-width:32px;
  padding:6px 10px;
  border:1px dashed #94a3b8;
  border-radius:6px;
  background:#f8fafc;
  color:#475569;
  font:500 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  vertical-align:middle;
}
${FOREIGN_TAG}::before{content:attr(${FOREIGN_LABEL_ATTR});}
`;

/** Shared by both carriers: inert, childless, and serialized from its payload. */
const foreignModel = {
  droppable: false,
  editable: false,
  // The chip's size comes from the markup it stands for, and any style written
  // here would be keyed to an id that `toHTML` never emits — leaving an orphan
  // rule in the stylesheet and a resize that appears to work until it is saved.
  resizable: false,
  stylable: false,
  traits: [],
};

/**
 * Gives the chip the footprint of what it stands for, so an embed leaves a hole
 * the size of the embed rather than collapsing the page around a small label.
 *
 * Written to the element by the view rather than to the model, which is what
 * keeps it out of the stylesheet — see `FOREIGN_WIDTH_ATTR`. Nothing here is
 * page state, so nothing here needs to survive serialization.
 */
const foreignView = {
  onRender({ el, model }: { el: HTMLElement; model: Component }) {
    const attributes = model.getAttributes();
    const width = attributes[FOREIGN_WIDTH_ATTR];
    const height = attributes[FOREIGN_HEIGHT_ATTR];

    if (width) el.style.width = String(width);
    if (height) el.style.height = String(height);
  },
};

function foreignType(tagName: string) {
  return {
    defaults: { ...foreignModel, tagName },

    init(this: Component) {
      const attributes = this.getAttributes();
      // Names the layer tree entry, which is the only handle on a placeholder
      // sitting in the head — nothing in the head is drawn on the canvas.
      this.set(
        'name',
        String(attributes[FOREIGN_LABEL_ATTR] ?? `<${attributes[FOREIGN_ATTR]}>`),
        { silent: true },
      );
    },

    toHTML(this: Component) {
      return foreignMarkup(String(this.getAttributes()[FOREIGN_HTML_ATTR] ?? ''));
    },
  };
}

/** True for a component standing in for markup the canvas must not run. */
export function isForeign(component: Component): boolean {
  const type = component.get('type');
  return type === FOREIGN_TYPE || type === FOREIGN_HEAD_TYPE;
}

/**
 * Registered as a plugin for the same reason the hero is: `grapesjs.init`
 * loads plugins before it parses `components`, and a placeholder in the
 * starting markup has to be recognized by the time it is read.
 */
export function foreignComponents(editor: Editor) {
  editor.DomComponents.addType(FOREIGN_TYPE, {
    isComponent: (el) => el.tagName === FOREIGN_TAG.toUpperCase(),
    model: foreignType(FOREIGN_TAG),
    view: foreignView,
  });

  editor.DomComponents.addType(FOREIGN_HEAD_TYPE, {
    // Keyed on the attribute rather than the tag, so a site's own `<template>`
    // elements are left to parse as themselves.
    isComponent: (el) => el.tagName === 'TEMPLATE' && el.hasAttribute(FOREIGN_ATTR),
    model: foreignType('template'),
  });
}
