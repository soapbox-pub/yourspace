import { useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Component, type Editor } from 'grapesjs';

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
import { demoLinks, demoNotes, demoProfile, formatSats } from '@/lib/nsiteDemo';

/**
 * GrapesJS renders the page inside an iframe and edits real HTML/CSS, so the
 * app's Tailwind classes do not apply. Blocks are therefore written as
 * self-contained markup with inline styles — which is how you would author them
 * for GrapesJS in production anyway.
 */

const card = 'border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:24px;';

/*
 * ---------------------------------------------------------------------------
 * "Profile hero" as a registered component type.
 *
 * Every other block below is a snippet: GrapesJS parses the HTML string into
 * generic `text` / `image` / `default` components, one per element, each
 * independently selectable and draggable. Nothing marks them as one thing.
 *
 * The hero is registered with `DomComponents.addType` instead, which gets it a
 * recognizer, traits, a name in the layer tree, and a locked subtree so it
 * behaves as a single unit.
 * ---------------------------------------------------------------------------
 */

const HERO_TYPE = 'nostr-profile-hero';

/**
 * The hero's editable state.
 *
 * Traits write to attributes by default, so the attribute *is* the persisted
 * state: it survives `getHtml()`, and `isComponent` picks the element back up
 * as this type when that HTML is parsed again.
 */
const heroFields = [
  { name: 'data-name', label: 'Display name', value: demoProfile.name },
  { name: 'data-nip05', label: 'NIP-05', value: demoProfile.nip05 },
  { name: 'data-tagline', label: 'Tagline', value: demoProfile.tagline },
  { name: 'data-avatar', label: 'Avatar URL', value: demoProfile.avatar },
];

const heroAttributes: Record<string, string> = {
  'data-nostr': 'profile-hero',
  ...Object.fromEntries(heroFields.map((field) => [field.name, field.value])),
};

const heroStyle = {
  border: '1px solid #e2e8f0',
  'border-radius': '12px',
  overflow: 'hidden',
  background: '#fff',
  display: 'block',
};

/**
 * Trait values are attacker-controlled once this is a real editor, and the
 * canvas iframe is same-origin — script injected there runs on this origin and
 * can read the `nsec` in localStorage. Everything interpolated below is escaped,
 * and the avatar is held to an https-only allowlist.
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

function safeImageUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/** Rebuilt from the attributes on every trait change. */
function heroMarkup(attributes: Record<string, string>): string {
  const read = (name: string) => escapeHtml(attributes[name] ?? '');

  return `
    <div style="height:160px;background:linear-gradient(135deg,#8b5cf6,#6366f1 50%,#38bdf8);"></div>
    <div style="padding:0 24px 24px;">
      <img src="${escapeHtml(safeImageUrl(attributes['data-avatar'] ?? ''))}" alt="" style="width:88px;height:88px;border-radius:9999px;border:4px solid #fff;margin-top:-44px;background:#e2e8f0;display:block;"/>
      <h1 style="font-size:36px;font-weight:700;margin:12px 0 4px;letter-spacing:-0.02em;">${read('data-name')}</h1>
      <p style="font-family:ui-monospace,monospace;font-size:14px;color:#64748b;margin:0;">&#10003; ${read('data-nip05')}</p>
      <p style="font-size:18px;color:#475569;margin:12px 0 0;">${read('data-tagline')}</p>
    </div>
  `;
}

/**
 * The root element as it appears in serialized HTML — no children, because the
 * model generates those. Used to seed the starting page.
 */
const heroBlock = `<section ${Object.entries(heroAttributes)
  .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
  .join(' ')}></section>`;

const aboutBlock = `
  <section style="${card}">
    <h2 style="font-size:24px;font-weight:600;margin:0 0 12px;">About me</h2>
    <p style="font-size:18px;line-height:1.7;color:#475569;margin:0;">${demoProfile.about}</p>
  </section>
`;

const linksBlock = `
  <section style="${card}">
    <h2 style="font-size:24px;font-weight:600;margin:0 0 16px;">Elsewhere</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
      ${demoLinks
        .map(
          (link) => `
        <a href="${link.url}" style="display:flex;justify-content:space-between;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-size:16px;font-weight:500;color:#0f172a;text-decoration:none;">
          ${link.label}<span style="color:#94a3b8;">&rarr;</span>
        </a>`,
        )
        .join('')}
    </div>
  </section>
`;

