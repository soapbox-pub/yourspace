/**
 * Ready-made page backgrounds, offered as one-click tiles in the inspector.
 *
 * The images are lifted from Ditto theme events (kind 36767) published on
 * `wss://relay.ditto.pub`, where people have already done the work of picking a
 * backdrop and a colour that sits behind it. Each entry keeps that pairing: the
 * `bg` tag's URL and mode, and the theme's `background` colour.
 *
 * Copied into the source rather than queried live, for three reasons. The list
 * is unmoderated and a picker is the wrong place to discover that; addressable
 * events are replaceable, so a theme's author could swap the image under
 * someone's published page; and a grid that has to wait for a relay before it
 * can draw anything is a worse first impression than one that is simply there.
 *
 * The URLs are hashes on Blossom servers, which is what makes copying them
 * safe: the bytes at a hash address cannot change, so a page that points at one
 * shows the same thing tomorrow. They are hotlinked rather than pulled into the
 * site — the same thing the themes themselves do — so choosing one costs the
 * published page nothing but a reference.
 *
 * Check the bytes before adding one. Neither the extension nor the served
 * `Content-Type` is evidence of anything: one of these was uploaded as `.webp`,
 * is served as `image/webp`, and is HEIC, which every browser but Safari
 * refuses to decode. `file --mime-type` on what the URL actually returns is.
 */
export interface BackgroundPreset {
  id: string;
  /** Named for what it looks like rather than what the theme was called. */
  label: string;
  url: string;
  /** Painted under the image: it shows through transparency and around edges. */
  color: string;
  /** Repeated at its natural size, rather than scaled to cover the page. */
  tile?: boolean;
}

export const backgroundPresets: BackgroundPreset[] = [
  {
    id: 'gleasonator',
    label: 'Gleasonator',
    url: 'https://blossom.ditto.pub/cbf10e34eb17ece62b8fc15cbd934e7f708b2444598bd80dde6a5f0435ed3ba5.jpeg',
    color: '#0c170e',
  },
  {
    id: 'sunflowers',
    label: 'Sunflowers',
    url: 'https://blossom.ditto.pub/3d89b03a1235d4f092421ecd03ecb80aeed34c36a2fe3af20478556743bb33ec.jpeg',
    color: '#fdf6e3',
  },
  {
    id: 'graffiti',
    label: 'Graffiti',
    url: 'https://blossom.ditto.pub/c77e78cf3faa7c057b93a38ba946eacbb361a75c6707c0b5bb739f89b12157dc.jpeg',
    color: '#8127db',
  },
  {
    id: 'farm',
    label: 'Farm',
    url: 'https://blossom.ditto.pub/5fae4bf01d9886b734b441f53645425d0ad0999c339d53c2dd0ff7aa8f5ea8e1.jpeg',
    color: '#03425e',
    tile: true,
  },
  {
    id: 'fern',
    label: 'Fern',
    url: 'https://blossom.ditto.pub/afd6f2b4c2dc43f5349c964760be8968b47c8c9f9e189e90d8e3db78a2d9fe96.jpeg',
    color: '#13201b',
  },
  {
    id: 'cosmos',
    label: 'Cosmos',
    url: 'https://blossom.ditto.pub/9f983183560db5e9865bd95f9a165012689f513fc93b0b6f74311784bc931883.jpeg',
    color: '#0d0619',
  },
  {
    id: 'sunset',
    label: 'Sunset city',
    url: 'https://blossom.ditto.pub/197b6e1708d29a02c9ab0c4bb1a06545e5d57b54c2ce465e0ff067e5a10b14ff.png',
    color: '#14161f',
  },
  {
    id: 'bee',
    label: 'Bee',
    url: 'https://blossom.ditto.pub/f89dbbd3a15db910eb2e59e2b61ab43b478d050b8435099430fbf2a3eea7610a.avif',
    color: '#cece33',
  },
  {
    id: 'purple-wave',
    label: 'Purple wave',
    url: 'https://blossom.ditto.pub/e696551da5d12e6b02531c113e0ed3a9419fb94db61982a7616781960a30c9ea.jpeg',
    color: '#000000',
  },
  {
    id: 'desert',
    label: 'Desert',
    url: 'https://blossom.ditto.pub/390fd0daef46918e714974377f82f7ab338c44c5bb5286b71ad54047668f12bf.webp',
    color: '#000000',
  },
  {
    id: 'mosaic-cat',
    label: 'Mosaic cat',
    url: 'https://blossom.dreamith.to/18cf594eb088cddfc2066f0e32e2a5848186c06a10361a9807f27077aaa03c7a.jpeg',
    color: '#f6efef',
  },
  {
    id: 'sakura',
    label: 'Sakura',
    url: 'https://blossom.dreamith.to/b345f7f4d5509380e8bd8c31cec7d63e2b35bc13efedaf9f61afaae6c597e120.jpeg',
    color: '#f6f6f6',
  },
];

export interface ColorPreset {
  label: string;
  value: string;
}

/**
 * Flat colours for a page that wants none of the above.
 *
 * Ordered light to dark so the row reads as a ramp rather than a jumble, and
 * kept to twelve so the whole picker still fits on one screen.
 */
export const colorPresets: ColorPreset[] = [
  { label: 'Snow', value: '#ffffff' },
  { label: 'Cream', value: '#fff8e7' },
  { label: 'Blush', value: '#ffd9e8' },
  { label: 'Peach', value: '#ffd6ba' },
  { label: 'Lemon', value: '#fff3b0' },
  { label: 'Mint', value: '#c7f0d8' },
  { label: 'Sky', value: '#cbe7ff' },
  { label: 'Lilac', value: '#ded1ff' },
  { label: 'Bubblegum', value: '#ff4d9d' },
  { label: 'Grass', value: '#2f9e44' },
  { label: 'Ocean', value: '#1c5db8' },
  { label: 'Midnight', value: '#0b1020' },
];
