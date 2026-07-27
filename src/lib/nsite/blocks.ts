import type { Component, Editor } from 'grapesjs';
import type { NostrMetadata, NPool } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

import { demoLinks, demoNotes, demoProfile, formatSats } from '@/lib/nsite/demoContent';

/**
 * The nsite content the builder starts from: its blocks, its "Profile hero"
 * component type and its starting page.
 *
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

export const HERO_TYPE = 'nostr-profile-hero';

/**
 * The hero's entire editable state: one npub. Everything rendered is fetched.
 *
 * Traits write to attributes by default, so the attribute *is* the persisted
 * state: it survives `getHtml()`, and `isComponent` picks the element back up
 * as this type when that HTML is parsed again.
 */
export const NPUB_ATTR = 'data-npub';

/** Verified against relay.ditto.pub while writing this. */
export const DEMO_NPUB = 'npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p';

export const PROFILE_RELAY = 'wss://relay.ditto.pub';

const heroAttributes: Record<string, string> = {
  'data-nostr': 'profile-hero',
  [NPUB_ATTR]: DEMO_NPUB,
};

const heroStyle = {
  border: '1px solid #e2e8f0',
  'border-radius': '12px',
  overflow: 'hidden',
  background: '#fff',
  display: 'block',
};

/**
 * Everything below is relay data — signatures prove authorship, not
 * trustworthiness — interpolated into markup that runs in a same-origin iframe,
 * where injected script could read the `nsec` out of localStorage. Every value
 * is escaped, and image URLs are held to an https-only allowlist.
 */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

function safeImageUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * One in-flight request per npub, shared across every hero on the page.
 * Rejections are evicted so that editing the trait retries rather than
 * latching a transient relay failure forever.
 */
const profileCache = new Map<string, Promise<NostrMetadata | null>>();

function fetchProfile(nostr: NPool, npub: string): Promise<NostrMetadata | null> {
  const cached = profileCache.get(npub);
  if (cached) return cached;

  const pending = (async () => {
    const decoded = nip19.decode(npub);
    if (decoded.type !== 'npub') throw new Error('Not an npub');

    // Filters take hex, never bech32. Constrained to `authors` so no other
    // pubkey's kind 0 can answer for this npub.
    const [event] = await nostr
      .relay(PROFILE_RELAY)
      .query([{ kinds: [0], authors: [decoded.data], limit: 1 }], {
        signal: AbortSignal.timeout(8000),
      });

    return event ? (JSON.parse(event.content) as NostrMetadata) : null;
  })();

  profileCache.set(npub, pending);
  pending.catch(() => profileCache.delete(npub));

  return pending;
}

const shell = (body: string) => `<div style="padding:24px;">${body}</div>`;

const placeholder = (text: string) =>
  shell(
    `<p style="font-size:16px;color:#64748b;margin:0;text-align:center;line-height:1.6;">${escapeHtml(text)}</p>`,
  );

