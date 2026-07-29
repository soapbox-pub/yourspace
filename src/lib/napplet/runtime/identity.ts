import type { RelayPool } from './relayPool';
import type {
  NappletBadge,
  NappletNostrEvent,
  NappletNostrFilter,
  NappletProfile,
  NappletRelayMap,
  NappletZapReceipt,
} from './types';

/**
 * NAP-IDENTITY: what a napplet may learn about the person using the shell.
 *
 * Read-only by construction, not by policy — there is no signer behind this,
 * only relay reads, so there is nothing here that could sign, encrypt or
 * decrypt even if a napplet asked. Everything a napplet gets is public data
 * about a pubkey, which is exactly the line NAP-IDENTITY draws.
 *
 * One service per page, shared by every napplet on it: four napplets asking who
 * the user follows should cost one subscription, not four.
 */

/** NIP-58's fixed identifier for the list of badges a user displays. */
const PROFILE_BADGES = 'profile_badges';

/** Long enough that a page's napplets share one answer; short enough to be current. */
const CACHE_TTL = 60_000;

/** A page of receipts is plenty to render from; a napplet is not an accountant. */
const ZAP_LIMIT = 50;

/**
 * The NIP-51 lists `getList` knows how to fetch.
 *
 * NAP-IDENTITY leaves the vocabulary open and names three examples. Anything
 * outside this map is answered with `unsupported list type` rather than an
 * empty array, so a napplet can tell "you have no bookmarks" from "this shell
 * has never heard of that".
 */
const LIST_KINDS: Record<string, number> = {
  mutes: 10000,
  pins: 10001,
  relays: 10002,
  bookmarks: 10003,
  communities: 10004,
  'public-chats': 10005,
  'blocked-relays': 10006,
  'search-relays': 10007,
  interests: 10015,
  emojis: 10030,
};

/** Tags that describe a list rather than being an entry in one. */
const LIST_METADATA = new Set(['d', 'alt', 'title', 'image', 'description', 'name', 'summary', 'client']);

type Listener = (pubkey: string) => void;

interface CacheEntry {
  at: number;
  value: Promise<unknown>;
}

function tagValues(event: NappletNostrEvent, name: string): string[] {
  return event.tags
    .filter(([tag, value]) => tag === name && typeof value === 'string' && value)
    .map(([, value]) => value);
}

/**
 * A bolt11 invoice's amount in millisats, or 0 if it names none.
 *
 * Only the human-readable prefix is read: the amount lives there in plain
 * digits, and the rest of the invoice is a signature over data this has no
 * reason to look at.
 */
function bolt11Millisats(invoice: string): number {
  const match = /^ln(?:bc|tb|bcrt|sb)(\d+)([munp])?/i.exec(invoice.trim());
  if (!match) return 0;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;

  switch (match[2]?.toLowerCase()) {
    // Millisats per bitcoin is 1e11, and each multiplier scales that down.
    case 'm':
      return amount * 1e8;
    case 'u':
      return amount * 1e5;
    case 'n':
      return amount * 1e2;
    case 'p':
      return Math.floor(amount / 10);
    default:
      return amount * 1e11;
  }
}

