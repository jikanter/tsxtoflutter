import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    // shadcn fixtures import from `@/components/ui/*`. Map that to local
    // stubs so the fixture corpus renders without pulling shadcn into
    // the workspace.
    alias: {
      '@/components/ui/button': path.resolve(here, 'src/stubs/button.tsx'),
    },
  },
  server: {
    port: 5173,
    headers: {
      // Required for Flutter Web Skwasm (WASM) when we embed the right pane.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
