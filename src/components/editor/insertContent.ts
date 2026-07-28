import type { Editor } from 'grapesjs';

import type { BlockContent } from '@/lib/nsite/blocks';

/**
 * Adds content to the page without dragging — the click and keyboard path.
 *
 * Drops go next to the current selection, which is what someone who just
 * clicked a section and then picked something out of a panel almost always
 * means. With nothing selected it appends to the page's root container rather
 * than the wrapper, so what lands inherits the page's max-width and gap instead
 * of sitting outside it.
 */
export function insertContent(editor: Editor, content: BlockContent) {
  const selected = editor.getSelected();
  const parent = selected?.parent();

  if (selected && parent) {
    const index = parent.components().indexOf(selected);
    const [added] = parent.append(content, { at: index + 1 });
    if (added) editor.select(added);
    return;
  }

  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const children = wrapper.components();
  const root = children.length === 1 ? (children.at(0) ?? wrapper) : wrapper;
  const [added] = root.append(content);
  if (added) editor.select(added);
}
