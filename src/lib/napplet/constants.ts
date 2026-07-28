/**
 * The two names shared between the editor, the runtime and the published page.
 *
 * Kept apart from `runtime/boot.ts` because that module starts itself as soon
 * as it is imported — it is the entry point of the standalone bundle, not a
 * library — and the editor needs these constants without booting anything.
 */

/** The attribute the editor writes on a napplet placeholder, holding an `naddr`. */
export const NAPPLET_ATTR = 'data-napplet';

/** Where the runtime ships inside a published site. */
export const NAPPLET_RUNTIME_PATH = '/napplet-runtime.js';
