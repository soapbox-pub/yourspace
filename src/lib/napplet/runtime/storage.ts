import type { NappletIdentity } from './types';

/**
 * NAP-STORAGE, backed by whatever `localStorage` the page has.
 *
 * A napplet has an opaque origin and therefore no storage of its own, which is
 * the point — everything it keeps, it keeps here, under a key the host chooses.
 * Scoping is by `(dTag, aggregateHash)`, so two napplets cannot see each
 * other's data and *two versions of the same napplet* cannot either: a napplet
 * that changes its bytes changes its aggregate, and starts with an empty
 * namespace rather than inheriting state written by code that no longer exists.
 */

/** NAP-STORAGE's recommended default, in UTF-8 bytes. */
const QUOTA = 512 * 1024;

const PREFIX = 'napplet:';

export class NappletStorage {
  /**
   * `instanceId` distinguishes two copies of the same napplet on one page. It
   * must be unique between instances and stable across reloads; the caller
   * derives it from the napplet's position in the document, which is both.
   */
  constructor(
    private readonly identity: NappletIdentity,
    private readonly instanceId: string,
  ) {}

  private namespace(scope: string | undefined): string {
    const suffix = scope === 'instance' ? `i:${this.instanceId}` : 'shared';
    return `${PREFIX}${this.identity.dTag}:${this.identity.aggregateHash}:${suffix}:`;
  }

  private store(): Storage | null {
    try {
      // Reading `localStorage` throws outright where storage is denied, so the
      // access itself is the feature test.
      return window.localStorage;
    } catch {
      return null;
    }
  }

  getItem(key: string, scope?: string): string | null {
    return this.store()?.getItem(this.namespace(scope) + key) ?? null;
  }

  keys(scope?: string): string[] {
    const store = this.store();
    if (!store) return [];

    const prefix = this.namespace(scope);
    const found: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(prefix)) found.push(key.slice(prefix.length));
    }
    return found;
  }

  /** Bytes currently held across both scopes of this napplet. */
  private used(): number {
    const store = this.store();
    if (!store) return 0;

    const prefix = `${PREFIX}${this.identity.dTag}:${this.identity.aggregateHash}:`;
    const encoder = new TextEncoder();
    let total = 0;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(prefix)) continue;
      total += encoder.encode(key).length + encoder.encode(store.getItem(key) ?? '').length;
    }
    return total;
  }

  /** Throws on quota, which the caller turns into the result's `error` field. */
  setItem(key: string, value: string, scope?: string): void {
    const store = this.store();
    if (!store) throw new Error('This page has no storage available.');

    const full = this.namespace(scope) + key;
    const encoder = new TextEncoder();
    const existing = store.getItem(full);

    // A new key costs its name as well as its value; an existing one costs only
    // the difference, and may be negative.
    const delta =
      encoder.encode(value).length +
      (existing === null
        ? encoder.encode(full).length
        : -encoder.encode(existing).length);

    if (this.used() + delta > QUOTA) throw new Error('quota exceeded');

    try {
      store.setItem(full, value);
    } catch {
      // The host page's own budget, not the napplet's.
      throw new Error('quota exceeded');
    }
  }

  removeItem(key: string, scope?: string): void {
    this.store()?.removeItem(this.namespace(scope) + key);
  }

  /** Drops everything this napplet instance wrote, for teardown. */
  clearInstance(): void {
    const store = this.store();
    if (!store) return;

    const prefix = this.namespace('instance');
    for (const key of this.keys('instance')) store.removeItem(prefix + key);
  }
}
