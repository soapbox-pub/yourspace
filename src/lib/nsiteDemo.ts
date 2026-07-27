/**
 * Fixture data for the builder demo, which puts together a personal Nostr
 * homepage (an "nsite").
 */

export interface DemoLink {
  label: string;
  url: string;
}

export interface DemoNote {
  content: string;
  timeAgo: string;
  replies: number;
  reposts: number;
  zaps: number;
}

export interface DemoProfile {
  name: string;
  nip05: string;
  npub: string;
  tagline: string;
  about: string;
  avatar: string;
  banner: string;
  lightningAddress: string;
}

export const demoProfile: DemoProfile = {
  name: 'Ada Nakamoto',
  nip05: 'ada@example.com',
  npub: 'npub1demo0000000000000000000000000000000000000000000000000q4dmn8',
  tagline: 'Protocol tinkerer, zap enjoyer, occasional gardener.',
  about:
    'I build small, sharp tools for decentralized networks. Currently exploring what a personal homepage looks like when nobody can take it down.',
  avatar: 'https://api.dicebear.com/9.x/glass/svg?seed=ada',
  banner: 'https://api.dicebear.com/9.x/glass/svg?seed=nostr-banner',
  lightningAddress: 'ada@getalby.com',
};

export const demoLinks: DemoLink[] = [
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'Long-form writing', url: 'https://habla.news' },
  { label: 'Zap me', url: 'https://getalby.com' },
];

export const demoNotes: DemoNote[] = [
  {
    content:
      'Spent the afternoon getting a static site to publish straight to Blossom. Turns out the hard part was never the hosting.',
    timeAgo: '2h',
    replies: 4,
    reposts: 11,
    zaps: 2100,
  },
  {
    content:
      'A homepage you actually own is a strange feeling in 2026. No platform, no takedown, just a pubkey and some HTML.',
    timeAgo: '1d',
    replies: 17,
    reposts: 42,
    zaps: 8300,
  },
  {
    content: 'Reminder that "decentralized" is a property of deployment, not of marketing copy.',
    timeAgo: '3d',
    replies: 9,
    reposts: 63,
    zaps: 15000,
  },
];

/** Formats a sat amount the way most Nostr clients do (2100 -> "2.1k"). */
export function formatSats(sats: number): string {
  if (sats >= 1000) {
    const thousands = sats / 1000;
    // Drop the decimal for whole numbers: 15000 -> "15k", not "15.0k".
    return `${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
  }
  return String(sats);
}
