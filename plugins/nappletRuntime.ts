import path from 'node:path';

import { build, type Plugin } from 'vite';

/**
 * Bundles the napplet runtime and hands it to the app as a string.
 *
 * The runtime is the odd one out in this codebase: it is the only code that
 * leaves the app entirely. A published nsite is a static page on somebody
 * else's host, so a napplet living in one has no React, no bundler output and
 * no app to lean on — the runtime has to travel with the page as an ordinary
 * file of the site, uploaded to Blossom alongside the HTML.
 *
 * So it is built twice from one source. The editor imports the modules directly
 * and runs napplets in the canvas; this plugin bundles the same modules into a
 * self-contained script, which the app imports as text and writes into the
 * site's files at publish time. Building it here rather than committing a build
 * artifact means the shipped runtime can never drift from the source.
 */

const VIRTUAL_ID = 'virtual:napplet-runtime';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const ENTRY = 'src/lib/napplet/runtime/boot.ts';

/**
 * The built script out of a bundler result.
 *
 * Typed structurally rather than against the bundler's own types: Vite 8 builds
 * with Rolldown, and pinning this to a named output type would tie the plugin to
 * whichever bundler happens to be underneath.
 */
interface BundleResult {
  output?: { type: string; code?: string }[];
}

function firstChunk(result: unknown): string {
  const chunk = (result as BundleResult).output?.find((entry) => entry.type === 'chunk');
  if (!chunk?.code) throw new Error('The napplet runtime build produced no chunk.');
  return chunk.code;
}

export function nappletRuntime(): Plugin {
  const root = process.cwd();

  return {
    name: 'napplet-runtime',

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null;

      /*
       * A nested Vite build with `configFile: false`, so this plugin is not
       * loaded again and cannot recurse into itself. `write: false` keeps the
       * artifact in memory — it is not a file of *this* app, it is a string
       * this app carries.
       */
      const result = await build({
        configFile: false,
        logLevel: 'error',
        resolve: {
          alias: { '@': path.resolve(root, 'src') },
        },
        build: {
          write: false,
          target: 'es2020',
          minify: true,
          lib: {
            entry: path.resolve(root, ENTRY),
            formats: ['iife'],
            // The entry exports nothing and starts itself; the name only
            // satisfies the IIFE format's need for one.
            name: '__nappletRuntime',
            fileName: () => 'napplet-runtime.js',
          },
        },
      });

      const outputs = Array.isArray(result) ? result : [result];
      const code = firstChunk(outputs[0]);

      return `export default ${JSON.stringify(code)};`;
    },
  };
}
