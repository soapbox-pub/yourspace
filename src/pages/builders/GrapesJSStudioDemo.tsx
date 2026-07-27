import { useCallback, useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Editor } from 'grapesjs';
import { useNostr } from '@nostrify/react';
import { Blocks, Images, Layers } from 'lucide-react';

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
import { AssetList } from '@/components/builders/studio/AssetList';
import { BlockPalette } from '@/components/builders/studio/BlockPalette';
import { ImportNsiteDialog } from '@/components/builders/studio/ImportNsiteDialog';
import { Inspector } from '@/components/builders/studio/Inspector';
import { LayerTree } from '@/components/builders/studio/LayerTree';
import { PageSwitcher } from '@/components/builders/studio/PageSwitcher';
import { StudioToolbar } from '@/components/builders/studio/StudioToolbar';
import { useToast } from '@/hooks/useToast';
import {
  canvasResetCss,
  initialPage,
  nostrComponents,
  nsiteBlockDefs,
  nsiteDevices,
} from '@/lib/builders/nsiteBlocks';
import type { NsiteImport } from '@/lib/nsite/fetchNsite';
import {
  assetsOf,
  blankPage,
  isImageFile,
  pagesOf,
  releaseFiles,
  sortFiles,
  textFile,
  writeFile,
  type NsiteFile,
} from '@/lib/nsite/files';
import { describeRef } from '@/lib/nsite/manifest';
import { isHtmlDocument, toCanvasHtml, toSiteHtml } from '@/lib/nsite/siteHtml';

/**
 * GrapesJS with the stock chrome switched off and a React UI in its place,
 * holding an nsite rather than a document.
 *
 * `customUI: true` plus `panels.defaults: []` leaves the editor rendering
 * nothing but the canvas, and each manager is put in `custom` mode so it builds
 * no DOM of its own. Everything visible around the canvas — the palette, the
 * outline, the toolbar, the inspector — is an ordinary React component talking
 * to the editor's public API.
 *
 * The state around it is a flat list of files, which is all a NIP-5A manifest
 * describes. GrapesJS edits one of them at a time: switching pages serializes
 * the canvas back into the file it came from and parses the next one in. The
 * editor's own `PageManager` is deliberately unused, because its pages share a
 * single stylesheet and an nsite's don't.
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

const RESET_STYLE_ID = 'nsite-canvas-reset';
const SITE_STYLE_ID = 'nsite-site-css';

const ENTRY_PATH = '/index.html';

interface StudioProject {
  files: NsiteFile[];
  /** Which file the canvas is currently editing. Always an HTML page. */
  activePath: string;
  /** Set once a published site has been imported over the starting page. */
  origin: string | null;
}

/** A one-page site holding the same starting content as the stock demo. */
function initialProject(): StudioProject {
  return {
    files: [textFile(ENTRY_PATH, initialPage)],
    activePath: ENTRY_PATH,
    origin: null,
  };
}

/**
 * Styles the canvas document.
 *
 * The app's CSP forbids `data:` stylesheets, so this is inline `<style>` rather
 * than `canvas.styles`. Both elements are prepended, in this order, so that
 * GrapesJS's own stylesheet stays last in the head: the imported site's CSS has
 * to beat the reset, and an edit made in the inspector has to beat both.
 */
function styleCanvas(editor: Editor, siteCss: string) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;

  let reset = doc.getElementById(RESET_STYLE_ID);
  let site = doc.getElementById(SITE_STYLE_ID);

  if (!reset || !site) {
    reset?.remove();
    site?.remove();
    reset = doc.createElement('style');
    reset.id = RESET_STYLE_ID;
    site = doc.createElement('style');
    site.id = SITE_STYLE_ID;
    doc.head.prepend(reset, site);
  }

  reset.textContent = canvasResetCss(interLatin) + studioScrollbarCss;
  site.textContent = siteCss;
}

/**
 * The canvas as a file again — the exact bytes that would be uploaded for this
 * path.
 *
 * The CSS has to travel inside a `<style>` tag rather than being applied
 * separately. GrapesJS keys component styles to generated ids (`#i3f`), and
 * parsing markup and stylesheet together lets `Component.checkId` renumber both
 * in lockstep if anything collides. Applying them in two calls would leave the
 * rules pointing at ids the new components no longer have.
 */