const notesBlock = `
  <section style="${card}">
    <h2 style="font-size:24px;font-weight:600;margin:0 0 16px;">Recent notes</h2>
    ${demoNotes
      .map(
        (note) => `
      <article style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="font-size:16px;line-height:1.6;margin:0;">${note.content}</p>
        <div style="display:flex;gap:20px;font-size:14px;color:#64748b;margin-top:12px;">
          <span>${note.timeAgo}</span>
          <span>&#128172; ${note.replies}</span>
          <span>&#128257; ${note.reposts}</span>
          <span>&#9889; ${formatSats(note.zaps)}</span>
        </div>
      </article>`,
      )
      .join('')}
  </section>
`;

const zapBlock = `
  <section style="border:1px solid #fcd34d;border-radius:12px;background:linear-gradient(135deg,#fffbeb,#ffedd5);padding:24px;">
    <h2 style="font-size:24px;font-weight:600;margin:0 0 8px;">&#9889; Support my work</h2>
    <p style="font-size:18px;color:#475569;margin:0;">
      Send sats to <span style="font-family:ui-monospace,monospace;font-weight:500;color:#0f172a;">${demoProfile.lightningAddress}</span>
    </p>
  </section>
`;

const footerBlock = `
  <footer style="border:1px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;">
    <p style="font-size:14px;color:#64748b;margin:0;">Verify this page against my key</p>
    <p style="font-family:ui-monospace,monospace;font-size:12px;color:#94a3b8;margin:8px 0 0;word-break:break-all;">${demoProfile.npub}</p>
  </footer>
`;

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

const icons = {
  hero: icon('<rect x="3" y="4" width="18" height="7" rx="2"/><circle cx="8" cy="15" r="2.5"/><path d="M13 14h6M13 18h4"/>'),
  about: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 17h8"/>'),
  links: icon('<rect x="3" y="5" width="18" height="5" rx="2"/><rect x="3" y="14" width="18" height="5" rx="2"/>'),
  notes: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h5"/>'),
  zap: icon('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  footer: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18M7 18h10"/>'),
  heading: icon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  text: icon('<path d="M4 6h16M4 10h16M4 14h12M4 18h8"/>'),
  columns: icon('<rect x="3" y="4" width="7.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.5"/>'),
  image: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 18 5-5 4 3 3-2 2 2"/>'),
};

const blocks = [
  {
    id: 'hero',
    label: 'Profile hero',
    category: 'Nostr',
    media: icons.hero,
    // A component reference, not markup — compare with the snippets below.
    content: { type: HERO_TYPE },
  },
  { id: 'about', label: 'About', category: 'Nostr', media: icons.about, content: aboutBlock },
  { id: 'links', label: 'Link list', category: 'Nostr', media: icons.links, content: linksBlock },
  { id: 'notes', label: 'Recent notes', category: 'Nostr', media: icons.notes, content: notesBlock },
  { id: 'zap', label: 'Zap callout', category: 'Nostr', media: icons.zap, content: zapBlock },
  { id: 'footer', label: 'Key footer', category: 'Nostr', media: icons.footer, content: footerBlock },
  {
    id: 'heading',
    label: 'Heading',
    category: 'Basic',
    media: icons.heading,
    content: '<h2 style="font-size:24px;font-weight:600;">Section heading</h2>',
  },
  {
    id: 'text',
    label: 'Text',
    category: 'Basic',
    media: icons.text,
    content: '<p style="font-size:18px;line-height:1.7;color:#475569;">Write something here.</p>',
  },
  {
    id: 'two-columns',
    label: '2 columns',
    category: 'Basic',
    media: icons.columns,
    content:
      '<div style="display:flex;gap:16px;"><div style="flex:1;min-height:80px;border:1px dashed #cbd5e1;border-radius:8px;"></div><div style="flex:1;min-height:80px;border:1px dashed #cbd5e1;border-radius:8px;"></div></div>',
  },
  {
    id: 'image',
    label: 'Image',
    category: 'Basic',
    media: icons.image,
    content: { type: 'image', style: { width: '100%', 'border-radius': '12px' } },
  },
];

const initialPage = `
  <div style="max-width:768px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;">
    ${heroBlock}
    ${aboutBlock}
    ${linksBlock}
    ${notesBlock}
    ${zapBlock}
    ${footerBlock}
  </div>
`;

/**
 * Makes the generated markup inert, so the hero selects, drags, and deletes as
 * one unit with a single badge and a single entry in the layer tree. This is
 * the practical difference between a component and a snippet — without it the
 * user grabs the `<h1>` instead of the hero.
 */
