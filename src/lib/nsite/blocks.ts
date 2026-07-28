import type { Component, Editor, ResizerOptions } from 'grapesjs';
import type { NostrMetadata, NPool } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

import { demoLinks, demoNotes, demoProfile, formatSats } from '@/lib/nsite/demoContent';
import { isForeign } from '@/lib/nsite/foreign';

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

/* --------------------------------------------------------------------------
 * Layout
 *
 * Structural blocks: containers with nothing in them, whose only job is to give
 * the page a shape other than one column of stacked sections.
 * ------------------------------------------------------------------------ */

/**
 * "Take an equal share of the row", spelled out.
 *
 * `flex: 1` says exactly this in one declaration, but it is a shorthand, and
 * resizing a column writes the `flex-basis` longhand — which a `flex: 1` left
 * sitting in the same rule would override. The inspector collapses `padding`
 * and `background` on edit for the same reason.
 */
const flexFill = 'flex-grow:1;flex-shrink:1;flex-basis:0%;';

/**
 * An empty drop target.
 *
 * Given a minimum height because a div with no children is zero tall and
 * therefore impossible to drag anything onto. Nothing marks it out visually:
 * the "Show element outlines" toggle already draws a dashed box around every
 * component while editing, and a border set here would survive into the
 * published page, where an empty slot should look like empty space.
 */
const dropZone = (style = flexFill) => `<div style="${style}min-height:80px;"></div>`;

const columnsBlock = (count: number) =>
  `<div style="display:flex;gap:16px;">${Array.from({ length: count }, () => dropZone()).join('')}</div>`;

/** Deliberately uneven, which is the whole reason to reach for it over "2 columns". */
const sidebarBlock = `
  <div style="display:flex;gap:16px;">
    ${dropZone('flex-grow:0;flex-shrink:0;flex-basis:30%;')}
    ${dropZone()}
  </div>
`;

const gridBlock = `
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
    ${dropZone('').repeat(6)}
  </div>
`;

/**
 * A positioning context.
 *
 * `position:relative` is what makes the children of this block placeable:
 * `core:component-drag` walks up from the element being dragged looking for an
 * ancestor styled `relative` or `absolute`, and measures its offsets from the
 * first one it finds. Without such an ancestor the coordinates are resolved
 * against the page instead, which is fine but means the group can't be moved
 * as a unit afterwards.
 */
const freeAreaBlock = `
  <div style="position:relative;min-height:320px;"></div>
`;

const spacerBlock = `<div style="height:64px;"></div>`;

/** Block content as GrapesJS accepts it: markup, or a component reference. */
export type BlockContent = string | { type: string; style?: Record<string, string> };

export interface NsiteBlockDef {
  id: string;
  label: string;
  category: 'Nostr' | 'Basic' | 'Layout';
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
    id: 'image',
    label: 'Image',
    category: 'Basic',
    description: 'Placeholder image, swap via the asset picker',
    content: { type: 'image', style: { width: '100%', 'border-radius': '12px' } },
  },
  {
    id: 'two-columns',
    label: '2 columns',
    category: 'Layout',
    description: 'Two equal drop zones side by side',
    content: columnsBlock(2),
  },
  {
    id: 'three-columns',
    label: '3 columns',
    category: 'Layout',
    description: 'Three equal drop zones side by side',
    content: columnsBlock(3),
  },
  {
    id: 'sidebar',
    label: 'Sidebar + main',
    category: 'Layout',
    description: 'A narrow rail beside a wide column',
    content: sidebarBlock,
  },
  {
    id: 'grid',
    label: 'Grid',
    category: 'Layout',
    description: 'Six cells in a 3-across grid, resizable',
    content: gridBlock,
  },
  {
    id: 'free-area',
    label: 'Free area',
    category: 'Layout',
    description: 'A positioned region — place anything anywhere inside it',
    content: freeAreaBlock,
  },
  {
    id: 'spacer',
    label: 'Spacer',
    category: 'Layout',
    description: 'Empty vertical room between blocks',
    content: spacerBlock,
  },
];

/*
 * An empty page, and a whole document rather than a fragment.
 *
 * Empty because everything here is the user's to write: a page that opens
 * holding someone else's sections is a page whose first editing session is
 * spent deleting them, and the palette is right there.
 *
 * A document because that is what a site ships, and because the doctype is what
 * `serializePage` reads to decide whether to serialize one — starting without
 * it means the `<head>` only appears once something else puts it there. What is
 * in the head is the minimum a published page needs and nothing that would
 * render: a charset so the bytes are read as UTF-8, and a viewport so phones
 * lay the page out at their own width instead of zooming out from 980px.
 */
export const initialPage = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body></body>
</html>
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
 * to load stuff like components". Registering afterwards would leave a hero in
 * whatever the editor opened on parsed as an anonymous `<section>`.
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

