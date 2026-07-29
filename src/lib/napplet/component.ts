import type { Component, Editor } from 'grapesjs';

import { NAPPLET_ATTR } from './constants';
import { NappletBus } from './runtime/bus';
import { NappletIdentityService } from './runtime/identity';
import { mountNapplet, pageTheme, type MountedNapplet } from './runtime/mount';
import { RelayPool } from './runtime/relayPool';
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

const NAPPLET_TYPE = 'napplet';

export interface NappletCanvasConfig {
  relays: string[];
  blossomServers: string[];
  sandboxDomain: string;
  /**
   * The signed-in user, for NAP-IDENTITY.
   *
   * The editor is the one place this runtime has one: a published page is read
   * by a stranger with no signer the page may ask about, but whoever is editing
   * is signed in here — so a napplet on the canvas can be shown the identity it
   * would see in a shell that has one.
   */
  pubkey?: string;
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
    /*
     * One switchboard for the canvas, so two napplets on the page being edited
     * find each other exactly as they will once it is published — NAP-INC and
     * NAP-INTENT are the same page-wide thing here as they are there.
     */
    const bus = new NappletBus();

    /*
     * NAP-IDENTITY reads relays of its own rather than borrowing a napplet's,
     * because in the editor each napplet mounts its own pool and the user's
     * profile belongs to none of them. Rebuilt when the relay list changes, so
     * editing relays reaches identity queries the same way it reaches manifests.
     */
    let identity: { key: string; pool: RelayPool; service: NappletIdentityService } | null = null;

    const userService = (config: NappletCanvasConfig): NappletIdentityService => {
      const key = config.relays.join(' ');

      if (!identity || identity.key !== key) {
        identity?.pool.destroy();
        const pool = new RelayPool(config.relays);
        identity = { key, pool, service: new NappletIdentityService(pool) };
      }

      identity.service.setPublicKey(config.pubkey ?? '');
      return identity.service;
    };

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
        /*
         * Where GrapesJS puts — and clears — a component's children.
         *
         * `updateContent` runs `getChildrenContainer().innerHTML = ''` on every
         * render, and this component's element holds a live iframe rather than
         * children. Left alone, each render tore the napplet out and `onRender`
         * built a new one, which the next render tore out in turn: a frame that
         * restarted forever and never got far enough to show anything. Handing
         * GrapesJS a scratch element to clear instead keeps the real one
         * untouched, which it can afford because nothing is ever droppable here.
         */
        getChildrenContainer() {
          const view = this as unknown as NappletView;
          view.scratch ??= view.el.ownerDocument.createElement('div');
          return view.scratch;
        },

        init() {
          // Traits write to attributes, and GrapesJS emits a per-key change
          // event for each one, so editing the trait reloads the napplet.
          this.listenTo(this.model, `change:attributes:${NAPPLET_ATTR}`, this.reload);
          this.listenTo(this.model, 'change:status', this.syncInteractive);
        },

        onRender() {
          this.reload();
        },

        reload() {
          const view = this as unknown as NappletView;
          const el = view.el;
          const model = view.model;
          const reference = String(model.getAttributes()[NAPPLET_ATTR] ?? '').trim();

          /*
           * Nothing has changed and the napplet is still there, so leave it
           * alone. Remounting would re-resolve the manifest, register the
           * frame's Service Worker again and throw away whatever state the
           * napplet had built up — all to arrive back where it already was.
           */
          if (view.mounted === reference && view.napplet) return;

          view.napplet?.destroy();
          view.napplet = undefined;
          view.chrome?.remove();
          view.chrome = undefined;
          view.mounted = reference;

          if (!reference) {
            view.chrome = notice(el, 'Pick a napplet, or paste an naddr into the panel.');
            el.appendChild(view.chrome);
            return;
          }

          view.chrome = notice(el, 'Loading napplet…');
          el.appendChild(view.chrome);

          const config = getConfig();

          view.napplet = mountNapplet(el, reference, {
            ...config,
            bus,
            user: userService(config),
            theme: pageTheme(el),
            instanceId: model.getId(),
            interactive: isSelected(model),
            onStatus: (status: NappletStatus) => {
              if (status.state === 'ready' && !status.missing?.length) {
                view.chrome?.remove();
                view.chrome = undefined;
                return;
              }

              const text =
                status.state === 'error'
                  ? status.message
                  : status.state === 'loading'
                    ? 'Loading napplet…'
                    : `This page cannot provide: ${status.missing?.join(', ')}.`;

              if (!view.chrome) {
                view.chrome = notice(el, text);
                el.appendChild(view.chrome);
              }
              view.chrome.textContent = text;
              // A running napplet short of a capability keeps its frame and
              // gets a footnote; anything else is covered over.
              view.chrome.style.inset = status.state === 'ready' ? 'auto 0 0 0' : '0';
            },
          });
        },

        /*
         * Who gets the click: the editor, or the napplet.
         *
         * A napplet fills its slot with a cross-origin frame, and a frame eats
         * every pointer event that lands on it — so a running napplet could be
         * hovered but never selected, dragged or deleted, which left the only
         * way to remove one being the layer tree. Letting clicks through until
         * the component is selected gives it back the click-to-select every
         * other component has, and selecting it hands the napplet over so it
         * can still be tried out in place.
         */
        syncInteractive() {
          const view = this as unknown as NappletView;
          view.napplet?.setInteractive(isSelected(view.model));
        },

        removed() {
          const view = this as unknown as NappletView;
          view.napplet?.destroy();
          view.napplet = undefined;
          view.mounted = undefined;
        },
      },
    });
  };
}

/**
 * Whether this component is the selected one.
 *
 * `status` is also `'selected-parent'` for an ancestor of the selection, which
 * does not count: a napplet is never a parent of anything.
 */
function isSelected(model: Component): boolean {
  return model.get('status') === 'selected';
}

/** The view's own state, which GrapesJS's typings have no slot for. */
interface NappletView {
  el: HTMLElement;
  model: Component;
  napplet?: MountedNapplet;
  /** The reference currently running, so an unchanged render is a no-op. */
  mounted?: string;
  /** The overlay covering a napplet that isn't showing anything yet. */
  chrome?: HTMLElement;
  /** Handed to GrapesJS to clear in place of the element holding the frame. */
  scratch?: HTMLElement;
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
