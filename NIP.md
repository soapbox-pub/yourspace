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

The script tag is derived rather than authored: `withNappletRuntime` strips any
copy of it and re-adds one only if the page still holds a placeholder. `<script>`
survives the canvas round trip now that `nsite/foreign.ts` carries it, so a tag
left to persist on its own would outlive the last napplet and point at a file no
longer published. Recomputing it on every serialization is what keeps the page
self-correcting.

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

The runtime injects `window.napplet` with seven domains — every NAP merged into
the [naps registry](https://github.com/napplet/naps), plus the two drafts
(`relay`, `storage`) it already served. A napplet declaring anything else in a
`["requires", "<domain>"]` tag is still loaded, told the truth in `shell.init`,
and shown a notice — NIP-5D requires napplets to degrade gracefully, and
refusing to load them outright would be the less useful half of the "reject or
warn" the spec allows.

| Domain | Spec | Notes |
|--------|------|-------|
| `shell` | NAP-SHELL | Complete. Capability calls are refused until the handshake. |
| `relay` | NAP-RELAY | **Read only.** `subscribe`, `query` and `close` work. |
| `storage` | NAP-STORAGE | Complete, backed by `localStorage`, 512 KB per napplet. |
| `theme` | NAP-THEME | `theme.get` and `theme.changed`. Sourced from the host page's own computed colours, not from a kind 16767 event. |
| `inc` | NAP-INC | Complete: topics and channels, scoped to one page. |
| `intent` | NAP-INTENT | Complete, with the default handler decided by document order. |
| `identity` | NAP-IDENTITY | Complete except `getBlocked`, and answers for nobody on a published page. |

**Why relay writes are refused.** NAP-RELAY makes publishing the shell's job
precisely so the shell can decide, and this shell has nothing to decide with: it
runs inside a static page that anyone may be reading, with no key of its own and
no claim on the reader's. A signature there would be either forged or coerced
out of a visitor who came to look at a homepage. So `relay.publish` and
`relay.publishEncrypted` return `{ ok: false, error }` — a truthful refusal
rather than a capability quietly missing.

**The page is the shell.** NAP-INC and NAP-INTENT describe a runtime that
composes napplets, and here that runtime is one HTML page: the switchboard is
per-document, so two napplets can reach each other exactly when they were placed
on the same page. A napplet published as a *root* napplet (kind 15129) has no
`d` tag, so it can emit, subscribe and invoke, but cannot be named as a channel
target or resolved as an intent handler — NAP-INC and NAP-INTENT both address
peers by `dTag`, and a name every root napplet shares is no name at all.

**Default handlers, without a user to ask.** NAP-INTENT requires a
user-overridable default handler per archetype and an "open with…" chooser. A
published page has neither a settings screen nor chrome of its own to draw a
chooser in. The default is therefore the first candidate in document order —
which is the page author's arrangement, the closest thing a static page has to a
user expressing a preference — and `handler: "choose"` resolves only when there
is exactly one candidate, otherwise failing with `no chooser available` rather
than letting the shell pick on the user's behalf.

**NAP-IDENTITY has no signer to report.** On a published page `getPublicKey()`
returns `""`, which the spec defines as "no signer connected". The reader's
NIP-07 extension is deliberately not consulted: `getPublicKey()` puts a
permission prompt in front of someone who came to look at a homepage. In the
editor the capability is live, reporting the signed-in user. `getBlocked()`
always returns `[]` — no NIP defines a block list distinct from a mute list, and
answering with mutes would report one thing as another.

### Sandboxing — a departure from NIP-5D

NIP-5D requires `srcdoc` with `sandbox="allow-scripts"` and **no**
`allow-same-origin`, giving each napplet an opaque origin. **This app does not
do that.** Each napplet instead runs on a private origin of its own behind
`iframe.diy`, exactly as a published nsite does:

- the subdomain is an HMAC of a device-local secret over the napplet's
  `(dTag, aggregateHash)` identity, so it is stable for one browser and
  unguessable from outside;
- every file the frame loads is served by this app over `postMessage` from the
  verified manifest bytes — nothing is fetched from the network unchecked;
- `allow-same-origin` is present, which is required for the Service Worker the
  scheme depends on. It grants same-origin with the *napplet's own subdomain*,
  never with this app, so the `nsec` in this app's `localStorage` stays out of
  reach.

**What this costs.** An opaque origin is the stronger boundary: it has no
storage, no Service Worker and no network at all. A real per-napplet origin has
real `localStorage`, so NAP-STORAGE's `(dTag, aggregateHash)` scoping becomes
advisory — a napplet can persist data outside the namespace the shell assigns
it. Isolation *between* napplets, and between napplets and this app, still holds,
because each origin is distinct and unguessable.

**What this buys.** A working web platform. Under NIP-5D's recommended CSP
(`connect-src 'none'`, `img-src data: blob:`) a napplet cannot load so much as an
avatar until NAP-RESOURCE exists to hand it bytes. Since this runtime does not
implement NAP-RESOURCE, the conservative baseline would leave most real napplets
visibly broken. No CSP is injected now; the origin is the boundary, which is the
same bargain `NsiteFrame` already makes.

Senders are identified by `MessageEvent.origin` matched against the napplet's
derived origin, plus `event.source` matched against the frame's `contentWindow`.
Both hold because the origin is unguessable. (NIP-5D specifies `event.source`
alone, since an opaque origin has no origin string to compare.)

### Wire format — a second departure

NAP messages do **not** travel in NIP-5D's raw `{ "type": "domain.action", … }`
envelope. `iframe.diy` runs the napplet in an inner frame and relays only
JSON-RPC 2.0 messages between it and the shell — anything whose `jsonrpc` is not
`"2.0"` is dropped, and upward it relays only requests carrying an `id`. A bare
`shell.ready` notification would never arrive.

The injected shim therefore wraps every NAP message:

```jsonc
// napplet -> shell: always a request, even for fire-and-forget messages
{ "jsonrpc": "2.0", "id": "nap-1", "method": "napplet",
  "params": { "type": "relay.query", "id": "a1", "filters": [...] } }

// shell -> napplet: a notification; NAP results correlate by their own inner id
{ "jsonrpc": "2.0", "method": "napplet",
  "params": { "type": "relay.query.result", "id": "a1", "events": [...] } }
```

`ready`, `init` and `fetch` are reserved by `iframe.diy` and cannot be used. The
JSON-RPC reply to a napplet request is a bare acknowledgement whose only job is
to release the relay's routing slot.

**Consequence:** napplets that use the injected `window.napplet` namespace work
unchanged, because the shim hides all of this. A napplet that talks raw
`postMessage` per NIP-5D does **not** work here.
