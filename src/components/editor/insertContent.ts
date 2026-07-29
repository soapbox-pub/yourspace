import type { Editor } from 'grapesjs';

import type { BlockContent } from '@/lib/nsite/blocks';
import { layoutColumnFor } from '@/lib/nsite/layout';

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

  /*
   * A layout is a unit, so "next to" does not apply inside one. Aiming at the
   * row would put the block beside the columns and break the layout apart, and
   * aiming at a column means the inside of it rather than a fourth column — so
   * either lands in a column, which is the only place content belongs.
   */
  const column = selected && layoutColumnFor(selected);
  if (column) {
    const [added] = column.append(content);
    if (added) editor.select(added);
    return;
  }

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
  const target = layoutColumnFor(root) ?? root;
  const [added] = target.append(content);
  if (added) editor.select(added);
}
