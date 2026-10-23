// The lab built on its own, to serve from another dev server (the app's, so the lab and the app share an origin: the
// app's picture is taken inside its iframe): `LAB_OUT=<folder> npx vite build --config lab/vite.config.ts`.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  base: './',
  publicDir: false,
  build: {
    outDir: process.env.LAB_OUT ?? 'dist-lab',
    emptyOutDir: true,
    rollupOptions: {
      input: { duo3d: here('./duo3d.html'), picture: here('./picture.ts') },
      // picture.js at a known path: the lab loads it into the app's iframe.
      output: { entryFileNames: (chunk) => (chunk.name === 'picture' ? 'picture.js' : 'assets/[name]-[hash].js') },
    },
  },
});
