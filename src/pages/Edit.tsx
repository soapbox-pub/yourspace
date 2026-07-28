import { useCallback, useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Editor } from 'grapesjs';
import { Blocks, Images, Layers } from 'lucide-react';

// Only the canvas tooling is used from GrapesJS's stylesheet — the selection
// outline, the badge, the component toolbar and the sorter's drop indicator.
// `grapesjs-studio.css` restyles those. No Font Awesome: this page draws its
// own icons.
import 'grapesjs/dist/css/grapes.min.css';
import '@/components/editor/grapesjs.css';

import { Spinner } from '@/components/Spinner';
import { EditorShell } from '@/components/editor/EditorShell';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { AssetList } from '@/components/editor/AssetList';
import { BlockPalette } from '@/components/editor/BlockPalette';
import { GifPicker } from '@/components/editor/GifPicker';
import { ImportNsiteDialog } from '@/components/editor/ImportNsiteDialog';
import { Inspector } from '@/components/editor/Inspector';
import { LayerTree } from '@/components/editor/LayerTree';
import { PageSwitcher } from '@/components/editor/PageSwitcher';
import { PublishNsiteDialog } from '@/components/editor/PublishNsiteDialog';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { registerTextAlign } from '@/components/editor/richText';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOwnNsite } from '@/hooks/useOwnNsite';
import { useToast } from '@/hooks/useToast';
import { useUploadFile } from '@/hooks/useUploadFile';
import {
  canvasResetCss,
  initialPage,
  nsiteBlockDefs,
  nsiteDevices,
  resizableComponents,
} from '@/lib/nsite/blocks';
import type { FontFamily } from '@/lib/fonts/catalogue';
import { addFontFace, pruneFontFaces } from '@/lib/fonts/faces';
import {
  fetchFontFile,
  fontFileUrl,
  fontFilePath,
  installWeights,
  pruneFontFiles,
} from '@/lib/fonts/install';
import { foreignComponents, foreignPlaceholderCss } from '@/lib/nsite/foreign';
import type { NsiteImport } from '@/lib/nsite/fetchNsite';
import { sha256Hex } from '@/lib/nsite/blobs';
import {
  assetPath,
  assetsOf,
  binaryFile,
  blankPage,
  isImageFile,
  mimeForPath,
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
 * canvas document only, so the app's own scrollbars are left alone.
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

/** A one-page site holding the blank starting page. */
function initialProject(): StudioProject {
  return {
    files: [textFile(ENTRY_PATH, initialPage)],
    activePath: ENTRY_PATH,
    origin: null,
  };
}

/**
 * What the canvas holds while a signed-in key's own site is still coming.
 *
 * Nothing at all, not even the blank starting page. The file about to be
 * committed is this key's own, and seeding one first would mean the canvas
 * spends the wait editing a page that is about to be thrown away, undo history
 * and all.
 */
function pendingProject(): StudioProject {
  return {
    files: [textFile(ENTRY_PATH, '')],
    activePath: ENTRY_PATH,
    origin: null,
  };
}

/**
 * Styles the canvas document.
 *
 * The app's CSP forbids `data:` stylesheets, so this is inline `<style>` rather
 * than `canvas.styles`. Both elements are prepended, in this order, so that
 * GrapesJS's own stylesheet stays last in the head: the site's CSS has to beat
 * the reset, and an edit made in the inspector has to beat both.
 *
 * Both stylesheets are the same for every page. The reset is the editor
 * artifact fix, the scrollbar treatment and the placeholder chips standing in
 * for scripts and embeds — none of it page styling, and none of it something a
 * site should have to override.
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

  reset.textContent = canvasResetCss + studioScrollbarCss + foreignPlaceholderCss;
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

export function Edit() {
  useSeoMeta({
    title: 'Editor — YourSpace',
    description:
      'Build your homepage block by block: import a published nsite, switch between its pages, edit it, and read back the files it would ship.',
  });

  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutateAsync: uploadFile } = useUploadFile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [html, setHtml] = useState('');

  /*
   * Opening the editor while signed in opens your own site, if you have one.
   *
   * The key is read once, when the page mounts, and the import is a one-shot:
   * signing in halfway through building something must not replace it, and
   * switching accounts is not a request to throw away the site on the canvas.
   * Either of those is what the Import button is for.
   */
  const [owner] = useState(() => user?.pubkey);
  const ownSite = useOwnNsite(owner);
  const imported = useRef(false);

  /**
   * Whether the canvas is being held for the signed-in key's own site.
   *
   * Signed out there is nothing to wait for, so the starting page goes up
   * immediately. Signed in it is held back until the answer arrives, because
   * until then there is no telling whether this key has a site of its own —
   * and opening a blank page for someone who does means showing them the wrong
   * page and taking it away again.
   */
  const [awaitingOwnSite, setAwaitingOwnSite] = useState(() => !!owner);

  /*
   * The project is held in a ref as well as in state, because the editor's
   * `update` handler is installed once and would otherwise close over the
   * project as it was on mount. Every write goes through `commit`, so the two
   * cannot drift.
   */
  const [project, setProject] = useState<StudioProject>(() =>
    owner ? pendingProject() : initialProject(),
  );
  const projectRef = useRef(project);

  const commit = useCallback((next: StudioProject) => {
    projectRef.current = next;
    setProject(next);
  }, []);

  /** The active page's linked stylesheets, kept for canvas rebuilds. */
  const siteCssRef = useRef('');

  /** Re-applies both canvas stylesheets from whatever the project holds now. */
  const paintCanvas = useCallback((instance: Editor) => {
    styleCanvas(instance, siteCssRef.current);
  }, []);

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
      paintCanvas(instance);
    },
    [paintCanvas],
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
      plugins: [foreignComponents, resizableComponents],
      // Empty, whatever the page is going to hold. `components` has no way to
      // say that markup is a whole document, and the starting page is one, so
      // it goes in below through the same parse every other file takes.
      components: '',
      // No backend in this demo, so keep everything in memory.
      storageManager: false,
      // Suppresses the Font Awesome CDN request, which the app's CSP blocks.
      cssIcons: '',
      panels: { defaults: [] },
      canvas: {
        /*
         * Emptied, because the default is `body { background-color: #fff }` and
         * a pair of scrollbar rules, appended to the frame's `<body>` — after
         * everything in `<head>`, so it outranks both stylesheets below and
         * paints over any site that colours `html` rather than `body`.
         *
         * Nothing here is load-bearing: the backdrop is on `.gjs-frame`, behind
         * the frame where a page can't be painted over by it, and the scrollbars
         * are in `studioScrollbarCss`. The wrapper sizing and the dashed-outline
         * rules GrapesJS injects alongside it are separate, and stay.
         */
        frameStyle: '',
      },
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
     * Serialized as one re-parseable document, because the code panel is
     * editable: the exact string shown is the string handed back to
     * `applyHtml`. The same string is written into the active file, so the
     * project is always a publishable set of files rather than one live page
     * and a set of stale siblings.
     */
    const syncOutput = () => {
      const current = projectRef.current;
      const page = serializePage(instance, current.files);

      setHtml(page);
      commit({ ...current, files: writeFile(current.files, current.activePath, page) });
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
      // The text toolbar exists by now, so this is where its extra buttons go.
      registerTextAlign(instance);
      paintCanvas(instance);
      syncOutput();
    });
    // Re-apply after device switches, which rebuild the canvas frame.
    instance.on('canvas:frame:load', () => paintCanvas(instance));

    setEditor(instance);

    // Whatever the project opened on: the starting page signed out, nothing at
    // all while a signed-in key's own site is on its way. `paintCanvas` inside
    // is a no-op until the frame exists, and the `load` handler above runs it
    // again once it does.
    const { files, activePath } = projectRef.current;
    renderPage(instance, files[0].text ?? '', files, activePath);

    syncOutput();

    return () => {
      window.clearTimeout(pending);
      setEditor(null);
      instance.destroy();
    };
    // These are all stable callbacks, so this effect runs once.
  }, [commit, paintCanvas, renderPage]);

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

  /**
   * Puts the starting page on the canvas.
   *
   * For a key with no site of its own, which is the point at which a blank
   * canvas stops being a placeholder for something incoming and becomes the
   * thing you're meant to edit.
   */
  const startFresh = useCallback(() => {
    if (!editor) return;

    const fresh = initialProject();
    commit(fresh);
    renderPage(editor, fresh.files[0].text ?? '', fresh.files, fresh.activePath);
    editor.UndoManager.clear();
  }, [editor, commit, renderPage]);

  useEffect(() => {
    // `isPending` stays true while the query is disabled, which is the signed
    // out case — there is nothing coming, and the template is already up.
    if (!editor || imported.current || ownSite.isPending) return;

    // Whatever the answer was, it was for the page as it opened. Acting on it
    // twice would be overwriting work done since.
    imported.current = true;

    // Writing state from an effect, deliberately: the site arrives from the
    // network, which is exactly the external event an effect is for, and this
    // runs once in the life of the page rather than on every render.
    setAwaitingOwnSite(false);

    if (ownSite.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      importSite(ownSite.data);
      return;
    }

    if (ownSite.error) {
      // Not for the absence of a site — that resolves rather than rejects, and
      // the starting page is the right thing to offer someone who hasn't
      // published one. This is a site that exists and wouldn't come.
      toast({
        title: 'Could not open your site',
        description: `${ownSite.error.message} The editor has opened on the starting page instead.`,
        variant: 'destructive',
      });
    }

    // Held back until now precisely so it couldn't be mistaken for the site
    // being fetched. This key has none, so the template is what it should get.
    startFresh();
  }, [editor, ownSite.isPending, ownSite.data, ownSite.error, importSite, startFresh, toast]);

  /**
   * Puts an image on Blossom and into the site.
   *
   * Both halves are needed: the upload is what makes the bytes fetchable by
   * anyone else, and the file entry is what puts the path in a manifest and the
   * thumbnail in the assets rail. The bytes also stay here as an object URL, so
   * the canvas paints straight away and `toSiteHtml` has something to map back
   * to a site path — the same shape an imported file has.
   *
   * The hash is digested from the bytes rather than read out of the upload's
   * `x` tag. It is what a manifest would have to carry, and the point of a
   * hash-addressed store is that the server doesn't get to say what it holds.
   */
  const addImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        await uploadFile(file);

        const sha256 = await sha256Hex(await file.arrayBuffer());
        const path = assetPath(projectRef.current.files, file.name, file.type);
        const url = URL.createObjectURL(file);
        const asset: NsiteFile = {
          path,
          url,
          type: file.type || mimeForPath(path),
          size: file.size,
          sha256,
        };

        const files = sortFiles([...projectRef.current.files, asset]);
        commit({ ...projectRef.current, files });
        if (editor) registerAssets(editor, files);

        return url;
      } catch (error) {
        toast({
          title: 'Upload failed',
          description:
            error instanceof Error ? error.message : 'No Blossom server accepted the image.',
          variant: 'destructive',
        });
        return null;
      }
    },
    [editor, uploadFile, commit, toast],
  );

  /**
   * Puts a chosen font into the site.
   *
   * Downloaded rather than linked. A `<link>` to a font CDN would make every
   * published page depend forever on a host its author has no claim on, so the
   * `.woff2` files become files of the site like any image — which is also what
   * lets them be served from wherever the nsite is.
   *
   * Weights already present are not fetched again: picking the same family for
   * a second element is free, and so is picking one back after changing your
   * mind, since the fetch cache outlives the files.
   */
  const addFont = useCallback(
    async (font: FontFamily): Promise<boolean> => {
      if (!editor) return false;

      const wanted = installWeights(font).map((weight) => ({
        weight,
        path: fontFilePath(font, weight),
      }));

      try {
        const present = new Set(projectRef.current.files.map((file) => file.path));
        const added: NsiteFile[] = [];

        for (const { weight, path } of wanted) {
          if (present.has(path)) continue;
          added.push(binaryFile(path, await fetchFontFile(fontFileUrl(font, weight))));
        }

        const files = added.length
          ? sortFiles([...projectRef.current.files, ...added])
          : projectRef.current.files;

        if (added.length) commit({ ...projectRef.current, files });

        // Declared against the object URLs, so the canvas renders the font now;
        // `toSiteHtml` turns them back into site paths when the page is saved.
        const byPath = new Map(files.map((file) => [file.path, file]));
        for (const { weight, path } of wanted) {
          const url = byPath.get(path)?.url;
          if (url) addFontFace(editor, { family: font.family, weight, src: url });
        }

        return true;
      } catch (error) {
        toast({
          title: 'Could not add that font',
          description:
            error instanceof Error ? error.message : 'The font files could not be downloaded.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [editor, commit, toast],
  );

  /** Drops faces the page stopped using, once a font change has been written. */
  const tidyFonts = useCallback(() => {
    if (editor) pruneFontFaces(editor);
  }, [editor]);

  /**
   * The site as it stands, for publishing.
   *
   * The canvas is written back into its file first: `update` is debounced, so
   * the last few seconds of editing may not have reached the project yet, and
   * deploying a page without them would silently drop work the user can see.
   *
   * Unused fonts are dropped from what ships, but not from the project: their
   * object URLs may still be named by an `@font-face` an undo would bring back,
   * and a file removed here would leave that rule pointing at a `blob:` URL
   * with nothing left to map it back to a site path.
   */
  const publishableFiles = useCallback((): NsiteFile[] => {
    if (!editor) return pruneFontFiles(projectRef.current.files);

    const files = flush(editor);
    commit({ ...projectRef.current, files });
    return pruneFontFiles(files);
  }, [editor, flush, commit]);

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

  // Covering the canvas for the wait is what keeps the import safe to make:
  // whatever is underneath is about to be replaced, so it must not be possible
  // to start editing it. Shown from the first frame rather than after a delay,
  // because the canvas beneath it is deliberately empty until the site lands.
  const loadingOwnSite = awaitingOwnSite;

  return (
    <EditorShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <EditorToolbar
          editor={editor}
          leading={
            <div className="flex min-w-0 items-center gap-2">
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
          trailing={
            // Disabled for the wait as well: the canvas is empty until the
            // site lands, and publishing it then would replace a real site
            // with a blank page.
            <PublishNsiteDialog
              getFiles={publishableFiles}
              disabled={!editor || awaitingOwnSite}
            />
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
                <GifPicker editor={editor} />
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
          <main className="nsite-studio relative min-h-0 flex-1 bg-muted/40 p-4">
            <div ref={containerRef} className="h-full w-full" />

            {loadingOwnSite && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm">
                <Spinner />
                <p className="text-sm text-muted-foreground">Loading your published site…</p>
              </div>
            )}
          </main>

          <aside
            aria-label="Page and element settings"
            className="w-[19rem] shrink-0 overflow-y-auto border-l bg-sidebar"
          >
            <Inspector
              editor={editor}
              files={project.files}
              // Blossom uploads are signed, so this is the one editor action
              // that needs an account rather than just offering one.
              onUploadImage={user ? addImage : undefined}
              onInstallFont={addFont}
              onFontChanged={tidyFonts}
            />
          </aside>
        </div>

        <OutputPanel title="Code" language="html" content={html} onApply={applyHtml} />
      </div>
    </EditorShell>
  );
}

export default Edit;
