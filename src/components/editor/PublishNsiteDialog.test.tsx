import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { AppProvider } from '@/components/AppProvider';
import type { AppConfig } from '@/contexts/AppContext';
import { textFile } from '@/lib/nsite/files';
import { uploadSite } from '@/lib/nsite/publish';
import { PublishNsiteDialog } from './PublishNsiteDialog';

const PUBKEY = 'ab'.repeat(32);

vi.mock('@/lib/nsite/publish', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nsite/publish')>()),
  uploadSite: vi.fn(async () => ({
    entries: [{ path: '/index.html', sha256: 'a'.repeat(64) }],
    servers: ['https://blossom.test'],
    failed: [],
  })),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: PUBKEY, signer: {} } }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: { metadata: { nip05: 'alex@gleasonator.com' } } }),
}));

vi.mock('@/hooks/useNip05', () => ({
  useNip05Verified: () => true,
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: async (template: { kind: number; content: string; tags: string[][] }) => ({
      ...template,
      id: 'f'.repeat(64),
      pubkey: PUBKEY,
      sig: '0'.repeat(128),
      created_at: 0,
    }),
  }),
}));

const config = {
  theme: 'light',
  relayMetadata: { relays: [], updatedAt: 0 },
  blossomServerMetadata: { servers: ['https://blossom.test/'], updatedAt: 0 },
  useAppBlossomServers: true,
  sandboxDomain: 'iframe.diy',
  discoverPubkeys: [],
  nsiteGatewayDomain: 'shakespeare.to',
  screenshotUrl: 'https://example.test/shot/{url}?w=600&h=400',
} satisfies AppConfig;

/**
 * The providers this dialog actually reads, rather than `TestApp` — that wraps
 * everything in `NostrLoginProvider`, which renders no children under jsdom and
 * so would make every assertion here pass against an empty document.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppProvider storageKey="publish-test" defaultConfig={config}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </AppProvider>
  );
}

function renderDialog() {
  const files = [textFile('/index.html', '<h1>hello</h1>')];
  render(
    <Wrapper>
      <PublishNsiteDialog getFiles={() => files} />
    </Wrapper>,
  );
}

/** The toolbar button that opens the dialog, as opposed to the one inside it. */
const trigger = () => screen.getAllByRole('button', { name: /publish/i })[0];

describe('PublishNsiteDialog', () => {
  it('offers the form again after a site has been published', async () => {
    renderDialog();

    fireEvent.click(trigger());
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

    await screen.findByText('Your site is live');

    // The site's address on this app, not on a public gateway.
    expect(screen.getByRole('link', { name: /View your site/ })).toHaveAttribute(
      'href',
      '/alex@gleasonator.com',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(trigger());

    const reopened = await screen.findByRole('dialog');
    expect(within(reopened).queryByText('Your site is live')).not.toBeInTheDocument();

    const again = within(reopened).getByRole('button', { name: 'Publish' });
    expect(again).toBeEnabled();

    fireEvent.click(again);
    await screen.findByText('Your site is live');
    expect(vi.mocked(uploadSite)).toHaveBeenCalledTimes(2);
  });
});
