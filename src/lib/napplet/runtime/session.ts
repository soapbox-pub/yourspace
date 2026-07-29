import type { NappletArchetype } from '../manifest';
import type { IntentRequest, NappletBus, NappletEndpoint } from './bus';
import type { NappletIdentityService } from './identity';
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
export const GRANTED_DOMAINS = [
  'shell',
  'relay',
  'storage',
  'theme',
  'inc',
  'intent',
  'identity',
] as const;

/** NAP-RELAY caps nothing by default; an unbounded filter is a hostile one. */
const MAX_LIMIT = 500;

/** Enough for a napplet to be useful, few enough that one can't exhaust the pool. */
const MAX_SUBSCRIPTIONS = 16;

/** Likewise for topics: a napplet coordinating with its neighbours needs a handful. */
const MAX_TOPICS = 32;

/** Long enough for any convention identity, short enough not to be a payload. */
const MAX_TOPIC_LENGTH = 512;

type Send = (message: Record<string, unknown>) => void;

interface RelayEventResult {
  event: NappletNostrEvent;
  sidecar?: { relayHints?: string[] };
}

export interface NappletSessionOptions {
  /** Computed from the verified bytes; never anything the napplet claimed. */
  identity: NappletIdentity;
  /** A human label, for a NAP-INTENT candidate list. */
  title: string;
  /** The roles the manifest declared this napplet fulfills. */
  archetypes: NappletArchetype[];
  send: Send;
  pool: RelayPool;
  /** The relays a scoped NAP-RELAY subscription may name. */
  relays: string[];
  /**
   * Distinguishes two copies of the same napplet on one page, for
   * instance-scoped storage and as NAP-INTENT's `windowId`.
   */
  instanceId: string;
  theme: NappletTheme;
  /** The page's NAP-INC / NAP-INTENT switchboard, shared by every napplet on it. */
  bus: NappletBus;
  /** The shell user, for NAP-IDENTITY. Shared for the same reason. */
  user: NappletIdentityService;
  /** Brings this napplet's slot into view, for NAP-INTENT's `behavior.focus`. */
  focus: () => void;
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

/** A topic string the bus can route on, or nothing. */
function topicOf(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > MAX_TOPIC_LENGTH) return null;
  return value;
}

export class NappletSession implements NappletEndpoint {
  readonly identity: NappletIdentity;
  readonly title: string;
  readonly archetypes: NappletArchetype[];
  readonly windowId: string;

  private readonly storage: NappletStorage;
  private readonly closers = new Map<string, () => void>();
  private readonly subscribedTopics = new Set<string>();
  private readonly send: Send;
  private readonly pool: RelayPool;
  private readonly relays: string[];
  private readonly bus: NappletBus;
  private readonly user: NappletIdentityService;
  private readonly focusSlot: () => void;
  private stopWatchingUser: (() => void) | null = null;
  private theme: NappletTheme;
  private handshaken = false;
  private destroyed = false;

  constructor(options: NappletSessionOptions) {
    this.identity = options.identity;
    this.title = options.title;
    this.archetypes = options.archetypes;
    this.windowId = options.instanceId;

    this.send = options.send;
    this.pool = options.pool;
    this.relays = options.relays;
    this.bus = options.bus;
    this.user = options.user;
    this.focusSlot = options.focus;
    this.theme = options.theme;

    this.storage = new NappletStorage(options.identity, options.instanceId);
  }

  /* ---- the bus's view of this napplet ----------------------------------- */

  get dTag(): string {
    return this.identity.dTag;
  }

  live(): boolean {
    return this.handshaken && !this.destroyed;
  }

  /**
   * Delivers a shell-initiated message.
   *
   * Dropped before the handshake: NAP-SHELL makes `shell.ready` the moment a
   * napplet's receiver exists, so anything sent earlier lands nowhere and
   * pretending otherwise would have the bus believing a message was delivered.
   */
  push(message: Record<string, unknown>): void {
    if (!this.live()) return;
    this.send(message);
  }

  focus(): void {
    this.focusSlot();
  }

  /** Pushes a new theme to the napplet (NAP-THEME's shell-initiated message). */
  setTheme(theme: NappletTheme): void {
    this.theme = theme;
    this.push({ type: 'theme.changed', theme });
  }

