/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }
import hcVersion from './src/version.json' with { type: 'json' }
import hc from './herocanvas.config.ts'
import { brand } from './scripts/vite/brand.ts'
import { hcWriter } from './scripts/vite/hcWriter.ts'

// https://vite.dev/config/
export default defineConfig({
  // hcWriter: the designer saves screen config / proposals to project files (dev server only). brand: the tool's
  // colors, from herocanvas.config.ts (or its logo).
  plugins: [react(), hcWriter(), brand(hc)],
  // Relative: the built site works wherever it's served, at a domain's root or under a path (GitHub Pages'
  // user.github.io/repo). Public files are reached through import.meta.env.BASE_URL, never from `/`.
  base: './',
  // The tool and the team's code meet through two names: the app imports the tool as `herocanvas` (src/index.ts, its
  // public API: the same import once the tool is a package), and the tool reads the app as `@app` (app/).
  resolve: {
    alias: [
      { find: /^herocanvas$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
      // The iOS kit (SwiftUI's views on the app's tokens), its own entry: only an app that uses it loads it.
      { find: /^herocanvas\/ios$/, replacement: fileURLToPath(new URL('./src/ios/index.tsx', import.meta.url)) },
      { find: /^@app(?=\/|$)/, replacement: fileURLToPath(new URL('./app', import.meta.url)) },
    ],
  },
  // The versions in the toolbar: this copy's (package.json, its CHANGELOG.md) and HeroCanvas's (src/version.json,
  // src/CHANGELOG.md). The build's id (when it was built, or
  // when the dev server started): what's derived from the code and cached in the browser (the page index) is keyed
  // on it, so a new build doesn't read a stale cache.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __HC_VERSION__: JSON.stringify(hcVersion.version),
    // The tool's own tests read its interface in English, whatever the copy's language.
    __HC_LANGUAGE__: JSON.stringify(process.env.VITEST ? 'en' : (hc.language ?? 'en')),
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  // `npm test`: the logic's unit tests (and the scripts': npm run shot's arguments) and the smoke test (every page, every story renders), in a DOM of happy-dom.
  test: {
    environment: 'happy-dom',
    include: ['{src,app,proposals}/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'app/**/*.test.mjs'],
    setupFiles: ['src/test/setup.ts'],
    // No module cache between runs: it keeps an import.meta.glob's old list (proposals/, stories, pages), so a
    // proposal or a story added since fails as missing until the cache is cleared.
    fsModuleCache: false,
    // Stylesheets the code reads as text (`?raw`): the designer's theme, the kit's tokens and the app's (its theme,
    // its components and screens, the proposals'). Vitest leaves every other stylesheet (the designer's own UI) empty.
    css: { include: [/src\/theme\/[\w-]+\.css/, /src\/kit\/.+\.css/, /\/(app|proposals)\/.+\.css/] },
  },
})
