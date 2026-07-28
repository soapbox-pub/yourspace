import type { Component, Editor } from 'grapesjs';

import { NAPPLET_ATTR } from './constants';
import { mountNapplet, pageTheme, type MountedNapplet } from './runtime/mount';
import type { NappletStatus } from './runtime/types';

/**
 * The napplet as an editable component.
 *
 * Registered as a type rather than dropped in as a snippet, for the same reason
 * the profile hero is: it has to select, drag and delete as one thing, carry a
 * trait for the one value it holds, and — unlike anything else in the palette —
 * put a running program on the canvas without that program becoming part of the
 * page.
 *
 * That last part is the whole design. The model stays empty, so `getHtml()`
 * serializes an inert `<div data-napplet="naddr1…"></div>` and nothing else.
 * The frame is created by the *view*, straight into the DOM, where the
 * serializer never looks. What ships is the placeholder; what you see while
 * editing is the napplet.
 */

export const NAPPLET_TYPE = 'napplet';

export interface NappletCanvasConfig {
  relays: string[];
  blossomServers: string[];
}

/** How a napplet with no reference yet, or one that failed, presents itself. */
const nappletStyle = {
  display: 'block',
  position: 'relative',
  'min-height': '320px',
  width: '100%',
  border: '1px solid #e2e8f0',
  'border-radius': '12px',
  overflow: 'hidden',
  background: '#fff',
};

/** The markup the palette inserts, and that a page stores. */
export function nappletMarkup(reference: string): string {
  const style = Object.entries(nappletStyle)
    .map(([property, value]) => `${property}:${value}`)
    .join(';');

  // The reference is bech32 from `nip19.encode`, so it carries nothing that
  // needs escaping — but it is interpolated into an attribute, and relying on
  // that would make this wrong the moment the encoding changed.
  const safe = reference.replace(/[^a-z0-9]/gi, '');

  return `<div ${NAPPLET_ATTR}="${safe}" style="${style}"></div>`;
}

/**
 * Registered as a plugin, because `grapesjs.init` loads plugins before parsing
 * `components` — a type registered afterwards would leave any napplet in the
 * starting page parsed as an anonymous `<div>`.
 */
export function nappletComponents(getConfig: () => NappletCanvasConfig) {
  return (editor: Editor) => {
    editor.DomComponents.addType(NAPPLET_TYPE, {
      isComponent: (el) =>
        el.tagName === 'DIV' && el.hasAttribute?.(NAPPLET_ATTR)
          ? { type: NAPPLET_TYPE }
          : undefined,

      model: {
        defaults: {
          name: 'Napplet',
          tagName: 'div',
          style: nappletStyle,
          // Nothing belongs inside it: the contents are a sandboxed frame this
          // editor does not own and cannot edit.
          droppable: false,
          traits: [
            {
              name: NAPPLET_ATTR,
              label: 'Napplet',
              placeholder: 'naddr1…',
            },
          ],
        },
      },

      view: {
        init() {
          // Traits write to attributes, and GrapesJS emits a per-key change
          // event for each one, so editing the trait reloads the napplet.
          this.listenTo(this.model, `change:attributes:${NAPPLET_ATTR}`, this.reload);
        },

        onRender() {
          this.reload();
        },

        reload() {
          const view = this as unknown as NappletView;
          view.napplet?.destroy();
          view.napplet = undefined;

          const el = view.el;
          const model = view.model;
          const reference = String(model.getAttributes()[NAPPLET_ATTR] ?? '').trim();

          el.innerHTML = '';

          if (!reference) {
            el.appendChild(notice(el, 'Pick a napplet, or paste an naddr into the panel.'));
            return;
          }

          const config = getConfig();
          let chrome: HTMLElement | null = notice(el, 'Loading napplet…');
          el.appendChild(chrome);

          view.napplet = mountNapplet(el, reference, {
            ...config,
            theme: pageTheme(el),
            instanceId: model.getId(),
            onStatus: (status: NappletStatus) => {
              if (status.state === 'ready' && !status.missing?.length) {
                chrome?.remove();
                chrome = null;
                return;
              }

              const text =
                status.state === 'error'
                  ? status.message
                  : status.state === 'loading'
                    ? 'Loading napplet…'
                    : `This page cannot provide: ${status.missing?.join(', ')}.`;

              if (!chrome) {
                chrome = notice(el, text);
                el.appendChild(chrome);
              }
              chrome.textContent = text;
              chrome.style.inset = status.state === 'ready' ? 'auto 0 0 0' : '0';
            },
          });
        },

        removed() {
          const view = this as unknown as NappletView;
          view.napplet?.destroy();
          view.napplet = undefined;
        },
      },
    });
  };
}

/** The view's own state, which GrapesJS's typings have no slot for. */
interface NappletView {
  el: HTMLElement;
  model: Component;
  napplet?: MountedNapplet;
}

/**
 * The overlay covering a napplet that isn't showing anything yet.
 *
 * Built with the canvas document's own `createElement`, not this one's: the
 * element is going into the GrapesJS frame, and a node minted by the wrong
 * document cannot be appended there.
 */
function notice(host: HTMLElement, text: string): HTMLElement {
  const el = host.ownerDocument.createElement('div');
  el.textContent = text;
  el.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
    'text-align:center',
    'font:16px/1.6 system-ui,-apple-system,sans-serif',
    'color:#64748b',
  ].join(';');
  return el;
}
