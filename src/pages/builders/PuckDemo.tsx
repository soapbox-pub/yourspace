import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Puck, type Config, type Data } from '@puckeditor/core';

// The default puck.css pulls Inter from rsms.me, which the app's CSP blocks.
// This variant omits external requests; Inter is already bundled via fontsource.
import '@puckeditor/core/no-external.css';

import { BuilderShell } from '@/components/builders/BuilderShell';
import {
  AboutBlock,
  FooterBlock,
  HeroBlock,
  LinksBlock,
  NotesBlock,
  ZapBlock,
} from '@/components/builders/NsiteBlocks';
import { OutputPanel } from '@/components/builders/OutputPanel';
import { demoLinks, demoProfile } from '@/lib/nsiteDemo';

/** Prop shape for every draggable component, so the config stays type-safe. */
interface NsiteComponents {
  Hero: { name: string; tagline: string; nip05: string; avatar: string; banner: string };
  About: { heading: string; body: string };
  Links: { heading: string; links: { label: string; url: string }[] };
  Notes: { heading: string; count: number };
  Zap: { heading: string; lightningAddress: string };
  Footer: { npub: string };
}

const config: Config<NsiteComponents> = {
  categories: {
    profile: { title: 'Profile', components: ['Hero', 'About', 'Footer'] },
    content: { title: 'Content', components: ['Links', 'Notes'] },
    monetization: { title: 'Monetization', components: ['Zap'] },
  },
  root: {
    fields: {
      title: { type: 'text', label: 'Page title' },
      description: { type: 'textarea', label: 'Meta description' },
    },
    defaultProps: {
      title: `${demoProfile.name} — homepage`,
      description: demoProfile.tagline,
    },
    render: ({ children }) => (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">{children}</div>
    ),
  },
  components: {
    Hero: {
      label: 'Profile hero',
      fields: {
        name: { type: 'text', label: 'Display name' },
        tagline: { type: 'textarea', label: 'Tagline' },
        nip05: { type: 'text', label: 'NIP-05 identifier' },
        avatar: { type: 'text', label: 'Avatar URL' },
        banner: { type: 'text', label: 'Banner URL' },
      },
      defaultProps: {
        name: demoProfile.name,
        tagline: demoProfile.tagline,
        nip05: demoProfile.nip05,
        avatar: demoProfile.avatar,
        banner: demoProfile.banner,
      },
      render: (props) => <HeroBlock {...props} />,
    },
    About: {
      label: 'About',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        body: { type: 'textarea', label: 'Body' },
      },
      defaultProps: { heading: 'About me', body: demoProfile.about },
      render: (props) => <AboutBlock {...props} />,
    },
    Links: {
      label: 'Link list',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        links: {
          type: 'array',
          label: 'Links',
          arrayFields: {
            label: { type: 'text', label: 'Label' },
            url: { type: 'text', label: 'URL' },
          },
          defaultItemProps: { label: 'New link', url: 'https://' },
          getItemSummary: (item) => item.label || 'Link',
        },
      },
      defaultProps: { heading: 'Elsewhere', links: [...demoLinks] },
      render: (props) => <LinksBlock {...props} />,
    },
    Notes: {
      label: 'Recent notes',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        count: {
          type: 'select',
          label: 'Notes to show',
          options: [
            { label: '1 note', value: 1 },
            { label: '2 notes', value: 2 },
            { label: '3 notes', value: 3 },
          ],
        },
      },
      defaultProps: { heading: 'Recent notes', count: 3 },
      render: (props) => <NotesBlock {...props} />,
    },
    Zap: {
      label: 'Zap callout',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        lightningAddress: { type: 'text', label: 'Lightning address' },
      },
      defaultProps: {
        heading: 'Support my work',
        lightningAddress: demoProfile.lightningAddress,
      },
      render: (props) => <ZapBlock {...props} />,
    },
    Footer: {
      label: 'Key footer',
      fields: { npub: { type: 'text', label: 'npub' } },
      defaultProps: { npub: demoProfile.npub },
      render: (props) => <FooterBlock {...props} />,
    },
  },
};

const initialData: Data<NsiteComponents> = {
  root: {},
  content: [
    {
      type: 'Hero',
      props: {
        id: 'hero-1',
        name: demoProfile.name,
        tagline: demoProfile.tagline,
        nip05: demoProfile.nip05,
        avatar: demoProfile.avatar,
        banner: demoProfile.banner,
      },
    },
    {
      type: 'About',
      props: { id: 'about-1', heading: 'About me', body: demoProfile.about },
    },
    {
      type: 'Links',
      props: { id: 'links-1', heading: 'Elsewhere', links: [...demoLinks] },
    },
    {
      type: 'Notes',
      props: { id: 'notes-1', heading: 'Recent notes', count: 3 },
    },
    {
      type: 'Zap',
      props: {
        id: 'zap-1',
        heading: 'Support my work',
        lightningAddress: demoProfile.lightningAddress,
      },
    },
    {
      type: 'Footer',
      props: { id: 'footer-1', npub: demoProfile.npub },
    },
  ],
};

export function PuckDemo() {
  useSeoMeta({
    title: 'Puck — nsite builder demo',
    description: 'Evaluating Puck as a WYSIWYG editor for building Nostr homepages.',
  });

  const [data, setData] = useState<Data<NsiteComponents>>(initialData);

  return (
    <BuilderShell slug="puck" docsUrl="https://puckeditor.com/docs">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <Puck
            config={config}
            data={data}
            onChange={setData}
            height="100%"
            headerTitle="Ada's homepage"
            headerPath="/index.html"
            // Puck's default viewports assume a wide desktop site, which makes
            // it auto-zoom the canvas to ~58%. These preview the page 1:1.
            viewports={[
              { width: '100%', label: 'Fit' },
              { width: 768, label: 'Page' },
              { width: 375, label: 'Mobile' },
            ]}
          />
        </div>

        <OutputPanel
          title="Puck output"
          tabs={[
            {
              id: 'json',
              label: 'JSON',
              language: 'json',
              description:
                "JSON is the only thing Puck emits — there is no HTML export. Turning this into an nsite means running the data through Puck's <Render> component and serializing the result to static HTML yourself.",
              content: JSON.stringify(data, null, 2),
            },
          ]}
        />
      </div>
    </BuilderShell>
  );
}

export default PuckDemo;
