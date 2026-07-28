import type { Editor, RichTextEditorAction } from 'grapesjs';

/*
 * The toolbar that appears over selected text.
 *
 * It is the one piece of stock GrapesJS UI still rendered on this page — every
 * other manager runs with `custom: true` and a React panel — so its contents
 * are configured rather than drawn. The defaults are bold, italic, underline,
 * strikethrough, link and wrap; alignment is what they are missing.
 */

/** GrapesJS reports button state as a number: -1 disabled, 0 off, 1 on. */
const ACTIVE = 1;
const INACTIVE = 0;

/** The `rte` handed to an action's callbacks. */
type Rte = Parameters<RichTextEditorAction['result']>[0];

/** Material's `format_align_*`, matching the stock link and wrap glyphs. */
const alignIcons = {
  left: 'M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z',
  center: 'M3,3H21V5H3V3M7,7H17V9H7V7M3,11H21V13H3V11M7,15H17V17H7V15M3,19H21V21H3V19Z',
  right: 'M3,3H21V5H3V3M9,7H21V9H9V7M3,11H21V13H3V11M9,15H21V17H9V15M3,19H21V21H3V19Z',
  justify: 'M3,3H21V5H3V3M3,7H21V9H3V7M3,11H21V13H3V11M3,15H21V17H3V15M3,19H21V21H3V19Z',
} as const;

type Align = keyof typeof alignIcons;

/**
 * The component being edited.
 *
 * Editing starts on the selected component and keeps it selected, so this is
 * the text block the alignment buttons act on.
 */
function edited(rte: Rte) {
  return rte.em.getEditor().getSelected();
}

function currentAlign(rte: Rte): string {
  const value = edited(rte)?.getStyle()['text-align'];
  return typeof value === 'string' ? value : '';
}

/**
 * Alignment belongs to the block rather than to the selected characters, so
 * these write `text-align` into the component's style — the same declaration
 * the inspector's Align control writes, and in the same place, so the two
 * always show the same answer.
 *
 * Not `execCommand('justifyCenter')`, the usual route for an RTE button. That
 * puts an inline style on whichever element the browser decides is the block,
 * which for a single-paragraph component is the editing host itself — and only
 * the host's `innerHTML` is synced back to the model, so the alignment would be
 * dropped the moment editing ended.
 *
 * Clicking the active button clears the declaration, as in the inspector.
 */
function alignAction(align: Align, title: string): RichTextEditorAction {
  return {
    name: `align-${align}`,
    icon: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${alignIcons[align]}"/></svg>`,
    attributes: { title },
    state: (rte) => (currentAlign(rte) === align ? ACTIVE : INACTIVE),
    result: (rte) => {
      edited(rte)?.addStyle({ 'text-align': currentAlign(rte) === align ? '' : align });
    },
  };
}

const alignActions = [
  alignAction('left', 'Align left'),
  alignAction('center', 'Align center'),
  alignAction('right', 'Align right'),
  alignAction('justify', 'Justify'),
];

/**
 * Appends the alignment buttons after the six stock ones.
 *
 * Added here rather than through `richTextEditor.actions` because that config
 * would have to restate the defaults to keep them, and it is typed `string[]`
 * — names only — even though the module accepts full actions. `add` takes one.
 *
 * Call on `load`: the toolbar these attach to is built when the module loads.
 */
export function registerTextAlign(editor: Editor) {
  for (const action of alignActions) {
    editor.RichTextEditor.add(action.name, action);
  }
}
