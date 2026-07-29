import type { NappletArchetype } from '../manifest';
import type { NappletIntentAvailability, NappletIntentCandidate } from './types';

/**
 * The page's switchboard: NAP-INC routing and NAP-INTENT resolution.
 *
 * Napplets are sandboxed into origins of their own precisely so they cannot
 * reach each other, which leaves the shell as the only thing that can carry a
 * message between two of them. Everything here is that carrier, and it is
 * written on the assumption that both ends are hostile: a sender never names
 * itself (the bus knows which endpoint spoke), a caller never names a peer
 * except by a `dTag` the bus can resolve for itself, and a napplet that is not
 * on the page simply does not exist to the ones that are.
 *
 * One bus per page. Two napplets can only talk if the same shell is hosting
 * both, which is the whole boundary NAP-INC describes.
 */

/** Enough for a page's worth of coordination; few enough that one napplet can't flood the bus. */
const MAX_CHANNELS_PER_NAPPLET = 8;

/** Intent payloads held for a handler that hasn't subscribed yet. */
const MAX_QUEUED_INTENTS = 8;

/** What the bus needs from a napplet to route to it. */
export interface NappletEndpoint {
  /**
   * The NIP-5A `d` tag. Empty for a root napplet, which therefore cannot be
   * addressed: NAP-INC and NAP-INTENT both name peers by `dTag`, and a name
   * every root napplet shares is no name at all.
   */
  readonly dTag: string;
  /** A human label, for a candidate list. */
  readonly title: string;
  /** The roles this napplet declared in its manifest. */
  readonly archetypes: NappletArchetype[];
  /** NAP-INTENT's `windowId`: the slot on the page this napplet occupies. */
  readonly windowId: string;
  /** Whether the NAP-SHELL handshake has completed and messages will land. */
  live(): boolean;
  /** Delivers a shell-initiated message, or drops it before the handshake. */
  push(message: Record<string, unknown>): void;
  /** Brings the napplet's slot into view, for NAP-INTENT's `behavior.focus`. */
  focus(): void;
}

/** NAP-INTENT's `IntentRequest`, as it arrives over the wire. */
export interface IntentRequest {
  archetype?: unknown;
  action?: unknown;
  convention?: unknown;
  payload?: unknown;
  handler?: unknown;
  behavior?: { focus?: unknown; newWindow?: unknown; reuse?: unknown };
}

/** NAP-INTENT's `IntentResult`. */
export interface IntentResult {
  ok: boolean;
  archetype: string;
  action: string;
  handled: boolean;
  handler?: string;
  windowId?: string;
  convention?: string;
  error?: string;
}

interface Channel {
  id: string;
  a: NappletEndpoint;
  b: NappletEndpoint;
}

interface QueuedIntent {
  topic: string;
  message: Record<string, unknown>;
}

export class NappletBus {
  /** Insertion order is document order, which is what decides the default handler. */
  private readonly endpoints = new Set<NappletEndpoint>();
  private readonly topics = new Map<NappletEndpoint, Set<string>>();
  private readonly channels = new Map<string, Channel>();
  private readonly queued = new Map<NappletEndpoint, QueuedIntent[]>();
  private counter = 0;

  /* ---- membership ------------------------------------------------------- */

  /**
   * Adds a napplet to the page's catalog.
   *
   * Called as soon as the manifest resolves rather than when the napplet
   * finishes loading, because NAP-INTENT sources `available()` from the
   * installed catalog: a handler that is on the page but still booting is
   * discoverable, and an intent aimed at it waits rather than failing.
   */
  register(endpoint: NappletEndpoint): void {
    if (this.endpoints.has(endpoint)) return;
    this.endpoints.add(endpoint);
    this.announce(endpoint.archetypes);
  }

  /** Removes a napplet, tearing down everything that pointed at it. */
  unregister(endpoint: NappletEndpoint): void {
    if (!this.endpoints.delete(endpoint)) return;

    this.topics.delete(endpoint);
    this.queued.delete(endpoint);

    for (const channel of [...this.channels.values()]) {
      if (channel.a !== endpoint && channel.b !== endpoint) continue;
      this.channels.delete(channel.id);

      const survivor = channel.a === endpoint ? channel.b : channel.a;
      survivor.push({ type: 'inc.channel.closed', channelId: channel.id, reason: 'peer destroyed' });
    }

    this.announce(endpoint.archetypes);
  }

  /* ---- topics (NAP-INC) -------------------------------------------------- */

  subscribe(endpoint: NappletEndpoint, topic: string): void {
    const owned = this.topics.get(endpoint) ?? new Set<string>();
    this.topics.set(endpoint, owned);
    owned.add(topic);

    this.flush(endpoint, topic);
  }

  unsubscribe(endpoint: NappletEndpoint, topic: string): void {
    this.topics.get(endpoint)?.delete(topic);
  }

