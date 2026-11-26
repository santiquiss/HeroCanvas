// The dev server's text files as UTF-8. Vite serves public/'s files with their type alone (`text/markdown`), and a
// browser reads a text type with no charset as Latin-1: a spec's index.md showed `Â·` for `·` and `â€™` for `’`. The
// production site already says `charset=utf-8`; here every text type (and JSON) gets it too.
import type { Plugin } from 'vite';

const TEXT = /^(text\/[\w.+-]+|application\/json)\s*$/i;

export function utf8(): Plugin {
  return {
    name: 'hc-utf8',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        const set = res.setHeader.bind(res);
        res.setHeader = (name, value) => set(name, name.toLowerCase() === 'content-type' && typeof value === 'string' && TEXT.test(value) ? `${value.trim()}; charset=utf-8` : value);
        next();
      });
    },
  };
}