function serializePage(editor: Editor, files: NsiteFile[]): string {
  const html = editor.getHtml();
  const css = editor.getCss()?.trim() ?? '';
  const styleTag = css ? `<style>\n${css}\n</style>` : '';

  // `ComponentWrapper.toHTML` decides between a fragment and a whole document
  // from whether the project carries a doctype, so this follows whatever was
  // last loaded. Put the stylesheet in the head when there is one, rather than
  // leaving it dangling after `</html>`.
  const merged = !styleTag
    ? html
    : html.includes('</head>')
      ? html.replace('</head>', `  ${styleTag}\n</head>`)
      : `${html}\n\n${styleTag}`;

  return toSiteHtml(merged, files);
}

/**
 * Offers the site's images to the stock asset picker, which is the one piece of
 * GrapesJS UI this page still uses (double-clicking an image opens it).
 */
function registerAssets(editor: Editor, files: NsiteFile[]) {
  editor.AssetManager.getAll().reset();
  editor.AssetManager.add(
    files.flatMap((file) =>
      file.url && isImageFile(file) ? [{ src: file.url, name: file.path }] : [],
    ),
  );
}

export function GrapesJSStudioDemo() {
  useSeoMeta({
    title: 'GrapesJS Studio — nsite builder demo',
    description:
      'GrapesJS driven by a custom React interface: import a published nsite, switch between its pages, edit it, and read back the files it would ship.',
  });

  const { nostr } = useNostr();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [output, setOutput] = useState({ html: '', json: '' });

  /*
   * The project is held in a ref as well as in state, because the editor's
   * `update` handler is installed once and would otherwise close over the
   * project as it was on mount. Every write goes through `commit`, so the two
   * cannot drift.
   */
  const [project, setProject] = useState<StudioProject>(initialProject);
  const projectRef = useRef(project);

  const commit = useCallback((next: StudioProject) => {
    projectRef.current = next;
    setProject(next);
  }, []);

  /** The active page's linked stylesheets, kept for canvas rebuilds. */
  const siteCssRef = useRef('');

  /**
   * Parses a stored file into the canvas.
   *
   * `setComponents` clears the existing components first, which releases their
   * ids back to the pool before the new markup is parsed — so ids in the
   * incoming HTML survive instead of every one colliding and being renumbered.
   * The stylesheet is dropped first for the same reason: rules belonging to the
   * outgoing components would otherwise linger and reattach to whatever
   * inherited their ids.
   */
  const renderPage = useCallback(
    (instance: Editor, text: string, files: NsiteFile[], basePath: string) => {
      const { html, css } = toCanvasHtml(text, files, basePath);

      siteCssRef.current = css;
      instance.select();
      instance.Css.clear();
      instance.setComponents(html, { asDocument: isHtmlDocument(html) });
      styleCanvas(instance, css);
    },
    [],
  );

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

    /*
     * Serialized as one re-parseable document rather than two labelled
     * sections, because the HTML tab is editable: the exact string shown is the
     * string handed back to `applyHtml`. The same string is written into the
     * active file, so the project is always a publishable set of files rather
     * than one live page and a set of stale siblings.
     */
    const syncOutput = () => {
      const current = projectRef.current;
      const html = serializePage(instance, current.files);

      setOutput({ html, json: JSON.stringify(instance.getProjectData(), null, 2) });
      commit({ ...current, files: writeFile(current.files, current.activePath, html) });
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
      styleCanvas(instance, siteCssRef.current);
      syncOutput();
    });
    // Re-apply after device switches, which rebuild the canvas frame.
    instance.on('canvas:frame:load', () => styleCanvas(instance, siteCssRef.current));

    setEditor(instance);
    syncOutput();

    return () => {
      window.clearTimeout(pending);
      setEditor(null);
      instance.destroy();
    };
    // `nostr` is the app's memoized pool, so this effect runs once.
  }, [nostr, commit]);

  // Imported blobs outlive React state unless they are handed back explicitly.
  useEffect(() => () => releaseFiles(projectRef.current.files), []);

  /** Saves the canvas into the file it came from before anything replaces it. */
  const flush = useCallback(
    (instance: Editor): NsiteFile[] => {
      const { files, activePath } = projectRef.current;
      return writeFile(files, activePath, serializePage(instance, files));
    },
    [],
  );

  const openPage = useCallback(
    (path: string) => {
      if (!editor || path === projectRef.current.activePath) return;

      const files = flush(editor);
      commit({ ...projectRef.current, files, activePath: path });
      renderPage(editor, files.find((file) => file.path === path)?.text ?? '', files, path);
      // Undo history belongs to the page that was open when it was recorded;
      // replaying it against a different page would splice the two together.
      editor.UndoManager.clear();
    },
    [editor, flush, commit, renderPage],
  );

  const createPage = useCallback(
    (path: string) => {
      if (!editor) return;

      const page = blankPage(path);
      const files = sortFiles([...flush(editor), page]);
      commit({ ...projectRef.current, files, activePath: path });
      renderPage(editor, page.text ?? '', files, path);
      editor.UndoManager.clear();
    },
    [editor, flush, commit, renderPage],
  );

  const importSite = useCallback(
    (result: NsiteImport) => {
      if (!editor) return;

      releaseFiles(projectRef.current.files);

      const { files, entry, manifest, missing } = result;
      commit({ files, activePath: entry, origin: manifest.title ?? describeRef(manifest.ref) });
      registerAssets(editor, files);
      renderPage(editor, files.find((file) => file.path === entry)?.text ?? '', files, entry);
      editor.UndoManager.clear();

      if (missing.length) {
        toast({
          title: `${missing.length} ${missing.length === 1 ? 'file' : 'files'} unavailable`,
          description: `No Blossom server produced matching bytes for ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''}.`,
        });
      }
    },
    [editor, commit, renderPage, toast],
  );

  /** Replaces the active page with hand-edited markup from the HTML tab. */
  const applyHtml = useCallback(
    (value: string) => {
      if (!editor) return;
      const { files, activePath } = projectRef.current;
      renderPage(editor, value, files, activePath);
    },
    [editor, renderPage],
  );

  const pages = pagesOf(project.files);
  const assets = assetsOf(project.files);

  return (
    <BuilderShell slug="grapesjs-studio" docsUrl="https://grapesjs.com/docs/">
      <div className="flex min-h-0 flex-1 flex-col">
        <StudioToolbar
          editor={editor}
          leading={
            <div className="flex items-center gap-2">
              <PageSwitcher
                pages={pages}
                activePath={project.activePath}
                onSelect={openPage}
                onCreate={createPage}
                disabled={!editor}
              />
              <ImportNsiteDialog onImport={importSite} disabled={!editor} />
              {project.origin && (
                <span
                  title={project.origin}
                  className="hidden max-w-40 truncate text-xs text-muted-foreground lg:inline"
                >
                  {project.origin}
                </span>
              )}
            </div>
          }
        />

        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Components, outline and assets"
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

            {/* Only an imported site has files that aren't pages. */}
            {assets.length > 0 && (
              <div className="flex max-h-[30%] shrink-0 flex-col border-t">
                <h2 className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3 text-xs font-semibold text-foreground">
                  <Images className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Assets
                  <span className="font-normal text-muted-foreground">{assets.length}</span>
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                  <AssetList editor={editor} assets={assets} />
                </div>
              </div>
            )}
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
                'The project data GrapesJS loads back into the editor: the component tree, style rules, assets, and pages. This covers the open page only — the rest of the site lives outside the editor, as files.',
              content: output.json,
            },
            {
              id: 'html',
              label: 'HTML',
              language: 'html',
              description:
                'Editable. This is the open page as it would ship to Blossom, with references back to their site paths — plain HTML with a stylesheet, no renderer or hydration step. Paste a whole document and the doctype, <html> attributes and <head> are kept; paste a fragment and it replaces the body. The Profile hero is recognised on the way back in. Script tags, embeds and inline event handlers are stripped on import.',
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
