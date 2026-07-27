import { useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import grapesjs, { type Editor } from 'grapesjs';

import 'grapesjs/dist/css/grapes.min.css';

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

const blocks = [
  { id: 'hero', label: 'Profile hero', category: 'Nostr', content: heroBlock },
  { id: 'about', label: 'About', category: 'Nostr', content: aboutBlock },
  { id: 'links', label: 'Link list', category: 'Nostr', content: linksBlock },
  { id: 'notes', label: 'Recent notes', category: 'Nostr', content: notesBlock },
  { id: 'zap', label: 'Zap callout', category: 'Nostr', content: zapBlock },
  { id: 'footer', label: 'Key footer', category: 'Nostr', content: footerBlock },
  {
    id: 'heading',
    label: 'Heading',
    category: 'Basic',
    content: '<h2 style="font-size:24px;font-weight:600;">Section heading</h2>',
  },
  {
    id: 'text',
    label: 'Text',
    category: 'Basic',
    content: '<p style="font-size:18px;line-height:1.7;color:#475569;">Write something here.</p>',
  },
  {
    id: 'two-columns',
    label: '2 columns',
    category: 'Basic',
    content:
      '<div style="display:flex;gap:16px;"><div style="flex:1;min-height:80px;border:1px dashed #cbd5e1;border-radius:8px;"></div><div style="flex:1;min-height:80px;border:1px dashed #cbd5e1;border-radius:8px;"></div></div>',
  },
  {
    id: 'image',
    label: 'Image',
    category: 'Basic',
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
  const [output, setOutput] = useState('');

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
      // GrapesJS injects Font Awesome from a CDN by default; the app's CSP
      // blocks it and none of these blocks use FA icons.
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
      setOutput(`<!-- index.html -->\n${editor.getHtml()}\n\n<!-- style.css -->\n<style>\n${css}\n</style>`);
    };

    editor.on('update', syncOutput);
    editor.on('load', () => {
      styleCanvas();
      syncOutput();
    });
    // Re-apply after device switches, which rebuild the canvas frame.
    editor.on('canvas:frame:load', styleCanvas);
    syncOutput();

    return () => editor.destroy();
  }, []);

  return (
    <BuilderShell slug="grapesjs" docsUrl="https://grapesjs.com/docs/">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* GrapesJS injects its own full-height UI, so give it a fixed frame. */}
        <div className="h-[calc(100vh-61px)] min-h-[720px]">
          <div ref={containerRef} className="h-full" />
        </div>

        <OutputPanel
          title="GrapesJS output"
          description="GrapesJS exports plain HTML and CSS — the closest match to what an nsite actually needs on Blossom. No renderer or hydration step required."
          language="html"
          content={output}
        />
      </div>
    </BuilderShell>
  );
}

export default GrapesJSDemo;
