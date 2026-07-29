import { createContext } from "react";

export type Theme = "dark" | "light" | "system";

export interface RelayMetadata {
  /** List of relays with read/write permissions */
  relays: { url: string; read: boolean; write: boolean }[];
  /** Unix timestamp of when the relay list was last updated */
  updatedAt: number;
}

/** Blossom server list metadata (BUD-03 / kind 10063), mirroring RelayMetadata for parity. */
export interface BlossomServerMetadata {
  /** Ordered list of Blossom server URLs (most trusted/reliable first per BUD-03). */
  servers: string[];
  /** Unix timestamp of when the server list was last updated (from kind 10063 created_at). */
  updatedAt: number;
}

/** A GifCities animation the user has placed on a page, and how often. */
export interface GifUse {
  /** Base32 digest naming the GIF on the archive's blob host. */
  checksum: string;
  /** Words describing it, used as the alt text when it is placed. */
  text: string;
  /** Intrinsic size, or 0 when the archive didn't record it. */
  width: number;
  height: number;
  /** How many times it has been placed. */
  uses: number;
}

export interface AppConfig {
  /** Current theme */
  theme: Theme;
  /** NIP-65 relay list metadata */
  relayMetadata: RelayMetadata;
  /** User's kind 10063 Blossom server list. */
  blossomServerMetadata: BlossomServerMetadata;
  /**
   * When true, the app's default Blossom servers are merged with the user's
   * servers (app servers first, deduped). When false, only the user's servers
   * are used.
   */
  useAppBlossomServers: boolean;
  /**
   * The domain sandboxed nsites are framed from. Each site gets its own
   * subdomain of it, which is what keeps sites isolated from this app and from
   * each other, so it must never be a domain this app is served from.
   */
  sandboxDomain: string;
  /** Whose homepages fill the Discover feed. */
  discoverPubkeys: string[];
  /**
   * Public nsite gateway, used to give a site an ordinary https URL. Only for
   * link previews and "open in a new tab" — the app renders sites itself.
   */
  nsiteGatewayDomain: string;
  /**
   * RFC 6570 template for a page screenshot service, used to thumbnail sites.
   * `{url}` is the target page.
   *
   * It must ask for the size `useScreenshot` expects, which is how that hook
   * tells a finished screenshot from the placeholder served while one renders.
   */
  screenshotUrl: string;
  /**
   * GIFs the user has placed, most-used first, so the editor can offer them
   * back without a search.
   *
   * Only the digest is kept. The URL is rebuilt from it, which keeps an edited
   * config from putting anything of its own choosing into an `img` on the
   * canvas — a same-origin frame, where a `src` is worth attacking.
   */
  frequentGifs: GifUse[];
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: Partial<AppConfig>) => Partial<AppConfig>) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
