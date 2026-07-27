import { useEffect, useReducer, useState } from 'react';
import type { Component, Editor } from 'grapesjs';

/**
 * GrapesJS state lives in Backbone models, which React knows nothing about.
 * These hooks are the whole bridge: subscribe to the editor's events, and force
 * a render when something the panel displays has changed.
 *
 * Event names are space-separated lists, which Backbone's `on` splits for us.
 */

/** Re-renders the calling component whenever any of `events` fires. */
export function useEditorEvent(editor: Editor | null, events: string): void {
  // `dispatch` from useReducer is referentially stable, so it can be handed
  // straight to `off` without a ref dance.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!editor) return;
    editor.on(events, bump);
    return () => {
      editor.off(events, bump);
    };
  }, [editor, events]);
}

/** The currently selected component, or undefined when the canvas is clear. */
export function useSelectedComponent(editor: Editor | null): Component | undefined {
  const [selected, setSelected] = useState<Component | undefined>();

  useEffect(() => {
    if (!editor) return;

    const sync = () => setSelected(editor.getSelected());
    editor.on('component:selected component:deselected', sync);
    // The editor may already have a selection by the time this mounts.
    sync();

    return () => {
      editor.off('component:selected component:deselected', sync);
    };
  }, [editor]);

  return selected;
}

/**
 * A component's display name for panels and the layer tree.
 *
 * `getName()` already resolves the custom `name` on registered types (the
 * Profile hero), falling back to a humanized tag name.
 */
export function componentName(component: Component): string {
  return component.getName() || component.get('tagName') || 'Element';
}
