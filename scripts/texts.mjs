// `npm run texts -- --from <path>…`: an app's translations as the mirror reads them, one JSON per language
// (app/i18n.<lang>.json: key → text), converted from where its code keeps them, never retyped:
//
//   iOS: .strings (in <lang>.lproj, UTF-8 or UTF-16) and String Catalogs (.xcstrings)
//   Android: res/values-<lang>/strings.xml (values/: the base language)
//   Flutter: ARB files (app_<lang>.arb)
//   i18next / FormatJS: <lang>.json, or <lang>/<namespace>.json (nested keys flattened with dots)
//
// A folder is searched for them. Keys from several files merge; a later file's text wins. Read only from the app's
// repository: it's never written.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sources = args.filter((a) => a !== '--from');
if (!args.includes('--from') || !sources.length || !sources.every(existsSync)) {
  console.log('Usage: npm run texts -- --from <a folder or files: .strings, .xcstrings, strings.xml, .arb, i18next JSON>…');
  process.exit(1);
}

/** language → key → text */
const out = {};
const put = (lang, key, text) => {
  if (!lang || typeof text !== 'string') return;
  (out[lang] ??= {})[key] = text;
};

const read = (file) => {
  const buf = readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le').slice(1);
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf).swap16().toString('utf16le').slice(1);
  return buf.toString('utf8');
};
const unescape = (s) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

function convert(file) {
  const name = basename(file);
  if (name.endsWith('.strings')) {
    const lang = (dirname(file).match(/([\w-]+)\.lproj$/) ?? [])[1];
    if (lang === 'Base') return;
    for (const m of read(file).matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/gm)) put(lang, unescape(m[1]), unescape(m[2]));
  } else if (name.endsWith('.xcstrings')) {
    const cat = JSON.parse(read(file));
    for (const [key, entry] of Object.entries(cat.strings ?? {})) {
      put(cat.sourceLanguage, key, key);
      for (const [lang, loc] of Object.entries(entry.localizations ?? {})) put(lang, key, loc.stringUnit?.value);
    }
  } else if (name === 'strings.xml') {
    const folder = basename(dirname(file));
    const lang = folder === 'values' ? 'base' : (folder.match(/^values-([a-z]{2,3}(?:-r[A-Z]{2})?)$/) ?? [])[1]?.replace('-r', '-');
    for (const m of read(file).matchAll(/<string name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) put(lang, m[1], unescape(m[2].replace(/\\'/g, "'")));
  } else if (name.endsWith('.arb')) {
    const arb = JSON.parse(read(file));
    const lang = arb['@@locale'] ?? (name.match(/_([a-zA-Z_]+)\.arb$/) ?? [])[1];
    for (const [k, v] of Object.entries(arb)) if (!k.startsWith('@')) put(lang, k, v);
  } else if (name.endsWith('.json')) {
    const lang = (name.match(/^([a-z]{2,3}(?:[-_][A-Za-z]{2,4})?)\.json$/) ?? dirname(file).match(/[\\/]([a-z]{2,3}(?:[-_][A-Za-z]{2,4})?)$/) ?? [])[1];
    if (!lang) return;
    for (const [k, v] of flatten(JSON.parse(read(file)))) put(lang, k, v);
  }
}

const walk = (p) => {
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) if (f !== 'node_modules' && !f.startsWith('.')) walk(join(p, f));
  } else if (/\.(strings|xcstrings|arb)$/.test(p) || basename(p) === 'strings.xml' || (/\.json$/.test(p) && /(locales?|i18n|lang|translations?)[\\/]/i.test(p))) convert(p);
};
for (const s of sources) walk(s);

const langs = Object.keys(out).sort();
if (!langs.length) {
  console.log('No translations found there.');
  process.exit(1);
}
for (const lang of langs) {
  const file = join(root, `app/i18n.${lang}.json`);
  const before = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const merged = { ...before, ...out[lang] };
  writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
  console.log(`app/i18n.${lang}.json: ${Object.keys(out[lang]).length} texts${Object.keys(before).length ? ` (${Object.keys(merged).length} with what was there)` : ''}`);
}
console.log('Read them by key in app/i18n.ts, in the screen’s language (useLanguage from herocanvas).');
