/**
 * Whose homepages fill the Discover tab.
 *
 * A flat list rather than a follow pack fetched at runtime. Packs are lists of
 * *people*, and having a page is a different thing from being worth following
 * — of the fifteen people in Team Soapbox, one has published a root nsite, so
 * a pack-backed feed showed a single card. This list is curated on the
 * opposite axis: everyone here had a root site that loaded and looked like
 * somebody had made it.
 *
 * Team Soapbox is folded in whole, so its members appear here as they publish.
 *
 * Surveyed against relay.ditto.pub, relay.primal.net, relay.damus.io and
 * relay.nostr.band in July 2026. Sites come and go; a pubkey that stops
 * resolving costs nothing but a gap.
 */
export const DISCOVER_PUBKEYS: string[] = [
  // — Homepages and small sites, verified to load —
  /** hzrd149 — hzrd149.com */
  '266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5',
  /** noStrudel */
  '713978c3094081b34fcf2f5491733b0c22728cd3b7a6946519d40f5f08598af8',
  /** RogueHashrate — roguehashrate.com */
  'bc28aad5b167f31dd37c66d8c95d400c6411d83275ed12c504f60965d1f9eec6',
  /** LittleBit — littlebitstudios.com */
  '08fa7121cab8f165df8f364d0a5bc660a9b5e8704d9e5c9728cde72f00fb084b',
  /** Wake — a funeral for Facebook */
  '1fccf49a2448753b17f997f5b509a88c6273dcd0834af6ba91a38c7b04d2a5a6',
  /** Ilex Tools */
  '39d69050c9c35ae42c13d1d2f710d6fb52b03793bbc35a7fdc2eff932ec07c71',
  /** Archon-Web */
  '5ea4648045bb1ff222655ddd36e6dceddc43590c26090c486bef38ef450da5bd',
  /** stl1988 — nip-05.com */
  'a8d1560d6a647d501699167246f237b36fb123f89168fda11dc743533fec7a08',
  /** Nostrord — nostrord.com */
  'b2cdcb37d32533145c00c4f43d5e1e1deb7c67bceea7ef63f526ca4cab891633',
  /** ScopeLatch */
  'c6e95be046abeb69ca02b1258221f26178d65d57f66d82cdd6e5a88a19543a71',
  /** Nostr Boutique — isolabellart.it.com */
  'f4db5270bd991b17bea1e6d035f45dee392919c29474bbac10342d223c74e0d0',
  /** Iggy — sunami.app */
  '48e976057bf2cf1333020355b5d243f8dd813f193051d1cb04413894f46acc43',
  /** Goblinbox — erybody.com */
  '1c197b12ca9ce0415b70e7405b9770f0ec6bccfb59b32b63aafd42cb242e1642',

  // — Team Soapbox —
  '781a1527055f74c1f70230f10384609b34548f8ab6a0a6caa74025827f9fdae5',
  '0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd',
  '932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d',
  '3f770d65d3a764a9c5cb503ae123e62ec7598ad035d836e2a810f3877a745b24',
  '86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47',
  '8f53782e8693e88afb710b6d68182ad973973c8822caa237bb60288b125673ca',
  'be7358c4fe50148cccafc02ea205d80145e253889aa3958daafa8637047c840e',
  'ce97367c75d7d91fb9bc3bc6ff5bb3bdb52c18941bfce2f368616dcbf0adfd2f',
  '0574536d3ef4d65faf95b42393610b8475d22f4c294649d46c50d5d36f75267c',
  '2093baa8621c5b255e8f4fc2c6fdfc10d8a5598a25517664efaba860735f1030',
  'a008def15796fba9a0d6fab04e8fd57089285d9fd505da5a83fe8aad57a3564d',
  'd133ecb09963a7f7a705bf250324a226fcacbf51eba6f0b1b97df8c09338a4c8',
  '2fb42317a9835e0fabb405aebbea6c61b6b2d384be7febe8125840b3516685fc',
  '47259076c85f9240e852420d7213c95e95102f1de929fb60f33a2c32570c98c4',
  'c839bc85846f24fc6b777548fe654672377f4cc2a04cab19cddec75b2f8b4dbd',
];
