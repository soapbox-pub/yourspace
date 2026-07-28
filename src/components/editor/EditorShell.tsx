import type { ReactNode } from 'react';

/**
 * The editor's outer column.
 *
 * There's no header here — the global `TopBar` is the app's only chrome, and a
 * second one would cost the canvas 60px for a duplicate of the same two
 * controls. A definite height (rather than a minimum) is what lets the panels
 * below size themselves with percentages and `flex-1`.
 */
export function EditorShell({ children }: { children: ReactNode }) {
  return (
    <div className="ys-below-bar flex flex-col overflow-hidden bg-background">
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
