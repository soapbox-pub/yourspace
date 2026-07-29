import type { ComponentType } from 'react';
import type { Editor } from 'grapesjs';
import {
  Columns2,
  Columns3,
  Frame,
  Heading2,
  Image,
  LayoutGrid,
  PanelLeft,
  StretchVertical,
  Type,
} from 'lucide-react';

import { nsiteBlockDefs, type NsiteBlockDef } from '@/lib/nsite/blocks';
import { cn } from '@/lib/utils';
import { insertContent } from './insertContent';
import {
  paletteIconClass,
  paletteLabelClass,
  paletteSectionClass,
  paletteTileClass,
} from './paletteCard';

interface BlockPaletteProps {
  editor: Editor | null;
}

const blockIcons: Record<string, ComponentType<{ className?: string }>> = {
  heading: Heading2,
  text: Type,
  image: Image,
  'two-columns': Columns2,
  'three-columns': Columns3,
  sidebar: PanelLeft,
  grid: LayoutGrid,
  'free-area': Frame,
  spacer: StretchVertical,
};

const categories = ['Basic', 'Layout'] as const;

function BlockCard({ def, editor }: { def: NsiteBlockDef; editor: Editor | null }) {
  const Icon = blockIcons[def.id] ?? Type;

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        if (!editor) return;
        const block = editor.BlockManager.get(def.id);
        if (!block) return;

        event.dataTransfer.effectAllowed = 'copy';
        // Firefox will not begin a drag unless the dataTransfer carries
        // something. GrapesJS reads the content from `dragSource` rather than
        // from the transfer, so the payload here is only a formality.
        event.dataTransfer.setData('text/plain', def.id);

        /*
         * `__startDrag` / `__drag` / `__endDrag` rather than the public
         * `startDrag` / `endDrag`, mirroring what GrapesJS's own `BlockView`
         * does for HTML5 drags.
         *
         * The public pair additionally toggles the *pointer*-driven drag mode
         * on every frame (`Droppable.startCustom`). That mode ends a drop from
         * `document`'s `pointerup`, so pairing it with native drag events means
         * `dragend` runs the sorter's `endDrag` a second time after the canvas
         * `drop` has already committed the component.
         */
        editor.BlockManager.__startDrag(block, event.nativeEvent);
      }}
      onDrag={(event) => editor?.BlockManager.__drag(event.nativeEvent)}
      onDragEnd={() => editor?.BlockManager.__endDrag()}
      onClick={() => editor && insertContent(editor, def.content)}
      // What the row of prose under each name used to say, kept where it costs
      // no room: the panel is a grid to be scanned, not read.
      title={`${def.description}. Drag onto the page, or click to drop it below the selection.`}
      className={cn(paletteTileClass, 'cursor-grab active:cursor-grabbing')}
    >
      <Icon className={paletteIconClass} aria-hidden="true" />
      <span className={paletteLabelClass}>{def.label}</span>
    </button>
  );
}

/**
 * The component drawer. Blocks are registered with GrapesJS's BlockManager as
 * usual — this only replaces the rendering, and hands drags back to the
 * manager so the canvas sorter behaves exactly as it does with stock chrome.
 */
export function BlockPalette({ editor }: BlockPaletteProps) {
  return (
    <div className="space-y-5">
      {categories.map((category) => {
        const defs = nsiteBlockDefs.filter((def) => def.category === category);
        if (!defs.length) return null;

        return (
          <section key={category}>
            <h3 className={cn(paletteSectionClass, 'mb-2 px-1')}>{category}</h3>
            <div className="grid grid-cols-2 gap-2">
              {defs.map((def) => (
                <BlockCard key={def.id} def={def} editor={editor} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
