/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build, createServer, defineConfig, type Plugin, type UserConfig, type ViteDevServer } from 'vite'
import pkg from './package.json' with { type: 'json' }
import hcVersion from './src/version.json' with { type: 'json' }
import hc from './herocanvas.config.ts'
import { brand } from './scripts/vite/brand.ts'
import { hcWriter } from './scripts/vite/hcWriter.ts'
import { projectAliases, projectById, projectsOf, takenCodes, type Project } from './scripts/vite/projects.ts'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const PROJECTS = projectsOf(hc.projects)

/** The tool built for one of the copy's projects (herocanvas.config.ts `projects`): `HC_PROJECT`, the first by default. */
function projectConfig(project: Project): UserConfig {
  return {
    // hcWriter: the designer saves screen config / proposals to the project's files (dev server only). brand: the
    // tool's colors, from herocanvas.config.ts (or its logo). The first project's server and build bring the others.
    plugins: [react(), hcWriter(project), brand(hc), ...(project.root ? [otherProjects()] : [])],
    // Relative: the built site works wherever it's served, at a domain's root or under a path (GitHub Pages'
    // user.github.io/repo). Public files are reached through import.meta.env.BASE_URL, never from `/`.
    base: './',
    // Each project beside the first in a folder of the first's site (dist/<id>/), so the two deploy as one.
    build: { outDir: project.root ? 'dist' : `dist/${project.id}` },
    // The tool and the team's code meet through two names: the app imports the tool as `herocanvas` (src/index.ts,
    // its public API: the same import once the tool is a package), and the tool reads the project's app as `@app`
    // (app/, or <dir>/app) and its proposals as `@proposals`; what it shares with another, as `@shared/…`.
    resolve: {
      alias: [
        { find: /^herocanvas$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
        // The iOS kit (SwiftUI's views on the app's tokens), its own entry: only an app that uses it loads it.
        { find: /^herocanvas\/ios$/, replacement: fileURLToPath(new URL('./src/ios/index.tsx', import.meta.url)) },
        ...projectAliases(project, ROOT),
      ],
    },
    // The versions in the toolbar: this copy's (package.json, its CHANGELOG.md) and HeroCanvas's (src/version.json,
    // src/CHANGELOG.md). The build's id (when it was built, or
    // when the dev server started): what's derived from the code and cached in the browser (the page index) is keyed
    // on it, so a new build doesn't read a stale cache.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __HC_VERSION__: JSON.stringify(hcVersion.version),
      // The project this build shows, and every project (the toolbar's menu goes from one to another).
      __HC_PROJECT__: JSON.stringify({ id: project.id, root: project.root, path: project.path, handoff: project.handoff }),
      __HC_PROJECTS__: JSON.stringify(process.env.VITEST ? [] : PROJECTS.map((p) => ({ id: p.id, name: p.name, path: p.path }))),
      // The proposal codes the other projects took (as the server or the build started): a new one here doesn't.
      __HC_OTHER_CODES__: JSON.stringify(PROJECTS.filter((p) => p.id !== project.id).flatMap((p) => takenCodes(ROOT, p))),
      // The tool's own tests read its interface in English, whatever the copy's language.
      __HC_LANGUAGE__: JSON.stringify(process.env.VITEST ? 'en' : (hc.language ?? 'en')),
      // The comments' shared store (herocanvas.config.ts `comments`): the team's, so an update never empties it.
      __HC_COMMENTS__: JSON.stringify(hc.comments?.key ? { url: hc.comments.url, key: hc.comments.key } : null),
      // Who can be @mentioned in a comment (`comments.team`); the tests mention their own.
      __HC_TEAM__: JSON.stringify(process.env.VITEST ? [] : (hc.comments?.team ?? [])),
      // Guest links (src/share): where they're made, and the views they can open (the tests see HeroCanvas's own).
      __HC_SHARE__: JSON.stringify({ url: process.env.VITEST ? null : (hc.share?.url ?? null), profiles: process.env.VITEST ? {} : (hc.share?.profiles ?? {}) }),
      __BUILD_ID__: JSON.stringify(String(Date.now())),
    },
    // `npm test`: the logic's unit tests (and the scripts': npm run shot's arguments) and the smoke test (every page, every story renders), in a DOM of happy-dom.
    // Another project's (HC_PROJECT=<id>): its own tests and the smoke test, on its app.
    test: {
      environment: 'happy-dom',
      include: project.root
        ? ['{src,app,proposals}/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'app/**/*.test.mjs']
        : ['src/test/smoke.test.tsx', `{${project.app},${project.proposals}}/**/*.test.{ts,tsx}`],
      // The tool's, then the app's own when it has one (app/test/setup.ts: stand-ins for what its dependencies need and
      // a DOM doesn't have, as a WebAssembly runtime).
      setupFiles: ['src/test/setup.ts', ...(existsSync(`${project.app}/test/setup.ts`) ? [`${project.app}/test/setup.ts`] : [])],
      // No module cache between runs: it keeps an import.meta.glob's old list (proposals/, stories, pages), so a
      // proposal or a story added since fails as missing until the cache is cleared.
      fsModuleCache: false,
      // Stylesheets the code reads as text (`?raw`): the designer's theme, the kit's tokens and the app's (its theme,
      // its components and screens, the proposals'). Vitest leaves every other stylesheet (the designer's own UI) empty.
      css: { include: [/src\/theme\/[\w-]+\.css/, /src\/kit\/.+\.css/, /\/(app|proposals)\/.+\.css/] },
    },
  }
}

/**
 * The copy's other projects, beside the first: `npm run dev` serves each at /<id>/ (its own Vite, in the same server
 * and port, its HMR on the same socket at its own path), and `vite build` builds each into dist/<id>/ after the first.
 */
function otherProjects(): Plugin {
  const others = PROJECTS.filter((p) => !p.root)
  const servers: ViteDevServer[] = []
  let command = 'serve'
  return {
    name: 'hc-projects',
    configResolved(c) {
      command = c.command
    },
    async configureServer(server) {
      // Vitest's own server tests one project at a time (HC_PROJECT): no other beside it.
      if (process.env.VITEST) return
      for (const p of others) {
        const base = `/${p.path}`
        const sub = await createServer({
          ...projectConfig(p),
          configFile: false,
          base,
          appType: 'spa',
          server: { middlewareMode: true, hmr: { server: server.httpServer ?? undefined } },
        })
        servers.push(sub)
        server.middlewares.use((req, res, next) => {
          if (req.url === base.slice(0, -1)) {
            res.writeHead(302, { location: base })
            return res.end()
          }
          if (req.url?.startsWith(base)) return sub.middlewares(req, res, next)
          next()
        })
      }
      server.httpServer?.on('close', () => servers.forEach((s) => s.close()))
    },
    async closeBundle() {
      if (process.env.VITEST || command !== 'build') return
      for (const p of others) await build({ ...projectConfig(p), configFile: false, logLevel: 'warn' })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(projectConfig(projectById(PROJECTS, process.env.HC_PROJECT)))