  destroy(): void {
    this.destroyed = true;
    for (const close of this.closers.values()) close();
    this.closers.clear();

    this.stopWatchingUser?.();
    this.stopWatchingUser = null;

    // Last, because unregistering tells the peers of every channel this napplet
    // held that it has gone, and that is a message about a napplet that is
    // already torn down rather than one on its way out.
    this.bus.unregister(this);
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

    if (type === 'shell.ready') return this.onReady();

    /*
     * NAP-SHELL gates everything else. Until the handshake has happened there
     * is no session to serve, which gives the shell one place to refuse a
     * napplet every capability at once rather than a check per domain.
     */
    if (!this.handshaken) return;

    switch (type) {
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

      case 'inc.emit':
      case 'inc.subscribe':
      case 'inc.unsubscribe':
      case 'inc.channel.open':
      case 'inc.channel.emit':
      case 'inc.channel.broadcast':
      case 'inc.channel.list':
      case 'inc.channel.close':
        return this.onInc(message, type);

      case 'intent.invoke':
      case 'intent.available':
      case 'intent.handlers':
        return this.onIntent(message, type);

      case 'identity.getPublicKey':
        return this.send({
          type: 'identity.getPublicKey.result',
          id: message.id,
          pubkey: this.user.getPublicKey(),
        });

      case 'identity.getRelays':
      case 'identity.getProfile':
      case 'identity.getFollows':
      case 'identity.getList':
      case 'identity.getZaps':
      case 'identity.getMutes':
      case 'identity.getBlocked':
      case 'identity.getBadges':
        return void this.onIdentity(message, type);

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

    // NAP-IDENTITY requires loaded napplets to be told when the user changes,
    // so they never have to poll for a signer that might appear.
    this.stopWatchingUser = this.user.onChanged((pubkey) => {
      this.push({ type: 'identity.changed', pubkey });
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

  /**
   * NAP-INC, which is almost entirely the bus's business.
   *
   * What is left here is the part that must not be delegated: the emitting
   * napplet is this session, whatever the message says, so every call passes
   * `this` and no call passes a sender.
   */
  private onInc(message: Record<string, unknown>, type: string): void {
    const id = message.id;

    switch (type) {
      case 'inc.emit': {
        const topic = topicOf(message.topic);
        if (topic) this.bus.emit(this, topic, message.payload);
        return;
      }

      case 'inc.subscribe': {
        const topic = topicOf(message.topic);
        if (!topic) {
          return this.send({ type: 'inc.subscribe.result', id, error: 'unusable topic' });
        }
        if (!this.subscribedTopics.has(topic) && this.subscribedTopics.size >= MAX_TOPICS) {
          return this.send({ type: 'inc.subscribe.result', id, error: 'too many topics' });
        }

        this.subscribedTopics.add(topic);
        this.bus.subscribe(this, topic);
        return this.send({ type: 'inc.subscribe.result', id });
      }

      case 'inc.unsubscribe': {
        const topic = topicOf(message.topic);
        if (!topic) return;
        this.subscribedTopics.delete(topic);
        return this.bus.unsubscribe(this, topic);
      }

      case 'inc.channel.open': {
        const target = typeof message.target === 'string' ? message.target : '';
        const opened = this.bus.openChannel(this, target);
        return this.send({ type: 'inc.channel.open.result', id, ...opened });
      }

      case 'inc.channel.emit': {
        const channelId = typeof message.channelId === 'string' ? message.channelId : '';
        return this.bus.channelEmit(this, channelId, message.payload);
      }

      case 'inc.channel.broadcast':
        return this.bus.channelBroadcast(this, message.payload);

      case 'inc.channel.list':
        return this.send({
          type: 'inc.channel.list.result',
          id,
          channels: this.bus.channelList(this),
        });

      default: {
        const channelId = typeof message.channelId === 'string' ? message.channelId : '';
        return this.bus.closeChannel(this, channelId);
      }
    }
  }

  private onIntent(message: Record<string, unknown>, type: string): void {
    const id = message.id;

    if (type === 'intent.handlers') {
      return this.send({ type: 'intent.handlers.result', id, handlers: this.bus.handlers() });
    }

    if (type === 'intent.available') {
      const archetype = typeof message.archetype === 'string' ? message.archetype : '';
      return this.send({
        type: 'intent.available.result',
        id,
        availability: this.bus.availability(archetype),
      });
    }

    const request = (
      message.request && typeof message.request === 'object' ? message.request : {}
    ) as IntentRequest;

    return this.send({ type: 'intent.invoke.result', id, result: this.bus.invoke(this, request) });
  }

  /**
   * One NAP-IDENTITY query.
   *
   * Every one of these answers with the same `id` whatever happens, because a
   * napplet that asked has a promise waiting: a failure is an `error` field
   * beside an empty result, never a message that never comes.
   */
  private async onIdentity(message: Record<string, unknown>, type: string): Promise<void> {
    const id = message.id;
    const query = this.identityQuery(message, type);
    if (!query) return;

    const { field, empty, load } = query;

    try {
      const value = await load();
      if (this.destroyed) return;
      this.send({ type: `${type}.result`, id, [field]: value });
    } catch (error) {
      if (this.destroyed) return;
      this.send({
        type: `${type}.result`,
        id,
        [field]: empty,
        error: error instanceof Error ? error.message : 'The identity query failed.',
      });
    }
  }

  /**
   * What a NAP-IDENTITY query reads, and what it answers with when it can't.
   *
   * The loads go through the shared cache rather than the service directly, so
   * a page of napplets all asking who the user follows costs one subscription
   * between them.
   */
  private identityQuery(
    message: Record<string, unknown>,
    type: string,
  ): { field: string; empty: unknown; load: () => Promise<unknown> } | null {
    const user = this.user;

    switch (type) {
      case 'identity.getRelays':
        return { field: 'relays', empty: {}, load: () => user.cached('relays', () => user.getRelays()) };
      case 'identity.getProfile':
        return { field: 'profile', empty: null, load: () => user.cached('profile', () => user.getProfile()) };
      case 'identity.getFollows':
        return { field: 'pubkeys', empty: [], load: () => user.cached('follows', () => user.getFollows()) };
      case 'identity.getMutes':
        return { field: 'pubkeys', empty: [], load: () => user.cached('mutes', () => user.getMutes()) };
      case 'identity.getBlocked':
        return { field: 'pubkeys', empty: [], load: () => user.getBlocked() };
      case 'identity.getZaps':
        return { field: 'zaps', empty: [], load: () => user.cached('zaps', () => user.getZaps()) };
      case 'identity.getBadges':
        return { field: 'badges', empty: [], load: () => user.cached('badges', () => user.getBadges()) };
      case 'identity.getList': {
        const listType = typeof message.listType === 'string' ? message.listType : '';
        return {
          field: 'entries',
          empty: [],
          load: () => user.cached(`list:${listType}`, () => user.getList(listType)),
        };
      }
      default:
        return null;
    }
  }
}
