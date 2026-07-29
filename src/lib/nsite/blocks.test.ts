import { describe, expect, it } from 'vitest';
import grapesjs, { type Component, type ResizerOptions } from 'grapesjs';

import { resizableComponents } from './blocks';

/**
 * The cap that stops a column being dragged wide enough to wrap its row.
 *
 * jsdom does no layout, so the geometry is stubbed and the real code path is
 * driven over it: `component:resize:init` -> `flexItemResize` -> `onStart`.
 *
 * The numbers are the ones measured in a real browser, and the fakes belong to
 * a realm of their own on purpose. The canvas is an iframe, so its nodes are
 * never instances of *this* module's `HTMLElement` — an `instanceof` guard here
 * silently matched nothing, the row read as childless, and the cap came out as
 * the full width of it rather than the room its neighbours left.
 */
class ForeignRealmElement {}

class FakeEl {
  offsetWidth = 0;
  offsetHeight = 0;
  clientWidth = 0;
  parentElement: FakeEl | null = null;
  children: FakeEl[] = [];
  ownerDocument: unknown;
}

/** The exact geometry from the browser log: an 867px row. */
function scene() {
  const styles = new Map<FakeEl, Record<string, string>>();
  const view = {
    getComputedStyle: (el: FakeEl) => styles.get(el) ?? {},
    HTMLElement: ForeignRealmElement,
  };
  const doc = { defaultView: view };

  const make = (style: Record<string, string>, width: number) => {
    const el = new FakeEl();
    el.offsetWidth = width;
    el.ownerDocument = doc;
    styles.set(el, style);
    return el;
  };

  const row = make(
    {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: '24px',
      rowGap: '24px',
      paddingLeft: '24px',
      paddingRight: '24px',
    },
    867,
  );
  row.clientWidth = 867;

  const rail = { flexShrink: '0', minWidth: 'auto' };
  const left = make(rail, 220);
  const body = make({ flexShrink: '1', minWidth: '320px' }, 331);
  const right = make(rail, 220);

  for (const el of [left, body, right]) el.parentElement = row;
  row.children = [left, body, right];

  return { row, right };
}

function capFor(handler: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const editor = grapesjs.init({
    container,
    fromElement: false,
    plugins: [resizableComponents],
    components: '<div><div></div><div></div><div></div></div>',
    storageManager: false,
    panels: { defaults: [] },
  });

  const built = scene();
  const rowCmp = editor.getWrapper()!.components().at(0);
  const column = rowCmp.components().at(2) as Component;

  rowCmp.getEl = () => built.row as unknown as HTMLElement;
  column.getEl = () => built.right as unknown as HTMLElement;

  const event = {
    component: column,
    resizable: true as boolean | ResizerOptions,
    hasCustomResize: false,
  };
  editor.trigger('component:resize:init', event);

  const options = event.resizable as ResizerOptions;
  const config: ResizerOptions = { ...options };

  options.onStart?.(new Event('pointerdown') as PointerEvent, {
    docs: [],
    config,
    el: built.right as unknown as HTMLElement,
    resizer: { handlerAttr: handler } as never,
  });

  // An editor left running keeps its observers and timers on the event loop, so
  // the process never exits once the assertions are done — the tests pass and
  // then vitest hangs until it is killed. `config` is a plain copy, so the cap
  // read below survives the teardown.
  editor.destroy();
  container.remove();

  return config.maxDim;
}

describe('flex column resize cap', () => {
  it('measures neighbours that belong to another realm', () => {
    // 867 - 48 padding = 819 inner; less 48 gaps, the 220 rigid rail and the
    // body's 320 min-width leaves 231. Unseen siblings reported 819 — the whole
    // row, which is about 3.5x the width at which the line actually wraps.
    expect(capFor('cl')).toBe(231);
  });

  it('leaves the corner handles to the clamp that spares their height', () => {
    // `maxDim` is one number for both axes, so capping a corner would pin the
    // column's height to the width it may not exceed.
    for (const handler of ['br', 'tl', 'bc', 'tc']) {
      expect(capFor(handler)).toBeUndefined();
    }
  });
});
