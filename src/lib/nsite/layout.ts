import type { Component, Editor } from 'grapesjs';

/**
 * A starter layout as one component rather than a handful of loose divs.
 *
 * The columns are the point of the layout and the row is only the frame holding
 * them, but as plain markup the two were indistinguishable: selecting the row
 * offered the same forty fields as anything else — display, flex-wrap, offsets,
 * z-index — for an element whose only real decision is how far across the page
 * it runs. Worse, the row accepted drops, so a block aimed at a column that
 * missed by a few pixels landed *beside* the columns instead of in one, and the
 * layout quietly came apart.
 *
 * Registering it as a type fixes both at once. The row is closed to drops and
 * gets a panel of its own (`LayoutPanel`), and the columns cannot be dragged
 * out, deleted or duplicated — so the row and its columns behave as the single
 * thing the picker offered, while the insides of each column stay ordinary
 * page.
 *
 * The columns themselves stay plain `<div>`s. Everything you would want to do
 * to one — a background, some padding, a different share of the row — is
 * already what the element panel does well.
 */

/**
 * What marks the row and its columns in the stored HTML.
 *
 * An attribute rather than a side table, for the reason the napplet and the
 * foreign placeholders use one: the page is serialized and re-parsed constantly
 * — on every page switch, on every edit in the code panel, and when a published
 * site is imported — and an attribute is the only thing that survives all of
 * them. It ships with the page, where it costs nothing and means the layout is
 * still a layout when the site is opened again.
 */
const LAYOUT_ATTR = 'data-layout';

export const LAYOUT_ROW_TYPE = 'layout-row';
export const LAYOUT_COLUMN_TYPE = 'layout-column';

/** How wide a centred row runs by default. */
export const DEFAULT_ROW_WIDTH = 1200;

/** How a column takes its share of the row: a fixed rail, or whatever is left. */
export type ColumnKind = 'rail' | 'body';

/**
 * The centred row every starter is built from.
 *
 * A viewportful tall, so a starter is the shape of a page rather than a band
 * across the top of one — an empty region that stops partway down reads as a
 * mistake. That height reaches the columns through `align-self` on each of them
 * rather than `align-items` here, so it is the starter's own columns that fill
 * the page and not everything later dropped beside them: a heading that lands
 * in this row is meant to be heading-sized.
 *
 * `flex-wrap`, with the floor on the body column below, is what stands in for a
 * media query: a rail and a body that no longer fit side by side stack instead
 * of squeezing, so the layout survives a phone without the starter having to
 * ship CSS the user would then have to find and edit.
 *
 * `box-sizing` is spelled out because the padding has to come out of the 100vh
 * rather than adding to it. GrapesJS's `protectedCss` sets the same thing for
 * every element, but a page that only lays out correctly because of an editor
 * default is a page that breaks when the default does.
 *
 * The margins are longhands rather than `margin: 0 auto`, because the width
 * panel writes exactly these two properties and a shorthand left in the rule
 * would put back what clearing them is meant to remove.
 */
function rowStyle(width: number): string {
  return [
    'display:flex',
    'flex-wrap:wrap',
    'gap:24px',
    'align-items:flex-start',
    'box-sizing:border-box',
    'padding:32px 24px',
    'min-height:100vh',
    `max-width:${width}px`,
    'margin-left:auto',
    'margin-right:auto',
  ].join(';');
}

/**
 * The two shares a column can take.
 *
 * The `flex` longhands are spelled out rather than written `flex: 1`, because
 * the shorthand would override the `flex-basis` that dragging a column's edge
 * writes — see `flexItemResize` in `blocks.ts`.
 *
 * The `min-height` is a floor for the wrapped case, where the columns share the
 * row's height rather than each being given it — and some floor is needed
 * either way, since an empty div is zero tall and impossible to drop onto.
 * Nothing marks them out visually beyond that: the element outlines the editor
 * draws are what makes an empty column visible while editing, and a border set
 * here would survive into the published page.
 */
const columnStyle: Record<ColumnKind, string> = {
  rail: 'flex-grow:0;flex-shrink:0;flex-basis:220px;align-self:stretch;min-height:120px;',
  body: 'flex-grow:1;flex-shrink:1;flex-basis:0%;min-width:320px;align-self:stretch;min-height:120px;',
};

/** The markup a layout starter puts on the page. */
export function layoutRowMarkup(columns: ColumnKind[], width = DEFAULT_ROW_WIDTH): string {
  const cells = columns
    .map((kind) => `      <div ${LAYOUT_ATTR}="column" style="${columnStyle[kind]}"></div>`)
    .join('\n');

  return `    <div ${LAYOUT_ATTR}="row" style="${rowStyle(width)}">\n${cells}\n    </div>`;
}

export function isLayoutRow(component: Component): boolean {
  return component.get('type') === LAYOUT_ROW_TYPE;
}

export function isLayoutColumn(component: Component): boolean {
  return component.get('type') === LAYOUT_COLUMN_TYPE;
}

/** The row's columns, ignoring anything hand-editing may have left between them. */
export function layoutColumns(row: Component): Component[] {
  return row.components().models.filter(isLayoutColumn);
}

/**
 * The column something dropped "on" this component belongs in.
 *
 * The row holds nothing but its columns, so aiming at the row — or at a column,
 * which is a container rather than a sibling to sit beside — means the inside
 * of a column. Undefined for everything else, which is the ordinary case of
 * landing next to whatever is selected.
 */
export function layoutColumnFor(component: Component): Component | undefined {
  if (isLayoutColumn(component)) return component;
  if (isLayoutRow(component)) return layoutColumns(component)[0];
  return undefined;
}

/**
 * Registered as a plugin, because `grapesjs.init` loads plugins before parsing
 * `components` — a type registered afterwards would leave the row and columns
 * of a starting page parsed as anonymous `<div>`s.
 */
export function layoutComponents(editor: Editor) {
  editor.DomComponents.addType(LAYOUT_ROW_TYPE, {
    isComponent: (el) => (layoutRole(el) === 'row' ? { type: LAYOUT_ROW_TYPE } : undefined),

    model: {
      defaults: {
        name: 'Columns',
        tagName: 'div',
        // The columns are what content goes in. A drop that lands here instead
        // is a miss, and taking it would break the layout apart.
        droppable: false,
        // Sized by its own panel; a width dragged onto the edge would fight the
        // max-width that panel writes. See the guard in `resizableComponents`.
        resizable: false,
        traits: [],
      },
    },
  });

  editor.DomComponents.addType(LAYOUT_COLUMN_TYPE, {
    isComponent: (el) => (layoutRole(el) === 'column' ? { type: LAYOUT_COLUMN_TYPE } : undefined),

    model: {
      defaults: {
        name: 'Column',
        tagName: 'div',
        // A column is part of the layout rather than something in it: it cannot
        // be dragged out of the row, thrown away or copied. Resizing is left
        // on, because dragging the edge between two columns is how the row's
        // proportions are meant to be changed.
        draggable: false,
        removable: false,
        copyable: false,
        traits: [],
      },
    },
  });
}

function layoutRole(el: HTMLElement): string | undefined {
  if (el.tagName !== 'DIV') return undefined;
  return el.getAttribute?.(LAYOUT_ATTR) ?? undefined;
}
