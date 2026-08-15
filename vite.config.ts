import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

import { nappletRuntime } from "./plugins/nappletRuntime";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    // Emit a single stylesheet so there is no runtime <link> injection for
    // lazy chunks; the post-build inline step then folds it into index.html.
    // nsite gateways serve a blob with whatever Content-Type the Blossom
    // server reports, and CSS is not content-sniffable, so an external
    // stylesheet arrives as text/plain and the browser refuses to apply it.
    cssCodeSplit: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    nappletRuntime(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/{vite,eslint}.config.*',
      '.agents/**',
    ],
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));