function lockSubtree(parent: Component) {
  parent.components().forEach((child: Component) => {
    child.set({
      selectable: false,
      hoverable: false,
      draggable: false,
      droppable: false,
      removable: false,
      copyable: false,
      layerable: false,
      editable: false,
    });
    lockSubtree(child);
  });
}

/**
 * Registered as a plugin rather than after `init`, because `grapesjs.init`
 * loads plugins *before* parsing `components` — the source says so outright:
 * "A plugin might have extended/added some custom type so this is a good point
 * to load stuff like components". Registering afterwards would leave the
 * starting page's hero parsed as an anonymous `<section>`.
 */
function nostrComponents(editor: Editor) {
  editor.DomComponents.addType(HERO_TYPE, {
    // The recognizer. GrapesJS runs this against every parsed element, which is
    // how a reloaded project — or hand-edited HTML — comes back as this type
    // rather than a generic section.
    isComponent: (el) =>
      el.tagName === 'SECTION' && el.getAttribute('data-nostr') === 'profile-hero',

    model: {
      defaults: {
        name: 'Profile hero',
        tagName: 'section',
        attributes: heroAttributes,
        style: heroStyle,
        // Nothing else belongs inside it.
        droppable: false,
        traits: heroFields.map(({ name, label }) => ({ name, label })),
      },

      init() {
        this.renderHero();
        // Traits write to attributes, and GrapesJS emits a per-key change event
        // for each one.
        for (const field of heroFields) {
          this.on(`change:attributes:${field.name}`, () => this.renderHero());
        }
      },

      renderHero() {
        this.components(heroMarkup(this.getAttributes()));
        lockSubtree(this);
      },
    },
  });
}

const devices = [
  { id: 'desktop', name: 'Desktop', width: '', icon: 'fa fa-desktop' },
  { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px', icon: 'fa fa-tablet' },
  { id: 'mobile', name: 'Mobile', width: '375px', widthMedia: '575px', icon: 'fa fa-mobile' },
];

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
      buttons: devices.map((device, index) => ({
        id: `device-${device.id}`,
        className: device.icon,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState({ html: '', json: '' });

  useEffect(() => {
    if (!containerRef.current) return;

    const editor: Editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      plugins: [nostrComponents],
      components: initialPage,
      // No backend in this demo, so keep everything in memory.
      storageManager: false,
      // Font Awesome is bundled above instead of fetched from a CDN.
      cssIcons: '',
      blockManager: { blocks },
      deviceManager: {
        devices: devices.map(({ icon: _icon, ...device }) => device),
      },
      panels,
    });

    // Set the *id*, not the name. `DeviceManager.get()` accepts either, but the
    // Style Manager's device <select> builds its options with `value={id}` and
    // initializes with `select.value = em.get('device')`. Storing the name
    // leaves no option matching, so the select renders blank.
    for (const device of devices) {
      editor.Commands.add(deviceCommand(device.id), () => editor.setDevice(device.id));
    }

    // That <select> is a second device control, so keep the toolbar in step
    // when the user switches from there. Activating the button re-runs its own
    // command, but `setDevice` to the current device is a no-op, so this
    // settles rather than looping. Deactivating siblings is handled by the
    // shared `context`.
    editor.on('change:device', () => {
      const active = editor.getDevice();
      const device = devices.find((d) => d.id === active || d.name === active);
      if (!device) return;
      editor.Panels.getButton('commands', `device-${device.id}`)?.set('active', true);
    });

    // The app's CSP forbids `data:` stylesheets, so style the canvas with an
    // inline <style> element instead of `canvas.styles`.
    const styleCanvas = () => {
      const doc = editor.Canvas.getDocument();
      if (!doc || doc.getElementById('nsite-canvas-reset')) return;

      const style = doc.createElement('style');
      style.id = 'nsite-canvas-reset';
      // The @font-face has to be redeclared here — the parent document's font
      // registry is not shared with the frame. Same-origin, so `font-src
      // 'self'` is satisfied.
      style.textContent = `
        @font-face{font-family:'Inter Variable';font-style:normal;font-display:swap;font-weight:100 900;src:url(${interLatin}) format('woff2-variations');}
        body{margin:0;background:#f8fafc;font-family:'Inter Variable',system-ui,-apple-system,sans-serif;}
      `;
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
  }, []);

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