  /**
   * Delivers one topic message to everyone subscribed to exactly that string.
   *
   * `sender` is the bus's own answer, never the emitter's: NAP-INC makes runtime
   * attestation the trust boundary, so a napplet that puts a `sender` on the
   * wire has it overwritten here rather than honoured.
   */
  emit(from: NappletEndpoint, topic: string, payload: unknown): void {
    for (const [endpoint, owned] of this.topics) {
      // Sender exclusion: NAP-INC forbids the echo, so a napplet subscribed to
      // a topic it also emits on doesn't hear itself.
      if (endpoint === from || !owned.has(topic)) continue;
      endpoint.push({ type: 'inc.event', topic, sender: from.dTag, payload });
    }
  }

  /* ---- channels (NAP-INC) ------------------------------------------------ */

  /**
   * Opens a point-to-point channel, or explains why it couldn't be.
   *
   * The target is resolved here from its `dTag` and never handed back as
   * anything a napplet could address directly, which is what keeps the auth
   * check meaningful: after this returns, messages flow unvalidated, so this is
   * the only moment the shell gets to say no.
   */
  openChannel(from: NappletEndpoint, target: string): { channelId: string; peer: string } | { error: string } {
    if (!target) return { error: 'target not found' };

    /*
     * Live, not merely installed. NAP-INC requires a real endpoint behind a
     * channel — unlike NAP-INTENT's catalog, which deliberately includes
     * napplets that are still booting — because the target has to receive its
     * half of the handle before the opener is told the channel exists.
     */
    const peer = [...this.endpoints].find(
      (endpoint) =>
        endpoint !== from && endpoint.dTag && endpoint.dTag === target && endpoint.live(),
    );
    if (!peer) return { error: 'target not found' };

    if (this.channelsOf(from).length >= MAX_CHANNELS_PER_NAPPLET) {
      return { error: 'too many channels' };
    }
    if (this.channelsOf(peer).length >= MAX_CHANNELS_PER_NAPPLET) {
      return { error: 'peer has too many channels' };
    }

    const id = `c-${++this.counter}`;
    this.channels.set(id, { id, a: from, b: peer });

    // Enqueued for the target before the opener is told, so the peer's handle
    // exists by the time the opener can send anything down the channel.
    peer.push({ type: 'inc.channel.opened', channelId: id, peer: from.dTag });

    return { channelId: id, peer: peer.dTag };
  }

  channelEmit(from: NappletEndpoint, channelId: string, payload: unknown): void {
    const other = this.peerOf(from, channelId);
    if (!other) return;

    other.push({ type: 'inc.channel.event', channelId, sender: from.dTag, payload });
  }

  channelBroadcast(from: NappletEndpoint, payload: unknown): void {
    for (const channel of this.channelsOf(from)) {
      const other = channel.a === from ? channel.b : channel.a;
      other.push({ type: 'inc.channel.event', channelId: channel.id, sender: from.dTag, payload });
    }
  }

  channelList(from: NappletEndpoint): { id: string; peer: string }[] {
    return this.channelsOf(from).map((channel) => ({
      id: channel.id,
      peer: (channel.a === from ? channel.b : channel.a).dTag,
    }));
  }

  /** Tears a channel down and tells both ends, whichever end asked. */
  closeChannel(from: NappletEndpoint, channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel || (channel.a !== from && channel.b !== from)) return;

