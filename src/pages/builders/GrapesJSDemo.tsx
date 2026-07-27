import { useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Editor } from 'grapesjs';
import { useNostr } from '@nostrify/react';

// Inter, for the canvas iframe. Font faces don't cross a document boundary, so
// the app's @fontsource import doesn't reach the page being edited.
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';

// GrapesJS's panel buttons are Font Awesome 4.7 glyphs. It normally injects
// them from a CDN, which the app's CSP blocks — so bundle them instead and
// disable the CDN request via `cssIcons` below.
//
// Order matters: GrapesJS *prepends* the CDN stylesheet (`appendStyles(...,
// { prepand: true })`) so that grapes.min.css can override it. Font Awesome's
// `.fa { font: 14px/1 FontAwesome; font-size: inherit }` has the same
// specificity as `.gjs-pn-btn { font-size: 18px; line-height: 21px }`, so
// importing it second shrinks every toolbar glyph to the inherited 12px and
// knocks it off-center inside its 30px button.
import 'font-awesome/css/font-awesome.min.css';
import 'grapesjs/dist/css/grapes.min.css';
import '@/components/builders/grapesjs-overrides.css';

import { BuilderShell } from '@/components/builders/BuilderShell';
import { OutputPanel } from '@/components/builders/OutputPanel';
import {
  canvasResetCss,
  initialPage,
  nostrComponents,
  nsiteBlockDefs,
  nsiteDevices,
} from '@/lib/builders/nsiteBlocks';

/**
 * GrapesJS with its stock chrome, as shipped. The same blocks and components
 * are driven by a hand-built React UI in `GrapesJSStudioDemo` — the two pages
 * share `@/lib/builders/nsiteBlocks`, so what differs between them is only the
 * editor shell.
 */

/**
 * Wraps SVG path data in the icon markup GrapesJS renders per block.
 *
 * Sized to match `.gjs-block-svg { width: 54px }`, the convention GrapesJS's own
 * block presets follow — the stroke lives in viewBox units, so scaling the
 * viewport preserves the weight.
 *
 * `fill` must be set inline: grapes.min.css declares `.gjs-block svg{fill:
 * currentColor}`, and a stylesheet rule beats a `fill="none"` attribute, which
 * would otherwise render every outline icon as a solid block.
 */
function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="54" height="54" style="fill:none;stroke:currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/** Keyed by block id, so the shared block list stays chrome-agnostic. */
const blockIcons: Record<string, string> = {
  hero: icon('<rect x="3" y="4" width="18" height="7" rx="2"/><circle cx="8" cy="15" r="2.5"/><path d="M13 14h6M13 18h4"/>'),
  about: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 17h8"/>'),
  links: icon('<rect x="3" y="5" width="18" height="5" rx="2"/><rect x="3" y="14" width="18" height="5" rx="2"/>'),
  notes: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h5"/>'),
  zap: icon('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  footer: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18M7 18h10"/>'),
  heading: icon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  text: icon('<path d="M4 6h16M4 10h16M4 14h12M4 18h8"/>'),
  'two-columns': icon('<rect x="3" y="4" width="7.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.5"/>'),
  image: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 18 5-5 4 3 3-2 2 2"/>'),
};

const blocks = nsiteBlockDefs.map(({ id, label, category, content }) => ({
  id,
  label,
  category,
  media: blockIcons[id],
  content,
}));

/** The stock panels need a Font Awesome class per device. */
const deviceIcons: Record<string, string> = {
  desktop: 'fa fa-desktop',
  tablet: 'fa fa-tablet',
  mobile: 'fa fa-mobile',
};

const deviceCommand = (id: string) => `set-device-${id}`;

/**
 * GrapesJS's stock top bar is `{ id: 'commands', buttons: [{}] }` — one button
 * with no icon, label, or command, which renders as a blank box in the corner
 * of an otherwise empty 85%-wide bar. Core also ships no device switcher (that
 * lives in `grapesjs-preset-webpage`), so the breakpoints above would be
 * unreachable. Put the switcher there.
 *
 * `panels.defaults` replaces the default list rather than merging into it, so
 * the stock `options` and `views` panels have to be restated verbatim.
 */
