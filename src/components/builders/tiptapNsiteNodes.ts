import type { ComponentType } from 'react';
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import {
  AboutNodeView,
  HeroNodeView,
  LinksNodeView,
  NotesNodeView,
  ZapNodeView,
  type BlockViewProps,
} from '@/components/builders/TiptapNodeViews';
import { demoLinks, demoProfile } from '@/lib/nsiteDemo';

/** Builds an atom block node backed by a React node view. */
function createBlockNode(
  name: string,
  tag: string,
  attributes: Record<string, { default: unknown }>,
  view: ComponentType<BlockViewProps>,
) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes: () => attributes,

    parseHTML: () => [{ tag: `div[data-block="${tag}"]` }],

    renderHTML: ({ HTMLAttributes }) => {
      // Serialize array/object attrs so the HTML export round-trips.
      const attrs: Record<string, string> = { 'data-block': tag };
      for (const [key, value] of Object.entries(HTMLAttributes)) {
        attrs[`data-${key.toLowerCase()}`] =
          typeof value === 'string' ? value : JSON.stringify(value);
      }
      return ['div', attrs];
    },

    addNodeView: () => ReactNodeViewRenderer(view),
  });
}

export const ProfileHero = createBlockNode(
  'profileHero',
  'profile-hero',
  {
    name: { default: demoProfile.name },
    tagline: { default: demoProfile.tagline },
    nip05: { default: demoProfile.nip05 },
    avatar: { default: demoProfile.avatar },
    banner: { default: demoProfile.banner },
  },
  HeroNodeView,
);

export const AboutSection = createBlockNode(
  'aboutSection',
  'about',
  { heading: { default: 'About me' }, body: { default: demoProfile.about } },
  AboutNodeView,
);

export const LinkList = createBlockNode(
  'linkList',
  'link-list',
  { heading: { default: 'Elsewhere' }, links: { default: demoLinks } },
  LinksNodeView,
);

export const NoteFeed = createBlockNode(
  'noteFeed',
  'note-feed',
  { heading: { default: 'Recent notes' }, count: { default: 3 } },
  NotesNodeView,
);

export const ZapCallout = createBlockNode(
  'zapCallout',
  'zap-callout',
  {
    heading: { default: 'Support my work' },
    lightningAddress: { default: demoProfile.lightningAddress },
  },
  ZapNodeView,
);

export const nsiteNodes = [ProfileHero, AboutSection, LinkList, NoteFeed, ZapCallout];