    this.channels.delete(channelId);
    channel.a.push({ type: 'inc.channel.closed', channelId });
    channel.b.push({ type: 'inc.channel.closed', channelId });
  }

  private channelsOf(endpoint: NappletEndpoint): Channel[] {
    return [...this.channels.values()].filter(
      (channel) => channel.a === endpoint || channel.b === endpoint,
    );
  }

  private peerOf(from: NappletEndpoint, channelId: string): NappletEndpoint | null {
    const channel = this.channels.get(channelId);
    if (!channel) return null;
    if (channel.a === from) return channel.b;
    if (channel.b === from) return channel.a;
    // Not an endpoint of this channel, so it is not its channel to send on.
    return null;
  }

  /* ---- intents (NAP-INTENT) ---------------------------------------------- */

  /**
   * Who can serve a role, and which of them gets it by default.
   *
   * There is no per-user default-handler setting to consult here: a published
   * page has no settings, and the person who arranged the napplets on it is the
   * closest thing it has to a user expressing a preference. So the default is
   * the first candidate in document order — deterministic, and the author's
   * arrangement rather than the caller's choice.
   */
  availability(archetype: string): NappletIntentAvailability {
    const candidates: NappletIntentCandidate[] = [];

    for (const endpoint of this.endpoints) {
      if (!endpoint.dTag) continue;

      const role = endpoint.archetypes.find((entry) => entry.archetype === archetype);
      if (!role) continue;

      candidates.push({
        dTag: endpoint.dTag,
        title: endpoint.title,
        actions: [...role.actions],
        conventions: [...role.conventions],
        isDefault: candidates.length === 0,
      });
    }

    return {
      archetype,
      available: candidates.length > 0,
      candidates,
      hasDefault: candidates.length > 0,
    };
  }

  /** Availability for every role anything on this page can serve. */
  handlers(): NappletIntentAvailability[] {
    const slugs = new Set<string>();
    for (const endpoint of this.endpoints) {
      if (!endpoint.dTag) continue;
      for (const role of endpoint.archetypes) slugs.add(role.archetype);
    }

    return [...slugs].map((slug) => this.availability(slug));
  }

  /**
   * Resolves a role to a napplet and hands it the payload.
   *
   * Resolution is the trust boundary NAP-INTENT cares about, so the caller gets
   * no say in it beyond naming a role: a `handler` dTag is honoured only when
   * that napplet already serves the role on this page, which makes it a
   * narrowing of the candidate list rather than a way to address anything.
   */
  invoke(from: NappletEndpoint, request: IntentRequest): IntentResult {
    const archetype = typeof request.archetype === 'string' ? request.archetype : '';
    const action = typeof request.action === 'string' && request.action ? request.action : 'open';
    const base: IntentResult = { ok: false, archetype, action, handled: false };

    if (!archetype) return { ...base, error: 'unknown archetype' };

    const { candidates } = this.availability(archetype);
    if (!candidates.length) return { ...base, error: 'no handler' };

    const wanted = typeof request.handler === 'string' ? request.handler : 'default';

    let chosen: NappletIntentCandidate | undefined;
    if (wanted === 'default' || !wanted) {
      chosen = candidates[0];
    } else if (wanted === 'choose') {
      /*
       * There is nowhere to ask. A published page has no chrome of the shell's
       * own to draw a chooser in, so the only honest answers are "there was
       * only ever one" and "I cannot ask" — never "I picked for you", which
       * would put the shell's thumb on a decision NAP-INTENT reserves for the
       * user.
       */
      if (candidates.length > 1) return { ...base, error: 'no chooser available' };
      chosen = candidates[0];
    } else {
      chosen = candidates.find((candidate) => candidate.dTag === wanted);
      if (!chosen) return { ...base, error: 'no handler' };
    }

    if (!chosen.actions.includes(action)) return { ...base, error: 'unsupported action' };

    const asked = typeof request.convention === 'string' ? request.convention : undefined;
    if (asked && chosen.conventions.length && !chosen.conventions.includes(asked)) {
      return { ...base, error: 'unsupported convention' };
    }

    // The handler's own first convention when the caller named none, and
    // `napplet:<archetype>/<action>` when the handler named none either — which
    // is the identity the convention would have had anyway.
    const convention = asked ?? chosen.conventions[0] ?? `napplet:${archetype}/${action}`;

    const target = [...this.endpoints].find((endpoint) => endpoint.dTag === chosen.dTag);
    if (!target) return { ...base, error: 'invoke failed' };

    if (request.behavior?.focus) target.focus();

    this.deliver(target, {
      topic: convention,
      message: {
        type: 'inc.event',
        topic: convention,
        sender: from.dTag,
        payload: request.payload,
      },
    });

    return {
      ok: true,
      archetype,
      action,
      handled: true,
      handler: chosen.dTag,
      windowId: target.windowId,
      convention,
    };
  }

  /**
   * Hands an intent payload over, or holds it until the handler is listening.
   *
   * NAP-INTENT requires delivery only once the handler is ready to receive, and
   * a cold-started napplet subscribes some way after it is asked for. Holding
   * the payload is what makes "open this note in the note napplet" work on a
   * page where the note napplet has not finished booting.
   */
  private deliver(target: NappletEndpoint, queued: QueuedIntent): void {
    if (this.topics.get(target)?.has(queued.topic)) {
      target.push(queued.message);
      return;
    }

    const pending = this.queued.get(target) ?? [];
    this.queued.set(target, pending);

    // Oldest first: a napplet that never subscribes must not be able to pin
    // payloads here forever, and the newest request is the live one.
    if (pending.length >= MAX_QUEUED_INTENTS) pending.shift();
    pending.push(queued);
  }

  private flush(endpoint: NappletEndpoint, topic: string): void {
    const pending = this.queued.get(endpoint);
    if (!pending?.length) return;

    const ready = pending.filter((entry) => entry.topic === topic);
    if (!ready.length) return;

    this.queued.set(
      endpoint,
      pending.filter((entry) => entry.topic !== topic),
    );
    for (const entry of ready) endpoint.push(entry.message);
  }

  /** Tells every napplet that the catalog for these roles has moved. */
  private announce(archetypes: NappletArchetype[]): void {
    for (const role of archetypes) {
      const availability = this.availability(role.archetype);
      for (const endpoint of this.endpoints) {
        endpoint.push({ type: 'intent.changed', availability });
      }
    }
  }
}
