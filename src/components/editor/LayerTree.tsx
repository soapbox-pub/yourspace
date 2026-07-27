import { useState } from 'react';
import type { Component, Editor } from 'grapesjs';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { componentName, useEditorEvent } from './editorHooks';

interface LayerTreeProps {
  editor: Editor | null;
}

/**
 * Components opt out of the tree with `layerable: false` — which is how the
 * Profile hero's generated markup stays collapsed into a single row instead of
 * spilling its banner, avatar and headings into the outline.
 */
function layerChildren(component: Component): Component[] {
  return component
    .components()
    .filter((child: Component) => child.get('layerable') !== false);
}

interface LayerRowProps {
  component: Component;
  editor: Editor;
  selectedId?: string;
  depth: number;
}

function LayerRow({ component, editor, selectedId, depth }: LayerRowProps) {
  const children = layerChildren(component);
  const [open, setOpen] = useState(depth < 2);
  const selected = component.getId() === selectedId;

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-md pr-1 transition-colors',
          selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={open ? `Collapse ${componentName(component)}` : `Expand ${componentName(component)}`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn('size-3.5 transition-transform', open && 'rotate-90')}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => editor.select(component)}
          // Mirrors the outline back onto the canvas: the same highlight the
          // editor draws when you hover the element itself.
          onMouseEnter={() => editor.Canvas.addSpot({ type: 'hover', component })}
          onMouseLeave={() => editor.Canvas.removeSpots({ type: 'hover' })}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            'min-w-0 flex-1 truncate py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            selected ? 'font-medium' : 'text-muted-foreground group-hover:text-foreground',
          )}
        >
          {componentName(component)}
        </button>
      </div>

      {open && children.length > 0 && (
        <ul>
          {children.map((child) => (
            <LayerRow
              key={child.getId()}
              component={child}
              editor={editor}
              selectedId={selectedId}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The page outline. Reads straight off the component tree rather than through
 * GrapesJS's LayerManager, which is disabled on this page — the tree is just a
 * recursive walk, and the editor's change events say when to walk it again.
 */
export function LayerTree({ editor }: LayerTreeProps) {
  useEditorEvent(
    editor,
    'component:add component:remove component:selected component:deselected component:update:components component:update:name',
  );

  if (!editor) return null;

  const wrapper = editor.getWrapper();
  if (!wrapper) return null;

  const roots = layerChildren(wrapper);
  const selectedId = editor.getSelected()?.getId();

  if (!roots.length) {
    return (
      <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
        The page is empty. Drag a block in to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-px">
      {roots.map((component) => (
        <LayerRow
          key={component.getId()}
          component={component}
          editor={editor}
          selectedId={selectedId}
          depth={0}
        />
      ))}
    </ul>
  );
}
