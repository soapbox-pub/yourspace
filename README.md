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
- **Browsing.** A showcase of homepages people have published, and a viewer that renders any of them
  at `/<name>` — sandboxed, so a site's scripts can't reach this app.

The Discover feed draws on a curated list of pubkeys in `src/lib/appNsites.ts`. It's a flat array
rather than a follow pack fetched at runtime, because having a homepage and being worth following
are different things — a pack of fifteen people yielded one root nsite between them.

## nsites (NIP-5A)

An nsite is a static website published over Nostr: a manifest event maps paths to file hashes, and
the bytes live on [Blossom](https://github.com/hzrd149/blossom) servers. Any nsite viewer can serve
the result, so a page built here is not tied to this app.

The editor holds a flat list of files rather than a single document, which is what a manifest
describes. Switching pages serializes the canvas back into the file it came from and parses the next
one in.

## Publishing

**Publish** in the editor toolbar deploys what's on the canvas to the signed-in key. Every file goes
to your Blossom servers first, then a single manifest is signed mapping each path to its hash — that
order matters, because a manifest naming blobs that aren't up yet is a broken site, while blobs with
nothing pointing at them are merely unreferenced.

A server is asked whether it already holds a hash before anything is uploaded to it, so republishing
after editing one page moves only that page. Each blob that is missing somewhere costs one signature,
replayed to every server that needs it.

It publishes the **root site** (kind 15128) — the single manifest an npub resolves to. Publishing
again replaces it.

## Status

Importing, editing and publishing all work. Named sites (kind 35128, a `d` tag under one key) can be
imported but not yet published; there is no way to add non-image files to a site in the editor, so
they only arrive by import.

## Development

```bash
npm run dev    # dev server
npm test       # typecheck, lint, unit tests, production build
npm run build  # production build
```

- `/` — the landing page, with a feed of recently published homepages
- `/edit` — the editor
- `/:user` — someone's homepage, addressed by npub, NIP-05 (`alex@gleasonator.com`), or bare
  domain (`soapbox.pub`)

Published sites are rendered inside a frame served from a subdomain of `iframe.diy`, which
proxies every request back to the app over `postMessage` so the files can come from Blossom. The
subdomain is an HMAC of a device-local secret, so each site gets an origin of its own that no
other page can guess — this app's `localStorage` holds nsec, and untrusted scripts must never
share an origin with it.

## Stack

React 19, TailwindCSS 4, Vite, shadcn/ui, [Nostrify](https://nostrify.dev), TanStack Query, and
GrapesJS. Built with [MKStack](https://soapbox.pub/tools/mkstack).
