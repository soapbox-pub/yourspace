import type { ComponentType } from 'react';
import type { Editor } from 'grapesjs';
import {
  Columns2,
  Contact,
  FileText,
  Heading2,
  Image,
  KeyRound,
  Link2,
  MessagesSquare,
  Type,
  Zap,
} from 'lucide-react';

import { nsiteBlockDefs, type NsiteBlockDef } from '@/lib/nsite/blocks';
import { cn } from '@/lib/utils';
import { insertContent } from './insertContent';

interface BlockPaletteProps {
  editor: Editor | null;
}

const blockIcons: Record<string, ComponentType<{ className?: string }>> = {
  hero: Contact,
  about: FileText,
  links: Link2,
  notes: MessagesSquare,
  zap: Zap,
  footer: KeyRound,
  heading: Heading2,
  text: Type,
  'two-columns': Columns2,
  image: Image,
};

const categories = ['Basic', 'Nostr'] as const;

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
      className={cn(
        'group flex w-full cursor-grab items-start gap-3 rounded-lg border border-transparent bg-card p-2.5 text-left transition-all',
        'hover:border-border hover:bg-accent hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'active:cursor-grabbing',
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
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
      {categories.map((category) => {
        const defs = nsiteBlockDefs.filter((def) => def.category === category);
        if (!defs.length) return null;

        return (
          <section key={category}>
            <h3 className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {category}
            </h3>
            <div className="space-y-0.5">
              {defs.map((def) => (
                <BlockCard key={def.id} def={def} editor={editor} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="px-2.5 pt-1 text-xs leading-relaxed text-muted-foreground/80">
        Drag a block onto the page, or click to drop it below the current selection.
      </p>
    </div>
  );
}
