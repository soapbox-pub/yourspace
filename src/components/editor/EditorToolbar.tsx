import { useState, type ReactNode } from 'react';
import type { Editor } from 'grapesjs';
import { Eye, Monitor, Redo2, Smartphone, SquareDashed, Tablet, Undo2 } from 'lucide-react';

import { nsiteDevices } from '@/lib/nsite/blocks';
import { cn } from '@/lib/utils';
import { useEditorEvent } from './editorHooks';

interface EditorToolbarProps {
  editor: Editor | null;
  /**
   * Site-level controls — which page is open, and where the site came from.
   * A slot rather than props, because none of it is the editor's business.
   */
  leading?: ReactNode;
}

const deviceIcons = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
} as const;

const buttonClass =
  'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

export function EditorToolbar({ editor, leading }: EditorToolbarProps) {
  // Undo availability changes on every edit, and the device on every switch.
  useEditorEvent(editor, 'update change:device undo redo');

  const [outlines, setOutlines] = useState(true);
  const [preview, setPreview] = useState(false);

  const undoManager = editor?.UndoManager;
  const activeDevice = editor?.getDevice();

  const toggleOutlines = () => {
    if (!editor) return;
    const next = !outlines;
    setOutlines(next);
    // A togglable core command: run to draw the dashed boxes, stop to hide them.
    if (next) editor.runCommand('core:component-outline');
    else editor.stopCommand('core:component-outline');
  };

  const togglePreview = () => {
    if (!editor) return;
    const next = !preview;
    setPreview(next);
    if (next) editor.runCommand('preview');
    else editor.stopCommand('preview');
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
      {leading && (
        <>
          {leading}
          <div className="h-6 w-px bg-border" aria-hidden="true" />
        </>
      )}

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => undoManager?.undo()}
          disabled={!undoManager?.hasUndo()}
          title="Undo"
          className={buttonClass}
        >
          <Undo2 className="size-4" aria-hidden="true" />
          <span className="sr-only">Undo</span>
        </button>
        <button
          type="button"
          onClick={() => undoManager?.redo()}
          disabled={!undoManager?.hasRedo()}
          title="Redo"
          className={buttonClass}
        >
          <Redo2 className="size-4" aria-hidden="true" />
          <span className="sr-only">Redo</span>
        </button>
      </div>

      <div className="mx-auto flex items-center gap-1 rounded-lg bg-muted p-1">
        {nsiteDevices.map((device) => {
          const Icon = deviceIcons[device.id as keyof typeof deviceIcons];
          // `getDevice()` returns the id, but accept the name too — the same
          // leniency `DeviceManager.get()` has.
          const active = activeDevice === device.id || activeDevice === device.name;

          return (
            <button
              key={device.id}
              type="button"
              onClick={() => editor?.setDevice(device.id)}
              aria-pressed={active}
              title={device.name}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{device.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggleOutlines}
          aria-pressed={outlines}
          title="Show element outlines"
          className={cn(buttonClass, outlines && 'bg-accent text-foreground')}
        >
          <SquareDashed className="size-4" aria-hidden="true" />
          <span className="sr-only">Show element outlines</span>
        </button>
        <button
          type="button"
          onClick={togglePreview}
          aria-pressed={preview}
          title="Preview"
          className={cn(buttonClass, preview && 'bg-accent text-foreground')}
        >
          <Eye className="size-4" aria-hidden="true" />
          <span className="sr-only">Preview</span>
        </button>
      </div>
    </div>
  );
}
