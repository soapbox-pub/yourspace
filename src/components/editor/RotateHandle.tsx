import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from 'grapesjs';
import { RotateCw } from 'lucide-react';

import { isLayoutRow } from '@/lib/nsite/layout';
import { cn } from '@/lib/utils';
import { useSelectedComponent } from './editorHooks';
import { rotateDegrees, setRotation } from './styleTarget';

/** How far above the element's top edge the handle floats. */
const HANDLE_GAP = 8;

interface HandleSpot {
  /** The element's center, in viewport coordinates — the drag pivot. */
  cx: number;
  cy: number;
  /** Where the bottom of the handle's stem sits: top edge, centered. */
  x: number;
  y: number;
}

/**
 * The drag-to-rotate handle, floating above the selected element.
 *
 * Rendered in the outer document rather than inside the canvas frame, the
 * same place GrapesJS keeps its own toolbar: anything injected into the frame
 * would end up in the published markup.
 *
 * A drag previews by writing an inline `rotate` straight onto the canvas
 * element and only commits to the component's styles on release — one undo
 * step per rotation, instead of one per pointer move.
 */
export function RotateHandle({ editor }: { editor: Editor | null }) {
  const selected = useSelectedComponent(editor);
  const [spot, setSpot] = useState<HandleSpot | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    el: HTMLElement;
    cx: number;
    cy: number;
    /** The element's inline `rotate` from before the drag, restored on commit. */
    inline: string;
  } | null>(null);

  // The wrapper is the page itself, and a layout row is a frame around its
  // columns rather than an element on the page — neither is a thing to turn.
  const rotatable = Boolean(
    editor && selected && selected !== editor.getWrapper() && !isLayoutRow(selected),
  );

  /*
   * Follow the element frame by frame. No combination of editor events covers
   * every way the selection can move — canvas scroll, zoom, dragging, edits
   * from another panel — so the handle re-reads the geometry instead of
   * subscribing to a list that can drift out of date.
   */
  useEffect(() => {
    if (!editor || !rotatable || !selected) return;

    let frameId = 0;
    const track = () => {
      const el = selected.getEl();
      if (el?.isConnected) {
        const rect = el.getBoundingClientRect();
        const frameRect = editor.Canvas.getFrameEl().getBoundingClientRect();
        // The frame sits under a `scale()` transform, so distances inside it
        // reach the outer document multiplied by the zoom.
        const zoom = editor.Canvas.getZoomDecimal();
        const next = {
          cx: frameRect.left + (rect.left + rect.width / 2) * zoom,
          cy: frameRect.top + (rect.top + rect.height / 2) * zoom,
          x: frameRect.left + (rect.left + rect.width / 2) * zoom,
          y: frameRect.top + rect.top * zoom - HANDLE_GAP,
        };
        setSpot((prev) =>
          prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 ? prev : next,
        );
      }
      frameId = requestAnimationFrame(track);
    };

    frameId = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frameId);
  }, [editor, selected, rotatable]);

  const endDrag = useCallback(
    (commit: boolean) => {
      const active = drag.current;
      drag.current = null;
      setDragging(false);
      if (!active) return;

      const angle = active.el.style.getPropertyValue('rotate');
      active.el.style.setProperty('rotate', active.inline);
      if (commit && selected && angle) setRotation(selected, Number.parseFloat(angle));
    },
    [selected],
  );

  /* Escape cancels mid-drag, returning the element to its starting angle. */
  useEffect(() => {
    if (!dragging) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') endDrag(false);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [dragging, endDrag]);

  /* Pointer capture keeps the button's cursor, so borrow the page's instead. */
  useEffect(() => {
    if (!dragging) return;
    document.body.style.cursor = 'grabbing';
    return () => {
      document.body.style.cursor = '';
    };
  }, [dragging]);

  if (!spot || !rotatable || !selected) return null;

  return (
    <div
      className="pointer-events-none fixed z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={{ left: spot.x, top: spot.y }}
    >
      <button
        type="button"
        title="Drag to rotate"
        aria-label={`Drag to rotate (currently ${rotateDegrees(selected)}°)`}
        onPointerDown={(event) => {
          const el = selected.getEl();
          if (!el) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            el,
            cx: spot.cx,
            cy: spot.cy,
            inline: el.style.getPropertyValue('rotate'),
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active?.el.isConnected) return;
          // The handle sits above the element, so a pointer straight up is 0°.
          const degrees =
            (Math.atan2(event.clientY - active.cy, event.clientX - active.cx) * 180) / Math.PI +
            90;
          active.el.style.setProperty('rotate', `${Math.round(degrees * 10) / 10}deg`);
        }}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onLostPointerCapture={() => endDrag(false)}
        className={cn(
          'pointer-events-auto flex size-6 touch-none items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-transform',
          'hover:scale-110 focus-visible:outline-none focus-visible:ring-primary',
          dragging ? 'scale-110' : 'cursor-grab',
        )}
      >
        <RotateCw className="size-3.5" aria-hidden="true" />
      </button>
      <span className="h-2 w-px bg-primary/70" aria-hidden="true" />
    </div>
  );
}
