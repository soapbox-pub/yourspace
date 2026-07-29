import type { ComponentType } from 'react';
import type { Editor } from 'grapesjs';
import { Heading2, Image, Type } from 'lucide-react';

import { nsiteBlockDefs, type NsiteBlockDef } from '@/lib/nsite/blocks';
import { cn } from '@/lib/utils';
import { insertContent } from './insertContent';
import { paletteCardClass, paletteIconClass } from './paletteCard';

interface BlockPaletteProps {
  editor: Editor | null;
}

const blockIcons: Record<string, ComponentType<{ className?: string }>> = {
  heading: Heading2,
  text: Type,
  image: Image,
};

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
      className={cn(paletteCardClass, 'cursor-grab active:cursor-grabbing')}
    >
      <span className={paletteIconClass}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight text-foreground">{def.label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {def.description}
        </span>
      </span>
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
    <div className="space-y-4">
      <div className="space-y-0.5">
        {nsiteBlockDefs.map((def) => (
          <BlockCard key={def.id} def={def} editor={editor} />
        ))}
      </div>

      <p className="px-2.5 pt-1 text-xs leading-relaxed text-muted-foreground/80">
        Drag a block onto the page, or click to drop it below the current selection.
      </p>
    </div>
  );
}