const panels = {
  defaults: [
    {
      id: 'commands',
      buttons: nsiteDevices.map((device, index) => ({
        id: `device-${device.id}`,
        className: deviceIcons[device.id],
        // Buttons sharing a `context` deactivate one another, which is how
        // GrapesJS spells "radio group".
        context: 'device',
        active: index === 0,
        togglable: false,
        // Registered against the editor instance below. Commands resolve by id
        // at click time, so declaring them after `init` is fine.
        command: deviceCommand(device.id),
        attributes: { title: device.name },
      })),
    },
    {
      id: 'options',
      buttons: [
        {
          id: 'sw-visibility',
          className: 'fa fa-square-o',
          command: 'core:component-outline',
          context: 'sw-visibility',
          active: true,
          attributes: { title: 'View components' },
        },
        {
          id: 'preview',
          className: 'fa fa-eye',
          command: 'preview',
          context: 'preview',
          attributes: { title: 'Preview' },
        },
        {
          id: 'fullscreen',
          className: 'fa fa-arrows-alt',
          command: 'fullscreen',
          context: 'fullscreen',
          attributes: { title: 'Fullscreen' },
        },
        {
          id: 'export-template',
          className: 'fa fa-code',
          command: 'export-template',
          attributes: { title: 'View code' },
        },
      ],
    },
    {
      id: 'views',
      buttons: [
        {
          id: 'open-sm',
          className: 'fa fa-paint-brush',
          command: 'open-sm',
          active: true,
          togglable: false,
          attributes: { title: 'Style Manager' },
        },
        {
          id: 'open-tm',
          className: 'fa fa-cog',
          command: 'open-tm',
          togglable: false,
          attributes: { title: 'Settings' },
        },
        {
          id: 'open-layers',
          className: 'fa fa-bars',
          command: 'open-layers',
          togglable: false,
          attributes: { title: 'Layer Manager' },
        },
        {
          id: 'open-blocks',
          className: 'fa fa-th-large',
          command: 'open-blocks',
          togglable: false,
          attributes: { title: 'Blocks' },
        },
      ],
    },
  ],
};

export function GrapesJSDemo() {
  useSeoMeta({
    title: 'GrapesJS — nsite builder demo',
    description: 'Evaluating GrapesJS as a WYSIWYG editor for building Nostr homepages.',
  });

  const { nostr } = useNostr();
  const containerRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState({ html: '', json: '' });

  useEffect(() => {
    if (!containerRef.current) return;

    const editor: Editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      plugins: [nostrComponents(nostr)],
      components: initialPage,
      // No backend in this demo, so keep everything in memory.
      storageManager: false,
      // Font Awesome is bundled above instead of fetched from a CDN.
      cssIcons: '',
      blockManager: { blocks },
      deviceManager: { devices: nsiteDevices },
      panels,
    });

    // Set the *id*, not the name. `DeviceManager.get()` accepts either, but the
    // Style Manager's device <select> builds its options with `value={id}` and
    // initializes with `select.value = em.get('device')`. Storing the name
    // leaves no option matching, so the select renders blank.
    for (const device of nsiteDevices) {
      editor.Commands.add(deviceCommand(device.id), () => editor.setDevice(device.id));
    }

    // That <select> is a second device control, so keep the toolbar in step
    // when the user switches from there. Activating the button re-runs its own
    // command, but `setDevice` to the current device is a no-op, so this
    // settles rather than looping. Deactivating siblings is handled by the
    // shared `context`.
    editor.on('change:device', () => {
      const active = editor.getDevice();
      const device = nsiteDevices.find((d) => d.id === active || d.name === active);
      if (!device) return;
      editor.Panels.getButton('commands', `device-${device.id}`)?.set('active', true);
    });

    const styleCanvas = () => {
      const doc = editor.Canvas.getDocument();
      if (!doc || doc.getElementById('nsite-canvas-reset')) return;

      const style = doc.createElement('style');
      style.id = 'nsite-canvas-reset';
      style.textContent = canvasResetCss(interLatin);
      doc.head.appendChild(style);
    };

    const syncOutput = () => {
      const css = editor.getCss() ?? '';
      setOutput({
        html: `<!-- index.html -->\n${editor.getHtml()}\n\n<!-- style.css -->\n<style>\n${css}\n</style>`,
        json: JSON.stringify(editor.getProjectData(), null, 2),
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

    editor.on('update', queueSync);
    editor.on('load', () => {
      styleCanvas();
      syncOutput();
      // Show the block palette up front rather than behind a toolbar button,
      // so the available blocks are visible on arrival.
      editor.runCommand('open-blocks');
    });
    // Re-apply after device switches, which rebuild the canvas frame.
    editor.on('canvas:frame:load', styleCanvas);
    syncOutput();

    return () => {
      window.clearTimeout(pending);
      editor.destroy();
    };
    // `nostr` is the app's memoized pool, so this effect runs once.
  }, [nostr]);

  return (
    <BuilderShell slug="grapesjs" docsUrl="https://grapesjs.com/docs/">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* GrapesJS injects its own full-height UI, so give it a definite frame. */}
        <div className="min-h-0 flex-1">
          <div ref={containerRef} className="h-full" />
        </div>

        <OutputPanel
          title="GrapesJS output"
          tabs={[
            {
              id: 'json',
              label: 'JSON',
              language: 'json',
              description:
                'The project data GrapesJS loads back into the editor: the component tree, style rules, assets, and pages. Store this alongside the published site to keep it editable.',
              content: output.json,
            },
            {
              id: 'html',
              label: 'HTML',
              language: 'html',
              description:
                'GrapesJS exports plain HTML and CSS — the closest match to what an nsite actually needs on Blossom. No renderer or hydration step required.',
              content: output.html,
            },
          ]}
        />
      </div>
    </BuilderShell>
  );
}

export default GrapesJSDemo;
