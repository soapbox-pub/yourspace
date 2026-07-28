import { isRelayUrl, RelayPool } from './relayPool';
import { NappletStorage } from './storage';
import type {
  NappletIdentity,
  NappletNostrEvent,
  NappletNostrFilter,
  NappletTheme,
} from './types';

/**
 * One napplet's side of the conversation.
 *
 * NIP-5D puts the host on the trusted side of the boundary and the napplet on
 * the untrusted one, so nothing here takes the napplet's word for anything.
 * Identity is the one the host computed from the verified bytes, not a value
 * the napplet sent; every message is dispatched on its `type` alone; and a type
 * that isn't recognized is dropped in silence, which is what stops a napplet
 * probing for capabilities it wasn't granted.
 */

/** The domains this runtime serves. Order is the order a napplet sees them. */
export const GRANTED_DOMAINS = ['shell', 'relay', 'storage', 'theme'] as const;

/** NAP-RELAY caps nothing by default; an unbounded filter is a hostile one. */
const MAX_LIMIT = 500;

/** Enough for a napplet to be useful, few enough that one can't exhaust the pool. */
const MAX_SUBSCRIPTIONS = 16;

type Send = (message: Record<string, unknown>) => void;

interface RelayEventResult {
  event: NappletNostrEvent;
  sidecar?: { relayHints?: string[] };
}

/**
 * Filters, made safe to forward.
 *
 * A napplet composes these, and they go to relays the host chose and pays for.
 * An unbounded subscription is the cheapest way for a napplet to cost its host
 * a connection, so every filter gets a ceiling whether or not it asked for one.
 */
function sanitizeFilters(value: unknown): NappletNostrFilter[] {
  const filters = Array.isArray(value) ? value : [value];

  return filters
    .filter((filter): filter is NappletNostrFilter => Boolean(filter) && typeof filter === 'object')
    .slice(0, 8)
    .map((filter) => {
      const limit = typeof filter.limit === 'number' ? filter.limit : MAX_LIMIT;
      return { ...filter, limit: Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT) };
    });
}

export class NappletSession {
  private readonly storage: NappletStorage;
  private readonly closers = new Map<string, () => void>();
  private handshaken = false;
  private destroyed = false;

  constructor(
    readonly identity: NappletIdentity,
    private readonly send: Send,
    private readonly pool: RelayPool,
    private readonly relays: string[],
    instanceId: string,
    private theme: NappletTheme,
  ) {
    this.storage = new NappletStorage(identity, instanceId);
  }

  /** Pushes a new theme to the napplet (NAP-THEME's shell-initiated message). */
  setTheme(theme: NappletTheme): void {
    this.theme = theme;
    if (this.handshaken) this.send({ type: 'theme.changed', theme });
  }

  destroy(): void {
    this.destroyed = true;
    for (const close of this.closers.values()) close();
    this.closers.clear();
  }

  /**
   * Routes one inbound message.
   *
   * The caller has already established that it came from this napplet's Window;
   * that check is the security boundary and does not belong in here.
   */
  handle(message: Record<string, unknown>): void {
    if (this.destroyed) return;

    const type = message.type;
    if (typeof type !== 'string') return;

    switch (type) {
      case 'shell.ready':
        return this.onReady();

      case 'relay.subscribe':
        return this.onSubscribe(message);
      case 'relay.close':
        return this.onUnsubscribe(message);
      case 'relay.query':
        return void this.onQuery(message);
      case 'relay.publish':
      case 'relay.publishEncrypted':
        return this.refusePublish(message, type);

      case 'storage.get':
      case 'storage.set':
      case 'storage.remove':
      case 'storage.keys':
        return this.onStorage(message, type);

      case 'theme.get':
        return this.send({ type: 'theme.get.result', id: message.id, theme: this.theme });

      default:
        // Silently ignored, per NIP-5D: an unknown type must not be
        // distinguishable from an unimplemented one.
        return;
    }
  }