export class NappletIdentityService {
  private readonly listeners = new Set<Listener>();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly pool: RelayPool,
    private user = '',
  ) {}

  /** The connected signer's pubkey, or `''` when there is none. */
  getPublicKey(): string {
    return this.user;
  }

  /**
   * Points the service at a different user, or at none.
   *
   * Everything cached was about the previous one, so it goes: a napplet asking
   * for the follow list after a sign-out must not be handed the list of whoever
   * was signed in before.
   */
  setPublicKey(pubkey: string): void {
    const next = /^[0-9a-f]{64}$/i.test(pubkey) ? pubkey.toLowerCase() : '';
    if (next === this.user) return;

    this.user = next;
    this.cache.clear();
    for (const listener of this.listeners) listener(next);
  }

  onChanged(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getRelays(): Promise<NappletRelayMap> {
    const event = await this.latest(10002);
    if (!event) return {};

    const relays: NappletRelayMap = {};
    for (const [tag, url, marker] of event.tags) {
      if (tag !== 'r' || typeof url !== 'string' || !url) continue;
      // NIP-65: a bare `r` tag is both, and a marker narrows it to one.
      relays[url] = { read: marker !== 'write', write: marker !== 'read' };
    }
    return relays;
  }

  async getProfile(): Promise<NappletProfile | null> {
    const event = await this.latest(0);
    if (!event) return null;

    let metadata: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(event.content);
      if (!parsed || typeof parsed !== 'object') return null;
      metadata = parsed as Record<string, unknown>;
    } catch {
      // A kind 0 whose content isn't JSON is a profile nobody can read.
      return null;
    }

    const text = (key: string): string | undefined => {
      const value = metadata[key];
      return typeof value === 'string' && value ? value : undefined;
    };

    return {
      name: text('name'),
      displayName: text('display_name') ?? text('displayName'),
      about: text('about'),
      picture: text('picture'),
      banner: text('banner'),
      nip05: text('nip05'),
      lud16: text('lud16'),
      website: text('website'),
    };
  }

  async getFollows(): Promise<string[]> {
    const event = await this.latest(3);
    return event ? tagValues(event, 'p') : [];
  }

  async getList(type: string): Promise<string[]> {
    const kind = LIST_KINDS[type];
    if (!kind) throw new Error('unsupported list type');

    const event = await this.latest(kind);
    if (!event) return [];

    /*
     * The public half only. NIP-51 lets a list keep entries encrypted in
     * `content`, and decrypting them needs the user's key — which is precisely
     * what this shell does not have and NAP-IDENTITY forbids it to use here.
     */
    return event.tags
      .filter(([tag, value]) => !LIST_METADATA.has(tag) && typeof value === 'string' && value)
      .map(([, value]) => value);
  }

  async getMutes(): Promise<string[]> {
    const event = await this.latest(10000);
    return event ? tagValues(event, 'p') : [];
  }

  /**
   * Blocks, which Nostr has no settled kind for.
   *
   * NAP-IDENTITY draws blocks as harder than mutes, but no NIP defines them, so
   * answering with the mute list would be reporting one thing as another.
   * NAP-IDENTITY allows a shell to answer an unsupported query with an empty
   * result, and that is the honest one here.
   */
  async getBlocked(): Promise<string[]> {
    return [];
  }

  async getZaps(): Promise<NappletZapReceipt[]> {
    if (!this.user) return [];

    const events = await this.pool.query([
      { kinds: [9735], '#p': [this.user], limit: ZAP_LIMIT },
    ]);

    return events
      .sort((a, b) => b.created_at - a.created_at)
      .map((receipt) => {
        const description = receipt.tags.find(([tag]) => tag === 'description')?.[1];

        let request: { pubkey?: unknown; content?: unknown; tags?: unknown } = {};
        try {
          if (description) request = JSON.parse(description) as typeof request;
        } catch {
          // A receipt whose description isn't the zap request tells us less,
          // but the bolt11 and the `e` tag are still on the receipt itself.
        }

        const requestTags = Array.isArray(request.tags) ? (request.tags as string[][]) : [];
        const requested = requestTags.find(([tag]) => tag === 'amount')?.[1];
        const bolt11 = receipt.tags.find(([tag]) => tag === 'bolt11')?.[1] ?? '';

        return {
          eventId: receipt.tags.find(([tag]) => tag === 'e')?.[1] ?? '',
          sender:
            (typeof request.pubkey === 'string' ? request.pubkey : '') ||
            receipt.tags.find(([tag]) => tag === 'P')?.[1] ||
            '',
          amount: Number(requested) || bolt11Millisats(bolt11),
          content: typeof request.content === 'string' ? request.content : undefined,
        };
      });
  }

  /**
   * The badges the user has chosen to display (NIP-58).
   *
   * Two round trips, because kind 30008 names definitions rather than carrying
   * them: the first says which badges are displayed, the second says what they
   * look like and who issued them.
   */
  async getBadges(): Promise<NappletBadge[]> {
    const profile = await this.latest(30008, PROFILE_BADGES);
    if (!profile) return [];

    const wanted: { issuer: string; identifier: string }[] = [];
    for (const [tag, coordinate] of profile.tags) {
      if (tag !== 'a' || typeof coordinate !== 'string') continue;

      const [kind, issuer, identifier] = coordinate.split(':');
      if (kind !== '30009' || !/^[0-9a-f]{64}$/i.test(issuer ?? '') || !identifier) continue;
      wanted.push({ issuer, identifier });
    }
    if (!wanted.length) return [];

    const definitions = await this.pool.query([
      {
        kinds: [30009],
        authors: [...new Set(wanted.map(({ issuer }) => issuer))],
        '#d': [...new Set(wanted.map(({ identifier }) => identifier))],
        limit: wanted.length * 2,
      },
    ]);

    const badges: NappletBadge[] = [];
    for (const { issuer, identifier } of wanted) {
      /*
       * Matched on author as well as identifier. A `d` tag is not a namespace,
       * so a definition fetched by identifier alone could have been published
       * by anyone at all and would attribute their badge to the real issuer.
       */
      const definition = definitions.find(
        (event) =>
          event.pubkey === issuer &&
          event.tags.find(([tag]) => tag === 'd')?.[1] === identifier,
      );
      if (!definition) continue;

      const value = (name: string) =>
        definition.tags.find(([tag]) => tag === name)?.[1] || undefined;

      badges.push({
        id: identifier,
        name: value('name'),
        description: value('description'),
        image: value('image'),
        thumbs: tagValues(definition, 'thumb'),
        awardedBy: issuer,
      });
    }

    return badges;
  }

  /**
   * Runs a query at most once per minute per shape.
   *
   * NAP-IDENTITY allows best-effort freshness, and the alternative is every
   * napplet on the page opening its own subscription for the same kind 0.
   */
  cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && now - hit.at < CACHE_TTL) return hit.value as Promise<T>;

    const value = load().catch((error: unknown) => {
      // A failure must not be remembered for a minute, or one bad moment
      // becomes a minute of it.
      this.cache.delete(key);
      throw error;
    });

    this.cache.set(key, { at: now, value });
    return value;
  }

  /** The newest replaceable event of a kind for the current user, if any. */
  private async latest(kind: number, identifier?: string): Promise<NappletNostrEvent | null> {
    if (!this.user) return null;

    const filter: NappletNostrFilter = { kinds: [kind], authors: [this.user], limit: 1 };
    if (identifier !== undefined) filter['#d'] = [identifier];

    const events = await this.pool.query([filter]);

    return events.reduce<NappletNostrEvent | null>(
      (best, event) => (!best || event.created_at > best.created_at ? event : best),
      null,
    );
  }
}
