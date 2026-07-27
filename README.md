# YourSpace

**Where nostalgia meets innovation.**

Remember when your homepage was something you made? YourSpace brings that back. Lay a page out
block by block, style it however you like, and publish it to Nostr as an **nsite** — a real website
addressed by your own key, that no platform can suspend, rank, or wrap in ads.

## What it does

- **Visual editing.** A live page you edit directly, built on [GrapesJS](https://grapesjs.com) with
  every stock panel replaced by React. Select an element and its settings are already there.
- **Blocks, not markup.** Profile headers, link lists, note feeds, galleries and zap buttons drop
  straight onto the page. No HTML knowledge required.
- **Real files out.** What you build is ordinary HTML and CSS. Read it back at any time, or import a
  published nsite and keep editing it.
- **Yours to keep.** The page belongs to a keypair, not an account. Nothing here is a lock-in.

## nsites (NIP-5A)

An nsite is a static website published over Nostr: a manifest event maps paths to file hashes, and
the bytes live on [Blossom](https://github.com/hzrd149/blossom) servers. Any nsite viewer can serve
the result, so a page built here is not tied to this app.

The editor holds a flat list of files rather than a single document, which is what a manifest
describes. Switching pages serializes the canvas back into the file it came from and parses the next
one in.

## Development

```bash
npm run dev    # dev server
npm test       # typecheck, lint, unit tests, production build
npm run build  # production build
```

- `/` — the landing page
- `/edit` — the editor
- `/:nip19` — NIP-19 identifiers (`npub1`, `note1`, `naddr1`, …)

## Stack

React 19, TailwindCSS 4, Vite, shadcn/ui, [Nostrify](https://nostrify.dev), TanStack Query, and
GrapesJS. Built with [MKStack](https://soapbox.pub/tools/mkstack).
