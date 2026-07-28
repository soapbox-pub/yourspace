# Nostr conventions used by YourSpace

This app defines no new event kinds. It reads and writes kinds from existing
specs, and this file records the two places where it had to make a decision the
spec did not make for it, plus the conventions it writes into published pages.

## Kinds

| Kind | Spec | Used for |
|------|------|----------|
| `15128` | NIP-5A | Root nsite manifest — the homepage an npub resolves to. Published by the editor. |
| `35128` | NIP-5A | Named nsite manifest. Imported, not yet published. |
| `5129` / `15129` / `35129` | NIP-5D | Napplet manifests. Read only; this app does not publish napplets. |
| `10002` | NIP-65 | Relay list. |
| `10063` | BUD-03 | Blossom server list. |
| `0` | NIP-01 | Profile metadata. |

## Napplets (NIP-5D)

The editor can place a **napplet** — a small sandboxed web app published to
Nostr — onto a page. A published page carries only a placeholder plus a runtime
script; the napplet itself is fetched, verified and sandboxed afresh every time
the page is read.

### Page conventions

These two names are this app's own, not part of any spec. Another client that
wanted to render YourSpace pages faithfully would need to honour them.

- `<div data-napplet="naddr1…">` — a placeholder. The attribute holds an
  `naddr` (kinds `15129`/`35129`) or an `nevent` (kind `5129`). The element is
  inert and empty in the stored HTML: no napplet code is ever copied into the
  site.
- `/napplet-runtime.js` — the runtime, shipped as an ordinary file of the site
  and referenced with `<script src="/napplet-runtime.js" defer>`. It is added
  to a page on serialization and to the file list at publish time, and dropped
  again when the last placeholder goes. Its `data-relays` and
  `data-blossom-servers` attributes override the defaults it was built with.

The script tag cannot live in the editor canvas: `toCanvasHtml` strips every
`<script>` before GrapesJS parses a page, because an imported nsite is a
stranger's markup and the canvas is same-origin with this app. So the tag is
stripped on the way in and re-added on the way out — the same bargain that
module already makes with linked stylesheets.

### Divergences from NIP-5D

**The aggregate hash is not verified, because it is not defined.** NIP-5D's
Identity section requires the runtime to recompute the NIP-5A aggregate hash of
the manifest's `path` tags and assert it equals the manifest's
`["x", "<sha256>", "aggregate"]` tag. NIP-5A defines neither an aggregate hash
nor an `x` tag, so there is no algorithm to recompute and nothing a manifest's
`x` tag can be checked against. This app therefore:

- performs every verification step that *is* specified — the manifest's
  signature, and each blob's sha256 against the hash the author signed;
- computes its own content address (sha256 over the canonical
  `path\nsha256` list) to use as `aggregateHash` for storage scoping and
  identity, since those only need a value that is stable and changes whenever
  the bytes do;
- carries the manifest's `x` tag through unparsed and never compares against it,
  because a value computed by a different rule would never match.

If NIP-5A gains an aggregate hash definition, `computeAggregate` in
`src/lib/napplet/runtime/resolve.ts` is the one place to change.

**NIP-5D and the NAP registry disagree on the manifest kind.** NIP-5D specifies
kinds `5129`/`15129`/`35129` and says the distinct kinds are the point — they
keep napplets out of nsite gateway resolution. The napplet/naps README instead
describes a napplet as "a NIP-5A manifest (a Nostr event, kind 35128)". This app
follows NIP-5D.

### NAP capabilities

The runtime injects `window.napplet` with four domains. A napplet declaring
anything else in a `["requires", "<domain>"]` tag is still loaded, told the
truth in `shell.init`, and shown a notice — NIP-5D requires napplets to degrade
gracefully, and refusing to load them outright would be the less useful half of
the "reject or warn" the spec allows.

| Domain | Spec | Notes |
|--------|------|-------|
| `shell` | NAP-SHELL | Complete. |
| `relay` | NAP-RELAY | **Read only.** `subscribe`, `query` and `close` work. |
| `storage` | NAP-STORAGE | Complete, backed by `localStorage`, 512 KB per napplet. |
| `theme` | NAP-THEME | `theme.get` and `theme.changed`. Sourced from the host page's own computed colours, not from a kind 16767 event. |

**Why relay writes are refused.** NAP-RELAY makes publishing the shell's job
precisely so the shell can decide, and this shell has nothing to decide with: it
runs inside a static page that anyone may be reading, with no key of its own and
no claim on the reader's. A signature there would be either forged or coerced
out of a visitor who came to look at a homepage. So `relay.publish` and
`relay.publishEncrypted` return `{ ok: false, error }` — a truthful refusal
rather than a capability quietly missing.

**Consequence of the CSP baseline.** The runtime injects NIP-5D's recommended
conservative policy verbatim, including `connect-src 'none'` and
`img-src data: blob:`. That baseline assumes NAP-RESOURCE is available to
deliver remote bytes to the napplet; this runtime does not implement
NAP-RESOURCE, so a napplet here cannot display remote images. That is a smaller
problem than handing untrusted code a network, and implementing NAP-RESOURCE is
the way to fix it.

### Sandboxing

Napplet frames use `srcdoc` with `sandbox="allow-scripts"` and **no**
`allow-same-origin`, per NIP-5D. This gives each napplet an *opaque* origin: no
`localStorage`, no IndexedDB, no cookies, no service worker, no way to reach the
page around it except through `postMessage`.

This is deliberately different from how nsites are embedded. An nsite runs in an
`iframe.diy` frame on a subdomain of its own, which *requires*
`allow-same-origin` — without it the frame could not register the service worker
that scheme depends on. A per-napplet `iframe.diy` origin would therefore be
strictly *weaker* than what napplets get here, because a real origin has real
storage to isolate, and NIP-5D forbids it outright.

Senders are identified by `MessageEvent.source` — an unforgeable `Window`
reference — never by `event.origin`, which is `"null"` for an opaque origin.
Messages from frames the runtime did not create are dropped without a reply.
