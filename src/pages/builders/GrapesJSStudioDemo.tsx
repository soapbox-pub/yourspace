import { useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Editor } from 'grapesjs';
import { useNostr } from '@nostrify/react';
import { Blocks, Layers } from 'lucide-react';

// Inter, for the canvas iframe. Font faces don't cross a document boundary, so
// the app's @fontsource import doesn't reach the page being edited.
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';

// Only the canvas tooling is used from GrapesJS's stylesheet — the selection
// outline, the badge, the component toolbar and the sorter's drop indicator.
// `grapesjs-studio.css` restyles those and resets what the stock demo's
// overrides leave on `:root`. No Font Awesome: this page draws its own icons.
import 'grapesjs/dist/css/grapes.min.css';
import '@/components/builders/grapesjs-studio.css';

import { BuilderShell } from '@/components/builders/BuilderShell';
import { OutputPanel } from '@/components/builders/OutputPanel';
import { BlockPalette } from '@/components/builders/studio/BlockPalette';
import { Inspector } from '@/components/builders/studio/Inspector';
import { LayerTree } from '@/components/builders/studio/LayerTree';
import { StudioToolbar } from '@/components/builders/studio/StudioToolbar';
import {
  canvasResetCss,
  initialPage,
  nostrComponents,
  nsiteBlockDefs,
  nsiteDevices,
} from '@/lib/builders/nsiteBlocks';

/**
 * GrapesJS with the stock chrome switched off and a React UI in its place.
 *
 * `customUI: true` plus `panels.defaults: []` leaves the editor rendering
 * nothing but the canvas, and each manager is put in `custom` mode so it builds
 * no DOM of its own. Everything visible around the canvas — the palette, the
 * outline, the toolbar, the inspector — is an ordinary React component talking
 * to the editor's public API.
 *
 * The blocks and the Profile hero component are shared with `/builders/grapesjs`
 * via `@/lib/builders/nsiteBlocks`, so the two pages differ only in their shell.
 */

const blocks = nsiteBlockDefs.map(({ id, label, category, content }) => ({
  id,
  label,
  category,
  content,
}));

/**
 * The page surface has a border and rounded corners here, and a classic
 * scrollbar sits *inside* them — a ~15px strip of track between the border and
 * the content, which reads as stray padding down the right edge rather than as
 * part of the page being edited.
 *
 * Platforms with overlay scrollbars (macOS, and Chrome headless) never show
 * this, so it looks fine right up until someone opens it on Linux or Windows.
 *
 * Thinning it and making the track transparent keeps the scroll affordance
 * while letting the page's own background run to the border. Applied to the
 * canvas document only — the stock demo's square, full-bleed canvas has nowhere
 * for the strip to look wrong.
 */
const studioScrollbarCss = `
  html{scrollbar-width:thin;scrollbar-color:rgba(100,116,139,.4) transparent;}
  html::-webkit-scrollbar{width:8px;height:8px;}
  html::-webkit-scrollbar-track{background:transparent;}
  html::-webkit-scrollbar-thumb{background-color:rgba(100,116,139,.4);border-radius:9999px;}
  html::-webkit-scrollbar-thumb:hover{background-color:rgba(100,116,139,.6);}
`;

