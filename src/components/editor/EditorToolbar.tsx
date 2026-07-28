import { useState, type ReactNode } from 'react';
import type { Editor } from 'grapesjs';
import {
  Eye,
  Monitor,
  Move,
  Redo2,
  Smartphone,
  SquareDashed,
  Tablet,
  Undo2,
} from 'lucide-react';

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
  /** The primary action, sitting at the far end of the bar. Also not the editor's business. */
  trailing?: ReactNode;
}

const deviceIcons = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
} as const;

/** Togglable core commands: run to turn on, stop to turn off. */
const outlineCommand = 'core:component-outline';
const previewCommand = 'preview';

/**
 * Neither command is this bar's to own. Preview stops the outline command on
 * its way in and restarts it on the way out, and its own eye-slash button
 * leaves preview without touching this bar — so a `useState` mirror of either
 * one goes stale, and the next click is spent undoing a state the editor was
 * never in. Read the live state instead, and re-render when it changes.
 */
const commandEvents = [outlineCommand, previewCommand]
  .flatMap((id) => [`command:run:${id}`, `command:stop:${id}`])
  .join(' ');

const buttonClass =
  'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

export function EditorToolbar({ editor, leading, trailing }: EditorToolbarProps) {
  // Undo availability changes on every edit, and the device on every switch.
  useEditorEvent(editor, 'update change:device undo redo');
  useEditorEvent(editor, commandEvents);

  const [freeLayout, setFreeLayout] = useState(false);

  const undoManager = editor?.UndoManager;
  const activeDevice = editor?.getDevice();

  const outlines = editor?.Commands.isActive(outlineCommand) ?? false;
  const preview = editor?.Commands.isActive(previewCommand) ?? false;

  const toggleCommand = (id: string, active: boolean) => {
    if (!editor) return;
    if (active) editor.stopCommand(id);
    else editor.runCommand(id);
  };

  /**
   * Flow layout vs. free layout, for the whole page.
   *
   * In free layout GrapesJS drags components by writing `position:absolute` and
   * offsets onto them, with alignment guides, instead of sorting them into
   * their parent's flow — and a block dragged from the palette lands wherever
   * it was dropped rather than in the nearest container. Flow is still the
   * default, because a page built entirely out of absolute coordinates does not
   * survive a narrow screen.
   */
  const toggleFreeLayout = () => {
    if (!editor) return;
    const next = !freeLayout;
    setFreeLayout(next);
    editor.setDragMode(next ? 'absolute' : '');
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
      {/*
        The leading slot is the only part of this bar allowed to shrink. It
        holds the widest and least fixed content — a page path, and a site name
        that only appears once you've imported or published something — while
        everything after it is a control of a known size. Without that, the row
        overflows and takes the last thing in it off the edge of the screen,
        which happens to be the primary action.
      */}
      {leading && (
        <>
          <div className="flex min-w-0 shrink items-center">{leading}</div>
          <div className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
        </>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
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

      <div className="mx-auto flex shrink-0 items-center gap-1 rounded-lg bg-muted p-1">
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

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={toggleFreeLayout}
          aria-pressed={freeLayout}
          title="Free layout — drag anything anywhere"
          className={cn(buttonClass, freeLayout && 'bg-accent text-foreground')}
        >
          <Move className="size-4" aria-hidden="true" />
          <span className="sr-only">Free layout</span>
        </button>
        <button
          type="button"
          onClick={() => toggleCommand(outlineCommand, outlines)}
          aria-pressed={outlines}
          title="Show element outlines"
          className={cn(buttonClass, outlines && 'bg-accent text-foreground')}
        >
          <SquareDashed className="size-4" aria-hidden="true" />
          <span className="sr-only">Show element outlines</span>
        </button>
        <button
          type="button"
          onClick={() => toggleCommand(previewCommand, preview)}
          aria-pressed={preview}
          title="Preview"
          className={cn(buttonClass, preview && 'bg-accent text-foreground')}
        >
          <Eye className="size-4" aria-hidden="true" />
          <span className="sr-only">Preview</span>
        </button>
      </div>

      {trailing && (
        <>
          <div className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
          <div className="shrink-0">{trailing}</div>
        </>
      )}
    </div>
  );
}