  /**
   * NAP-SHELL's half of the handshake.
   *
   * Idempotent by requirement: a second `shell.ready` must not open a second
   * session or resend the environment, so a napplet cannot replay it to
   * re-scope what it was granted.
   */
  private onReady(): void {
    if (this.handshaken) return;
    this.handshaken = true;

    this.send({
      type: 'shell.init',
      capabilities: { domains: [...GRANTED_DOMAINS] },
      services: [],
    });
  }

  private onSubscribe(message: Record<string, unknown>): void {
    const subId = String(message.subId ?? '');
    if (!subId || this.closers.has(subId)) return;

    if (this.closers.size >= MAX_SUBSCRIPTIONS) {
      this.send({ type: 'relay.closed', subId, reason: 'Too many open subscriptions.' });
      return;
    }

    const filters = sanitizeFilters(message.filters);
    if (!filters.length) {
      this.send({ type: 'relay.closed', subId, reason: 'No usable filter.' });
      return;
    }

    /*
     * A scoped relay is honoured only when it is one the host already talks to.
     * Taking the napplet's URL as given would make the host into an open
     * WebSocket proxy — the SSRF shape NAP-RELAY warns about.
     */
    const scoped = typeof message.relay === 'string' ? message.relay : undefined;
    if (scoped && !(isRelayUrl(scoped) && this.relays.includes(scoped))) {
      this.send({ type: 'relay.closed', subId, reason: 'That relay is not available here.' });
      return;
    }

    const close = this.pool.subscribe(
      filters,
      (event, relay) => {
        const result: RelayEventResult = { event, sidecar: { relayHints: [relay] } };
        this.send({ type: 'relay.event', subId, result });
      },
      () => this.send({ type: 'relay.eose', subId }),
    );

    this.closers.set(subId, close);
  }

  private onUnsubscribe(message: Record<string, unknown>): void {
    const subId = String(message.subId ?? '');
    const close = this.closers.get(subId);
    if (!close) return;

    this.closers.delete(subId);
    close();
  }

  private async onQuery(message: Record<string, unknown>): Promise<void> {
    const id = message.id;
    const filters = sanitizeFilters(message.filters);

    if (!filters.length) {
      this.send({ type: 'relay.query.result', id, error: 'No usable filter.' });
      return;
    }

    try {
      const events = await this.pool.query(filters);
      if (this.destroyed) return;

      const results: RelayEventResult[] = events.map((event) => ({ event }));
      this.send({ type: 'relay.query.result', id, events: results });
    } catch (error) {
      if (this.destroyed) return;
      this.send({
        type: 'relay.query.result',
        id,
        error: error instanceof Error ? error.message : 'The query failed.',
      });
    }
  }

  /**
   * NAP-RELAY makes publishing the shell's job precisely so the shell can
   * decide — and this shell has nothing to decide with. It runs inside a page
   * anyone may be reading, with no key of its own and no claim on the reader's;
   * a signature here would either be forged or coerced out of a visitor who
   * came to look at a homepage. So reads are served and writes are refused,
   * which is a truthful `ok: false` rather than a capability quietly missing.
   */
  private refusePublish(message: Record<string, unknown>, type: string): void {
    this.send({
      type: `${type}.result`,
      id: message.id,
      ok: false,
      error: 'This page cannot sign events: no signing key is available to it.',
    });
  }

  private onStorage(message: Record<string, unknown>, type: string): void {
    const id = message.id;
    const scope = message.scope === 'instance' ? 'instance' : 'shared';
    const key = typeof message.key === 'string' ? message.key : '';

    try {
      switch (type) {
        case 'storage.get':
          return this.send({
            type: 'storage.get.result',
            id,
            value: this.storage.getItem(key, scope),
          });

        case 'storage.set':
          this.storage.setItem(key, String(message.value ?? ''), scope);
          return this.send({ type: 'storage.set.result', id });

        case 'storage.remove':
          this.storage.removeItem(key, scope);
          return this.send({ type: 'storage.remove.result', id });

        default:
          return this.send({ type: 'storage.keys.result', id, keys: this.storage.keys(scope) });
      }
    } catch (error) {
      this.send({
        type: `${type}.result`,
        id,
        error: error instanceof Error ? error.message : 'The storage request failed.',
      });
    }
  }
}
