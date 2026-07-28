/**
 * The shapes the napplet runtime exchanges.
 *
 * Declared locally rather than imported from Nostrify: this module is bundled
 * into a standalone script that ships inside published pages, so it may only
 * depend on things small enough to carry there.
 */

export interface NappletNostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export type NappletNostrFilter = Record<string, unknown>;

/** A napplet's identity: computed from its own bytes, never accepted from it. */
export interface NappletIdentity {
  /** The manifest `d` tag, or the event id for a snapshot. */
  dTag: string;
  /**
   * The napplet's content address.
   *
   * NIP-5D calls for the NIP-5A aggregate hash of the `path` tags. NIP-5A
   * defines no such hash, so this is computed here as the sha256 of the
   * manifest's verified `path` list — a stable content address over exactly
   * the bytes that run, which is what the identity is used for (storage
   * scoping, message routing). See `NIP.md`.
   */
  aggregateHash: string;
}

/** The theme a shell hands to napplets (NAP-THEME). */
export interface NappletTheme {
  colors: { background: string; text: string; primary: string };
  fonts?: {
    body?: { name: string; url: string };
    title?: { name: string; url: string };
  };
  background?: { url: string; mode: string; mime: string };
  title?: string;
}

/** Everything the runtime needs to resolve and host napplets. */
export interface NappletRuntimeConfig {
  /** Relays to resolve manifests from and to serve NAP-RELAY reads with. */
  relays: string[];
  /** Blossom servers tried after the manifest's own `server` hints. */
  blossomServers: string[];
  /** The theme handed to napplets, and pushed on change. */
  theme?: NappletTheme;
}

/** What a napplet mount reports back, for the host to render around it. */
export type NappletStatus =
  | { state: 'loading' }
  | {
      state: 'ready';
      title: string;
      identity: NappletIdentity;
      /**
       * Domains the manifest's `requires` tags asked for that this runtime does
       * not serve. The napplet is loaded anyway and told the truth in
       * `shell.init`, since NIP-5D requires it to degrade gracefully — but the
       * host can say so rather than leaving a half-working napplet unexplained.
       */
      missing?: string[];
    }
  | { state: 'error'; message: string };