export function GrapesJSStudioDemo() {
  useSeoMeta({
    title: 'GrapesJS Studio — nsite builder demo',
    description:
      'GrapesJS driven by a custom React interface: component settings on selection, drag-and-drop blocks, no stock panels.',
  });

  const { nostr } = useNostr();
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [output, setOutput] = useState({ html: '', json: '' });

  useEffect(() => {
    if (!containerRef.current) return;

    const instance: Editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      // Drops the stock theme classes and lets the canvas fill its container
      // instead of leaving 15% for a right-hand panel that no longer exists.
      customUI: true,
      plugins: [nostrComponents(nostr)],
      components: initialPage,
      // No backend in this demo, so keep everything in memory.
      storageManager: false,
      // Suppresses the Font Awesome CDN request, which the app's CSP blocks.
      cssIcons: '',
      panels: { defaults: [] },
      // `custom` stops each manager building a DOM view it would have no panel
      // to live in. The models stay exactly as they are — the React panels read
      // blocks, traits, layers and styles straight off them.
      blockManager: { custom: true, blocks },
      layerManager: { custom: true },
      styleManager: { custom: true },
      traitManager: { custom: true },
      deviceManager: { devices: nsiteDevices },
    });

    // The app's CSP forbids `data:` stylesheets, so style the canvas with an
    // inline <style> element instead of `canvas.styles`.
    const styleCanvas = () => {
      const doc = instance.Canvas.getDocument();
      if (!doc || doc.getElementById('nsite-canvas-reset')) return;

      const style = doc.createElement('style');
      style.id = 'nsite-canvas-reset';
      style.textContent = canvasResetCss(interLatin) + studioScrollbarCss;
      doc.head.appendChild(style);
    };

    /*
     * Serialized as one re-parseable document rather than two labelled
     * sections, because this tab is editable: the exact string shown is the
     * string handed back to `setComponents`.
     *
     * The CSS has to travel inside a `<style>` tag rather than being applied
     * separately. GrapesJS keys component styles to generated ids (`#i3f`), and
     * parsing markup and stylesheet together lets `Component.checkId` renumber
     * both in lockstep if anything collides. Applying them in two calls would
     * leave the rules pointing at ids the new components no longer have.
     */
    const syncOutput = () => {
      const css = instance.getCss() ?? '';
      setOutput({
        html: `${instance.getHtml()}\n\n<style>\n${css}\n</style>`,
        json: JSON.stringify(instance.getProjectData(), null, 2),
      });
    };

    // `update` fires on every model change, including each keystroke while
    // editing text. Serializing the whole project that often visibly janks the
    // editor, and the output drawer only needs to settle.
    let pending: number | undefined;
    const queueSync = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(syncOutput, 250);
    };

    instance.on('update', queueSync);
    instance.on('load', () => {
      styleCanvas();
      syncOutput();
    });
    // Re-apply after device switches, which rebuild the canvas frame.
    instance.on('canvas:frame:load', styleCanvas);

    setEditor(instance);
    syncOutput();

    return () => {
      window.clearTimeout(pending);
      setEditor(null);
      instance.destroy();
    };
    // `nostr` is the app's memoized pool, so this effect runs once.
  }, [nostr]);

  /**
   * Replaces the page with hand-edited markup.
   *
   * `setComponents` clears the existing components first, which releases their
   * ids back to the pool before the new markup is parsed — so ids in the
   * pasted HTML survive instead of every one colliding and being renumbered.
   * The stylesheet is dropped first for the same reason: rules belonging to the
   * outgoing components would otherwise linger and reattach to whatever
   * inherited their ids.
   */
  const applyHtml = (value: string) => {
    if (!editor) return;

    editor.select();
    editor.Css.clear();
    editor.setComponents(value);
  };

  return (
    <BuilderShell slug="grapesjs-studio" docsUrl="https://grapesjs.com/docs/">
      <div className="flex min-h-0 flex-1 flex-col">
        <StudioToolbar editor={editor} />

        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Components and outline"
            className="flex w-64 shrink-0 flex-col border-r bg-sidebar"
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <h2 className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3 text-xs font-semibold text-foreground">
                <Blocks className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Components
              </h2>
              <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
                <BlockPalette editor={editor} />
              </div>
            </div>

            <div className="flex max-h-[38%] shrink-0 flex-col border-t">
              <h2 className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3 text-xs font-semibold text-foreground">
                <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Outline
              </h2>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                <LayerTree editor={editor} />
              </div>
            </div>
          </aside>

          {/*
            `nsite-studio` scopes every GrapesJS canvas override to this page.
            This is the desk the page sits on; the page's own border, rounding
            and shadow live on the frame (see grapesjs-studio.css), because that
            is the element the device switcher resizes.

            The inner div is what the editor mounts into, and needs a definite
            size because the canvas positions itself absolutely inside it.
          */}
          <main className="nsite-studio min-h-0 flex-1 bg-muted/40 p-4">
            <div ref={containerRef} className="h-full w-full" />
          </main>

          <aside
            aria-label="Element settings"
            className="w-[19rem] shrink-0 overflow-y-auto border-l bg-sidebar"
          >
            <Inspector editor={editor} />
          </aside>
        </div>

        <OutputPanel
          title="GrapesJS output"
          tabs={[
            {
              id: 'json',
              label: 'JSON',
              language: 'json',
              description:
                'The project data GrapesJS loads back into the editor: the component tree, style rules, assets, and pages. Identical to the stock demo — the chrome does not change what gets stored.',
              content: output.json,
            },
            {
              id: 'html',
              label: 'HTML',
              language: 'html',
              description:
                'Editable. This is the page as it would ship to Blossom — plain HTML with a stylesheet, no renderer or hydration step. Change it and Apply to rebuild the canvas from your markup; the Profile hero is recognised on the way back in.',
              content: output.html,
              onApply: applyHtml,
            },
          ]}
        />
      </div>
    </BuilderShell>
  );
}

export default GrapesJSStudioDemo;
