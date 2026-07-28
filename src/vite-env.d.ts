/// <reference types="vite/client" />

/**
 * The napplet runtime, bundled to a self-contained script.
 *
 * Supplied by the `napplet-runtime` Vite plugin. It is a string rather than a
 * module because it is not code this app runs — it is code this app writes into
 * a published site's files, to run later inside somebody else's page.
 */
declare module 'virtual:napplet-runtime' {
  const source: string;
  export default source;
}