/** Rendered from the kind 0 once it arrives. */
function heroMarkup(npub: string, metadata: NostrMetadata): string {
  const name = metadata.display_name || metadata.name || 'Anonymous';
  const banner = safeImageUrl(metadata.banner);
  const picture = safeImageUrl(metadata.picture);

  // The banner goes in an <img>, not a CSS `url()`, so a hostile value has no
  // CSS context to break out of.
  const bannerMarkup = banner
    ? `<img src="${escapeHtml(banner)}" alt="" style="width:100%;height:160px;object-fit:cover;display:block;"/>`
    : `<div style="height:160px;background:linear-gradient(135deg,#8b5cf6,#6366f1 50%,#38bdf8);"></div>`;

  const nip05Markup = metadata.nip05
    ? `<p style="font-family:ui-monospace,monospace;font-size:14px;color:#64748b;margin:0;">&#10003; ${escapeHtml(metadata.nip05)}</p>`
    : `<p style="font-family:ui-monospace,monospace;font-size:12px;color:#94a3b8;margin:0;word-break:break-all;">${escapeHtml(npub)}</p>`;

  const aboutMarkup = metadata.about
    ? `<p style="font-size:18px;color:#475569;margin:12px 0 0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(metadata.about)}</p>`
    : '';

  return `
    ${bannerMarkup}
    <div style="padding:0 24px 24px;">
      <img src="${escapeHtml(picture)}" alt="" style="width:88px;height:88px;border-radius:9999px;border:4px solid #fff;margin-top:-44px;background:#e2e8f0;display:block;object-fit:cover;"/>
      <h1 style="font-size:36px;font-weight:700;margin:12px 0 4px;letter-spacing:-0.02em;">${escapeHtml(name)}</h1>
      ${nip05Markup}
      ${aboutMarkup}
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

/** Block content as GrapesJS accepts it: markup, or a component reference. */
export type BlockContent = string | { type: string; style?: Record<string, string> };

export interface NsiteBlockDef {
  id: string;
  label: string;
  category: 'Nostr' | 'Basic';
  /** One line of "what does dropping this give me", shown in the studio palette. */
  description: string;
  content: BlockContent;
}

export const nsiteBlockDefs: NsiteBlockDef[] = [
  {
    id: 'hero',
    label: 'Profile hero',
    category: 'Nostr',
    description: 'Banner, avatar and bio, live from a kind 0',
    // A component reference, not markup — compare with the snippets below.
    content: { type: HERO_TYPE },
  },
  {
    id: 'about',
    label: 'About',
    category: 'Nostr',
    description: 'A titled paragraph of long-form text',
    content: aboutBlock,
  },
  {
    id: 'links',
    label: 'Link list',
    category: 'Nostr',
    description: 'Two-column grid of outbound links',
    content: linksBlock,
  },
  {
    id: 'notes',
    label: 'Recent notes',
    category: 'Nostr',
    description: 'Note cards with reply, repost and zap counts',
    content: notesBlock,
  },
  {
    id: 'zap',
    label: 'Zap callout',
    category: 'Nostr',
    description: 'Lightning address in a highlighted panel',
    content: zapBlock,
  },
  {
    id: 'footer',
    label: 'Key footer',
    category: 'Nostr',
    description: 'npub printed for verification',
    content: footerBlock,
  },
  {
    id: 'heading',
    label: 'Heading',
    category: 'Basic',
    description: 'A single section heading',
    content: '<h2 style="font-size:24px;font-weight:600;">Section heading</h2>',
  },
  {
    id: 'text',
    label: 'Text',
    category: 'Basic',
    description: 'An editable paragraph',
    content: '<p style="font-size:18px;line-height:1.7;color:#475569;">Write something here.</p>',
  },
  {
    id: 'two-columns',
    label: '2 columns',
    category: 'Basic',
    description: 'Two flex drop zones side by side',
    content:
      '<div style="display:flex;gap:16px;"><div style="flex:1;min-height:80px;border:1px dashed #cbd5e1;border-radius:8px;"></div><div style="flex:1;min-height:80px;border:1px dashed #cbd5e1;border-radius:8px;"></div></div>',
  },
  {
    id: 'image',
    label: 'Image',
    category: 'Basic',
    description: 'Placeholder image, swap via the asset picker',
    content: { type: 'image', style: { width: '100%', 'border-radius': '12px' } },
  },
];

export const initialPage = `
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
      // Without this the "View components" toggle still draws a dashed outline
      // around every child — `highlightable` defaults to true and is what puts
      // `data-gjs-highlightable` on the element. The outlines advertise
      // interactivity that the flags above have already removed.
      highlightable: false,
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
export function nostrComponents(nostr: NPool) {
  return (editor: Editor) => {
    editor.DomComponents.addType(HERO_TYPE, {
      // The recognizer. GrapesJS runs this against every parsed element, which
      // is how a reloaded project — or hand-edited HTML — comes back as this
      // type rather than a generic section.
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
          traits: [{ name: NPUB_ATTR, label: 'npub', placeholder: 'npub1…' }],
        },

        init() {
          this.renderHero();
          // Traits write to attributes, and GrapesJS emits a per-key change
          // event for each one.
          this.on(`change:attributes:${NPUB_ATTR}`, () => this.renderHero());
        },

        async renderHero() {
          const npub = String(this.getAttributes()[NPUB_ATTR] ?? '').trim();

          if (!npub) {
            this.setHeroContent(placeholder('Add an npub to load a profile.'));
            return;
          }

          this.setHeroContent(placeholder(`Loading ${npub.slice(0, 12)}… from ${PROFILE_RELAY}`));

          let metadata: NostrMetadata | null = null;
          let failed = false;
          try {
            metadata = await fetchProfile(nostr, npub);
          } catch {
            failed = true;
          }

          // The trait may have changed while the relay was answering. Compare
          // against what the component holds *now*, not what we captured.
          if (String(this.getAttributes()[NPUB_ATTR] ?? '').trim() !== npub) return;

          if (metadata) {
            this.setHeroContent(heroMarkup(npub, metadata));
          } else {
            this.setHeroContent(
              placeholder(
                failed
                  ? `Couldn't reach ${PROFILE_RELAY}, or that isn't a valid npub.`
                  : `No profile found for this npub on ${PROFILE_RELAY}.`,
              ),
            );
          }
        },

        setHeroContent(markup: string) {
          this.components(markup);
          lockSubtree(this);
        },
      },
    });
  };
}

export const nsiteDevices = [
  { id: 'desktop', name: 'Desktop', width: '' },
  { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
  { id: 'mobile', name: 'Mobile', width: '375px', widthMedia: '575px' },
];

/**
 * The one rule the canvas document needs, whatever it is showing.
 *
 * GrapesJS gives the wrapper `min-height: 100vh` — it only skips that for an
 * auto-height frame, which neither demo uses — so the body already fills the
 * viewport exactly. The UA's default 8px margins on top of that push the
 * document past it, leaving a scrollbar with nothing to scroll.
 *
 * That makes this compensation for an editor artifact rather than page styling,
 * which is why it applies to an imported site as much as to the starting page.
 * Everything else a page needs it either brings itself or gets from behind the
 * frame: the backdrop is on `.gjs-frame`, and the starting template carries its
 * own font on the root div.
 *
 * The app's CSP forbids `data:` stylesheets, so this is injected as an inline
 * `<style>` into the canvas document rather than passed to `canvas.styles`.
 */
export const canvasResetCss = `body{margin:0;}`;
