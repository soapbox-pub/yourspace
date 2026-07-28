import { verifyEvent } from 'nostr-tools/pure';

import type { NappletNostrEvent, NappletNostrFilter } from './types';

/**
 * A relay client small enough to ship inside a published page.
 *
 * The runtime cannot use the app's Nostrify pool: it also runs as a standalone
 * script inside somebody's homepage, where there is no app. This is the subset
 * of NIP-01 that a napplet runtime needs — open a socket, `REQ`, collect until
 * `EOSE`, `CLOSE` — and nothing else.
 *
 * Every event is signature-checked before it leaves here. Relays are untrusted
 * and a forged manifest would decide which bytes get executed, so this is the
 * check the whole scheme rests on; doing it in one place means no caller can
 * forget it.
 */

/** Long enough for a cold socket on a slow connection, short enough to fail. */
const CONNECT_TIMEOUT = 8000;

type EventHandler = (event: NappletNostrEvent, relay: string) => void;

interface Subscription {
  filters: NappletNostrFilter[];
  onEvent: EventHandler;
  onEose: () => void;
  /** Relays that have sent EOSE, so it is only reported once all have. */
  eosed: Set<string>;
  closed: boolean;
}

function isEvent(value: unknown): value is NappletNostrEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.sig === 'string' &&
    typeof event.kind === 'number' &&
    typeof event.content === 'string' &&
    typeof event.created_at === 'number' &&
    Array.isArray(event.tags)
  );
}

/** Only `wss:`/`ws:`, so a filter or hint can't select another scheme. */
export function isRelayUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'wss:' || protocol === 'ws:';
  } catch {
    return false;
  }
}

export class RelayPool {
  private sockets = new Map<string, WebSocket>();
  private subscriptions = new Map<string, Subscription>();
  private counter = 0;

  constructor(private readonly relays: string[]) {
    this.relays = relays.filter(isRelayUrl);
  }

  /** Opens a socket, or returns the one already open for that relay. */
  private socket(url: string): WebSocket | null {
    const existing = this.sockets.get(url);
    if (existing && existing.readyState <= WebSocket.OPEN) return existing;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      return null;
    }

    socket.addEventListener('message', (message) => this.receive(url, message));
    // A relay that drops is one fewer source, not a failure: the remaining
    // sockets still answer, and a subscription waiting on EOSE from a socket
    // that will never send one has to stop waiting for it.
    socket.addEventListener('close', () => {
      this.sockets.delete(url);
      for (const [id, sub] of this.subscriptions) this.markEosed(id, sub, url);
    });
    socket.addEventListener('error', () => socket.close());
    socket.addEventListener('open', () => {
      for (const [id, sub] of this.subscriptions) {
        if (!sub.closed) this.send(socket, ['REQ', id, ...sub.filters]);
      }
    });

    this.sockets.set(url, socket);
    return socket;
  }

  private send(socket: WebSocket, message: unknown[]): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // A socket that won't take a frame is one that is going away.
    }
  }

  private markEosed(id: string, sub: Subscription, relay: string): void {
    if (sub.closed) return;

    sub.eosed.add(relay);
    // Only relays that actually have a socket can still answer.
    const pending = this.relays.filter((url) => !sub.eosed.has(url));
    if (pending.length === 0) sub.onEose();
  }

  private receive(relay: string, message: MessageEvent): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(message.data));
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;

    const [verb, id] = parsed as [string, string];
    const sub = typeof id === 'string' ? this.subscriptions.get(id) : undefined;
    if (!sub || sub.closed) return;

    if (verb === 'EVENT') {
      const event = parsed[2];
      // Untrusted transport: a relay may send anything at all, including an
      // event nobody signed or one that doesn't match what was asked for.
      if (!isEvent(event) || !verifyEvent(event)) return;
      sub.onEvent(event, relay);
      return;
    }

    if (verb === 'EOSE') {
      this.markEosed(id, sub, relay);
      return;
    }

    if (verb === 'CLOSED') this.markEosed(id, sub, relay);
  }

  /** Opens a subscription across every relay. Returns its closer. */
  subscribe(
    filters: NappletNostrFilter[],
    onEvent: EventHandler,
    onEose: () => void = () => {},
  ): () => void {
    const id = `n${++this.counter}`;
    const sub: Subscription = { filters, onEvent, onEose, eosed: new Set(), closed: false };
    this.subscriptions.set(id, sub);

    let opened = 0;
    for (const url of this.relays) {
      const socket = this.socket(url);
      if (!socket) {
        sub.eosed.add(url);
        continue;
      }
      opened++;
      if (socket.readyState === WebSocket.OPEN) this.send(socket, ['REQ', id, ...filters]);
    }

    // Nothing to wait for, so the caller is told immediately rather than
    // hanging until its own timeout.
    if (opened === 0) queueMicrotask(() => this.subscriptions.has(id) && sub.onEose());

    return () => {
      if (sub.closed) return;
      sub.closed = true;
      this.subscriptions.delete(id);
      for (const url of this.relays) {
        const socket = this.sockets.get(url);
        if (socket) this.send(socket, ['CLOSE', id]);
      }
    };
  }

  /** Collects verified events until every relay has sent EOSE, or time runs out. */
  query(filters: NappletNostrFilter[], timeout = CONNECT_TIMEOUT): Promise<NappletNostrEvent[]> {
    return new Promise((resolve) => {
      const events = new Map<string, NappletNostrEvent>();
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        close();
        resolve([...events.values()]);
      };

      const timer = window.setTimeout(finish, timeout);
      const close = this.subscribe(
        filters,
        (event) => events.set(event.id, event),
        finish,
      );
    });
  }

  /** Drops every socket and subscription. */
  destroy(): void {
    for (const sub of this.subscriptions.values()) sub.closed = true;
    this.subscriptions.clear();
    for (const socket of this.sockets.values()) socket.close();
    this.sockets.clear();
  }
}
