import { useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Editor } from 'grapesjs';

import 'grapesjs/dist/css/grapes.min.css';
// GrapesJS's panel buttons are Font Awesome 4.7 glyphs. It normally injects
// them from a CDN, which the app's CSP blocks — so bundle them instead and
// disable the CDN request via `cssIcons` below.
import 'font-awesome/css/font-awesome.min.css';

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

const heroBlock = `
  <section style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;">
    <div style="height:160px;background:linear-gradient(135deg,#8b5cf6,#6366f1 50%,#38bdf8);"></div>
    <div style="padding:0 24px 24px;">
      <img src="${demoProfile.avatar}" alt="" style="width:88px;height:88px;border-radius:9999px;border:4px solid #fff;margin-top:-44px;background:#e2e8f0;display:block;"/>
      <h1 style="font-size:36px;font-weight:700;margin:12px 0 4px;letter-spacing:-0.02em;">${demoProfile.name}</h1>
      <p style="font-family:ui-monospace,monospace;font-size:14px;color:#64748b;margin:0;">&#10003; ${demoProfile.nip05}</p>
      <p style="font-size:18px;color:#475569;margin:12px 0 0;">${demoProfile.tagline}</p>
    </div>
  </section>
`;

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
 * `fill` must be set inline: grapes.min.css declares `.gjs-block svg{fill:
 * currentColor}`, and a stylesheet rule beats a `fill="none"` attribute, which
 * would otherwise render every outline icon as a solid block.
 */
function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="28" height="28" style="fill:none;stroke:currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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
  { id: 'hero', label: 'Profile hero', category: 'Nostr', media: icons.hero, content: heroBlock },
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
      components: initialPage,
      // No backend in this demo, so keep everything in memory.
      storageManager: false,
      // Font Awesome is bundled above instead of fetched from a CDN.
      cssIcons: '',
      blockManager: { blocks },
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Desktop', width: '' },
          { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
          { id: 'mobile', name: 'Mobile', width: '375px', widthMedia: '575px' },
        ],
      },
    });

    // The app's CSP forbids `data:` stylesheets, so style the canvas with an
    // inline <style> element instead of `canvas.styles`.
    const styleCanvas = () => {
      const doc = editor.Canvas.getDocument();
      if (!doc || doc.getElementById('nsite-canvas-reset')) return;

      const style = doc.createElement('style');
      style.id = 'nsite-canvas-reset';
      style.textContent =
        "body{margin:0;background:#f8fafc;font-family:'Inter Variable',system-ui,-apple-system,sans-serif;}";
      doc.head.appendChild(style);
    };

    const syncOutput = () => {
      const css = editor.getCss() ?? '';
      setOutput({
        html: `<!-- index.html -->\n${editor.getHtml()}\n\n<!-- style.css -->\n<style>\n${css}\n</style>`,
        json: JSON.stringify(editor.getProjectData(), null, 2),
      });
    };

    editor.on('update', syncOutput);
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

    return () => editor.destroy();
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