/**
 * Resize handles on everything.
 *
 * `resizable` defaults to false for every type but `image`, so without this the
 * only way to size an element is to type a value into the inspector. GrapesJS
 * already adapts the handles to how the element is being laid out: its resizer
 * writes `top`/`left` alongside the new size *only* when the component is in a
 * drag mode, so in normal flow the handles change width and height and nothing
 * else, and in free layout they reposition as you'd expect from a design tool.
 *
 * Registered as a plugin, and listening rather than setting defaults, because
 * types like `text` and `image` bring their own model class — extending the
 * `default` type would not reach them. `component:create` fires for every
 * component whatever its type, and plugins run before anything is parsed, so
 * the page the editor opens on is covered too.
 *
 * Set silently: this is a property of the editor's chrome, not an edit to the
 * page, and it should not land in the undo stack or mark the project dirty.
 */
export function resizableComponents(editor: Editor) {
  editor.on('component:create', (component: Component) => {
    // A bare text node has no element of its own to put handles on.
    if (component.get('type') === 'textnode') return;
    // A placeholder serializes to the markup it stands for, so a size written
    // onto it would be discarded on save — handles that do nothing.
    if (isForeign(component)) return;
    if (component.get('resizable')) return;

    component.set('resizable', true, { silent: true });
  });

  /*
   * `component:resize:init` hands out a payload whose `resizable` the listener
   * is meant to rewrite, which is the only place these options can be decided:
   * whether a handle should write `width` or `flex-basis` depends on the
   * parent, and a component has no parent yet when it is created.
   */
  editor.on('component:resize:init', (event: ResizeInitEvent) => {
    const { component } = event;
    if (!component || !event.resizable) return;

    const axis = flexAxis(component.parent()?.getEl());
    if (axis) event.resizable = flexItemResize(component, axis);
  });
}

/** The mutable half of the `component:resize:init` payload. */
interface ResizeInitEvent {
  component?: Component;
  resizable?: boolean | ResizerOptions;
}

/**
 * The axis a container lays its children out along, or null if it is not a flex
 * container.
 *
 * Read from the canvas rather than from the component's own style bag, so that
 * a rule arriving in an imported site's stylesheet counts for as much as one
 * set here — the style bag only holds what this editor wrote or parsed inline.
 */
function flexAxis(el: HTMLElement | undefined): 'row' | 'column' | null {
  const view = el?.ownerDocument.defaultView;
  if (!el || !view) return null;

  const { display, flexDirection } = view.getComputedStyle(el);
  if (display !== 'flex' && display !== 'inline-flex') return null;

  return flexDirection.startsWith('column') ? 'column' : 'row';
}

/**
 * Resize options for a child of a flex container.
 *
 * The resizer writes `width`, but a flex item's size along the main axis comes
 * from `flex-basis` — and `flex: 1` is shorthand for a basis of `0%`, which
 * beats any width. Dragging the side handle of an equal column therefore moved
 * nothing at all.
 *
 * Pointing the resizer at `flex-basis` fixes that, in percent so that a column
 * sized against the desktop frame still means the same thing in a narrower one.
 * `currentUnit` has to be switched off alongside it, or the unit is replaced on
 * mousedown by whichever one the element's current basis happens to carry.
 *
 * Growing is dropped at the same time. A column still on `flex-grow: 1` takes
 * its share of the leftover space *on top of* the basis just written, so it
 * settles wider than where it was dropped; without it the column is exactly its
 * basis, and its siblings — which are still growing — absorb the difference.
 * That is what makes the rest of the row give way as one column is dragged.
 */
function flexItemResize(component: Component, axis: 'row' | 'column'): ResizerOptions {
  const alongMainAxis =
    axis === 'row'
      ? { keyWidth: 'flex-basis', unitWidth: '%' }
      : { keyHeight: 'flex-basis', unitHeight: '%' };

  return {
    ...alongMainAxis,
    currentUnit: false,
    onStart: () => freezeFlexSize(component, axis),
  };
}

/**
 * Pins a flex item to the size it is currently rendered at, as the drag begins.
 *
 * Dropping `flex-grow` is what makes the column settle where it was dropped
 * rather than growing past it — but an equal column's basis is `0%`, and
 * clearing the grow on its own would collapse it to nothing the instant the
 * handle was grabbed, before the pointer had moved. Measuring first and writing
 * that back as the basis means the column is the same size either side of the
 * change, and the drag continues from where it looks like it should.
 *
 * Measured from `offsetWidth` against the parent's, which is how GrapesJS's own
 * resizer converts a pixel drag into a percentage — the point is to agree with
 * the values the drag is about to write, not to be independently exact.
 */
function freezeFlexSize(component: Component, axis: 'row' | 'column') {
  const el = component.getEl();
  const parentEl = el?.parentElement;
  if (!el || !parentEl) return;

  const [size, parentSize] =
    axis === 'row'
      ? [el.offsetWidth, parentEl.offsetWidth]
      : [el.offsetHeight, parentEl.offsetHeight];

  component.addStyle({
    // The shorthand goes too: it carries a grow factor and a basis of its own,
    // and a `flex: 1` left in the rule would put back what the longhands clear.
    flex: '',
    'flex-grow': '0',
    'flex-basis': `${Math.round((size / (parentSize || 1)) * 1000) / 10}%`,
  });
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
 * Everything else a page needs it brings itself, or gets from behind the frame:
 * the backdrop is on `.gjs-frame`.
 *
 * The app's CSP forbids `data:` stylesheets, so this is injected as an inline
 * `<style>` into the canvas document rather than passed to `canvas.styles`.
 */
export const canvasResetCss = `body{margin:0;}`;
