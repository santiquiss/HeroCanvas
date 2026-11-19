// A spec's files: the Markdown an agent reads (`md`) and the page a person opens (`htmlPage`), from the same data.

const READING = `Each screen has a picture (light and dark), an outline of its structure and the same structure in full as JSON.
In both, a node is a **component** (by its name in the app's code, with the props it gets), or a layer: a Row, Column,
Grid or Box that arranges its children, a Container that paints, a Text, an Icon, an Image, a Graphic or a Shape.
Every node has its box as \`x,y width×height\` in device points from the screen's top left, and how it's built: gap,
padding, fill, radius, text style and color, with the design token's name where the code names one
(\`16 (spacingDimensions.x2)\`). A prop written \`(callback)\` is a handler that's set (the thing can be tapped);
\`(widget)\` is a widget passed in. \`gradient\`, \`image\` and \`shadow\` only say there is one (see the picture);
\`pinned\` stays in place while its page scrolls; a color \`(by value)\` is the token that has that color, not one the
code names there.

The outline is shorter than the JSON in two ways. A component built only from its props is one line: what's inside it
is the component's own. And on a screen the app already has, what the proposal adds is marked \`+\` and the rest is
folded (\`… 12 unchanged\`); a screen the proposal adds has no marks: all of it is new.

The mirror is drawn with web technology, so read the structure as what to build with the app's own widgets, not as
markup to copy: sizes that depend on a font's metrics may differ by a point.`;

const group = (screens) => {
  const out = [];
  for (const s of screens) {
    const g = out.find((x) => x.name === s.group);
    if (g) g.screens.push(s);
    else out.push({ name: s.group, screens: [s] });
  }
  return out;
};

const stepsText = (steps) => (steps?.length ? steps.map((s) => ('click' in s ? `tap "${s.click}"` : 'fill' in s ? `type "${s.fill}"` : 'scroll' in s ? `scroll to ${s.scroll}` : JSON.stringify(s))).join(', then ') : null);

export const md = {
  /** A proposal's entry: what it is, its screens, its logic. */
  index(m, intro, handoff, site) {
    const at = site ? `${site}/spec/${m.path}/` : '';
    const lines = [`# ${m.code} · ${m.title}`, '', `> ${m.summary}`, ''];
    lines.push(`- Status: ${m.status}${m.ticket ? ` · Ticket: ${m.ticket}` : ''}${m.author ? ` · By ${m.author}` : ''}`);
    lines.push(`- Generated ${m.generated} from MF Designer ${m.version}${m.commit ? ` (${m.commit})` : ''}`);
    if (at) lines.push(`- This file: ${at}index.md · For a person, with the pictures: ${at}index.html`);
    lines.push('');
    if (intro) lines.push(intro, '');
    // Contents: every screen's own file, so an agent can go straight to the one it needs.
    let c = 0;
    lines.push('## Contents', '');
    for (const g of group(m.screens)) {
      if (g.name) lines.push(`- ${g.name}`);
      for (const s of g.screens) lines.push(`${g.name ? '  ' : ''}- ${++c}. [${s.title}](screens/${s.id}.md) (\`${s.id}\`)`);
    }
    if (handoff) lines.push('- Logic: the proposal’s handoff, at the end of this file');
    lines.push('', '## How to read this', '', READING, '', '## Screens', '');
    let n = 0;
    for (const g of group(m.screens)) {
      if (g.name) lines.push(`### ${g.name}`, '');
      for (const s of g.screens) {
        lines.push(`#### ${++n}. ${s.title}`, '');
        if (s.when) lines.push(`- **When:** ${s.when}`);
        if (s.shows) lines.push(`- **What shows:** ${s.shows}`);
        lines.push(`- ${s.inLive ? `A screen the app has: the proposal adds ${s.added} thing${s.added === 1 ? '' : 's'} to it (marked \`+\` in its outline)` : 'A screen the proposal adds'}`);
        for (const a of s.actions ?? []) lines.push(`- **${a.on}** → ${a.does}${a.to ? ` (screen: [${a.to}](screens/${a.to}.md))` : ''}`);
        lines.push(`- Structure: [outline](screens/${s.id}.md) · [full JSON](screens/${s.id}.json)`);
        lines.push(`- Pictures: [light](screens/${s.id}-light.png) · [dark](screens/${s.id}-dark.png)`);
        if (s.open) lines.push(`- Live in the designer (needs a browser and the team's access): ${s.open}${stepsText(s.steps) ? `, then ${stepsText(s.steps)}` : ''}`);
        lines.push('');
      }
    }
    if (handoff) lines.push('---', '', '## Logic: the proposal’s handoff', '', 'What follows is the handoff written for the developers: the rules, the texts and what stays as it is.', '', handoff.replace(/^# .*\n+/, '').replace(/^(#{1,5}) /gm, '#$1 '));
    return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  },

  /** One screen: when it shows, and its structure as an outline. */
  screen(p, s, tree, { prev = null, next = null } = {}) {
    const nav = [`[↑ ${p.code}: all screens](../index.md)`, prev && `[← ${prev.title}](${prev.id}.md)`, next && `[${next.title} →](${next.id}.md)`].filter(Boolean).join(' · ');
    const lines = [nav, '', `# ${p.code} · ${s.title}`, ''];
    if (s.when) lines.push(`- **When:** ${s.when}`);
    if (s.shows) lines.push(`- **What shows:** ${s.shows}`);
    lines.push(`- Device: ${s.device.width}×${s.device.height} points`);
    lines.push(`- ${s.inLive ? `A screen the app has: what the proposal adds is marked \`+\` (${s.added}); what it leaves is folded` : 'A screen the proposal adds: all of it is new'}`);
    lines.push(`- Pictures: [light](${s.id}-light.png) · [dark](${s.id}-dark.png) · Full structure: [JSON](${s.id}.json) · The proposal: [index](../index.md)`);
    if (s.actions?.length) lines.push('', '## What it does', '', '| On | What happens | Goes to |', '| --- | --- | --- |', ...s.actions.map((a) => `| ${a.on} | ${a.does} | ${a.to ? `[${a.to}](${a.to}.md)` : ''} |`));
    lines.push('', '## Structure', '', 'One line per node: what it is, its text, `x,y width×height`, how it’s built, its props. Indented under what contains it.', '', tree, '', '---', '', nav);
    return lines.join('\n') + '\n';
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline Markdown: code, bold, italics, links. */
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

/** A heading's anchor: its words, lowercase, joined by dashes; `taken` keeps them unique on the page. */
function slug(text, taken) {
  const base = String(text).toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/** A heading that links to itself, so any part of the page can be pointed at. */
const heading = (level, id, html) => `<h${level} id="${id}"><a class="self" href="#${id}">${html}</a></h${level}>`;

/**
 * The Markdown a handoff uses (headings, paragraphs, lists, tables), as HTML. `shift`: how many levels down its
 * headings go. Each heading gets an anchor (`taken`: the page's, so they're unique) and, if `toc` is given, goes in it.
 */
function markdown(src, shift = 0, taken = new Set(), toc = null) {
  const out = [];
  const lines = src.split('\n');
  let i = 0;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,6}) (.*)/);
    if (h) {
      const n = Math.min(6, h[1].length + shift);
      const id = slug(h[2], taken);
      toc?.push({ level: h[1].length, id, text: h[2] });
      out.push(heading(n, id, inline(h[2])));
      i++;
      continue;
    }
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const head = cells(l);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.) /.test(l)) {
      // Nested by indent: each item with the lines that continue it.
      const items = [];
      while (i < lines.length && (/^\s*([-*]|\d+\.) /.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.) (.*)/);
        if (m) items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
        else items[items.length - 1].text += ` ${lines[i].trim()}`;
        i++;
      }
      const render = (from, indent) => {
        let html = '';
        let k = from;
        const tag = items[from].ordered ? 'ol' : 'ul';
        while (k < items.length && items[k].indent >= indent) {
          if (items[k].indent > indent) { const [inner, next] = render(k, items[k].indent); html = html.replace(/<\/li>$/, `${inner}</li>`); k = next; continue; }
          html += `<li>${inline(items[k].text)}</li>`;
          k++;
        }
        return [`<${tag}>${html}</${tag}>`, k];
      };
      out.push(render(0, items[0].indent)[0]);
      continue;
    }
    if (/^---+$/.test(l.trim())) { out.push('<hr>'); i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6} |\s*([-*]|\d+\.) |\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const CSS = `
:root{--bg:#f6f6f4;--card:#fff;--ink:#17181a;--muted:#62666d;--line:#e3e3df;--accent:#0b6bcb;--code:#efefec}
@media (prefers-color-scheme:dark){:root{--bg:#111214;--card:#1a1b1e;--ink:#ececec;--muted:#9a9ea6;--line:#2a2c30;--accent:#6cb4ff;--code:#222428}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 16px 96px;min-width:0}
.page{display:grid;grid-template-columns:minmax(0,1fr);max-width:1400px;margin:0 auto}
@media (min-width:1180px){.page{grid-template-columns:260px minmax(0,1fr)}}
nav.toc{font-size:14px;line-height:1.4;padding:16px;border-bottom:1px solid var(--line)}
@media (min-width:1180px){nav.toc{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding:40px 16px 40px 24px;border-bottom:0;border-right:1px solid var(--line)}}
nav.toc ol{list-style:none;margin:0;padding:0;max-width:none}
nav.toc ol ol{padding-left:12px;margin:2px 0 6px}
nav.toc li{margin:0}
nav.toc a{display:block;padding:3px 6px;border-radius:6px;color:var(--ink);text-decoration:none}
nav.toc a:hover{background:var(--code)}
nav.toc ol ol a{color:var(--muted)}
nav.toc .tocTitle{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;padding:0 6px}
a.self{color:inherit;text-decoration:none}
a.self:hover{text-decoration:underline;text-decoration-color:var(--line)}
:target{scroll-margin-top:16px}
.top{font-size:13px}
h1{font-size:30px;line-height:1.2;margin:0 0 8px;text-wrap:balance}
h2{font-size:22px;margin:56px 0 12px;padding-top:24px;border-top:1px solid var(--line)}
h3{font-size:18px;margin:32px 0 8px}
h4{font-size:16px;margin:24px 0 6px}
h5,h6{font-size:14px;margin:20px 0 4px}
p{margin:0 0 12px;max-width:72ch}
a{color:var(--accent)}
code{background:var(--code);border-radius:4px;padding:1px 5px;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.lead{font-size:18px;color:var(--muted);max-width:68ch}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 20px;padding:0;list-style:none}
.meta li{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:13px;color:var(--muted)}
.agents{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;font-size:14px;color:var(--muted);max-width:none}
.screen{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:16px 0;display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:24px}
@media (max-width:760px){.screen{grid-template-columns:1fr}}
.shots{display:flex;gap:8px}
.shots a{flex:1;min-width:0}
.shots img{display:block;width:100%;height:auto}
.screen h4{margin-top:0;font-size:18px}
dl{margin:0 0 12px}
dt{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:10px}
dd{margin:2px 0 0}
details{margin-top:12px}
summary{cursor:pointer;color:var(--accent);font-size:14px}
pre{background:var(--code);border-radius:10px;padding:12px;overflow:auto;max-height:520px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:8px 0 0;white-space:pre}
.links{font-size:14px;color:var(--muted)}
.table{overflow-x:auto;margin:0 0 16px}
table{border-collapse:collapse;font-size:14px;min-width:100%}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--code)}
ul,ol{margin:0 0 12px;padding-left:22px;max-width:72ch}
li{margin:3px 0}
hr{border:0;border-top:1px solid var(--line);margin:32px 0}
`;

const shell = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<link rel="alternate" type="text/markdown" href="index.md">
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;

/** The contents: every section, group and screen of the page, each a link to it. */
function tocHtml(items) {
  const list = (xs) => `<ol>${xs.map((x) => `<li><a href="#${x.id}">${x.html}</a>${x.children?.length ? list(x.children) : ''}</li>`).join('')}</ol>`;
  return `<nav class="toc" aria-label="Contents"><p class="tocTitle">Contents</p>${list(items)}</nav>`;
}

/** The proposal for a person: what it is, each screen with its pictures and structure, then its logic. */
export function htmlPage(m, intro, screens, handoff) {
  let n = 0;
  // Every anchor on the page, so the ones the handoff and the intro make don't clash with the page's own.
  const taken = new Set(['top', 'overview', 'screens', 'how-to-read', 'logic', ...screens.map((s) => s.id)]);
  const groups = group(screens).map((g) => ({ ...g, id: g.name ? slug(`group ${g.name}`, taken) : null }));
  const introToc = [];
  const introHtml = intro ? markdown(intro, 2, taken, introToc) : '';
  const logicToc = [];
  const logicHtml = handoff ? markdown(handoff.replace(/^# .*\n+/, ''), 1, taken, logicToc) : '';
  // The handoff's top headings in the contents, its second level under them.
  const nest = (hs) => {
    const top = Math.min(...hs.map((h) => h.level));
    const out = [];
    for (const h of hs) {
      const item = { id: h.id, html: inline(h.text), children: [] };
      if (h.level === top || !out.length) out.push(item);
      else if (h.level === top + 1) out[out.length - 1].children.push(item);
    }
    return out;
  };
  let k = 0;
  const toc = [
    { id: 'overview', html: 'Overview', children: introToc.length ? nest(introToc) : [] },
    {
      id: 'screens',
      html: 'Screens',
      children: groups.flatMap((g) => {
        const items = g.screens.map((s) => ({ id: s.id, html: `${++k}. ${esc(s.title)}` }));
        return g.name ? [{ id: g.id, html: esc(g.name), children: items }] : items;
      }),
    },
    { id: 'how-to-read', html: 'How to read the structure' },
    ...(handoff ? [{ id: 'logic', html: 'Logic: the handoff', children: logicToc.length ? nest(logicToc) : [] }] : []),
  ];
  const back = '<a class="top" href="#top">↑ Contents</a>';
  const main = [
    `<h1 id="top">${esc(m.code)} · ${esc(m.title)}</h1>`,
    `<p class="lead">${esc(m.summary)}</p>`,
    `<ul class="meta"><li>${esc(m.status)}</li>${m.ticket ? `<li>${esc(m.ticket)}</li>` : ''}${m.author ? `<li>${esc(m.author)}</li>` : ''}<li>MF Designer ${esc(m.version)} · ${esc(m.generated)}</li></ul>`,
    `<p class="agents">Reading this as an agent? The same content as plain text is in <a href="index.md">index.md</a>, which links each screen’s structure as an outline and in full (JSON): ${screens.map((x) => `<a href="screens/${x.id}.md">${esc(x.id)}</a>`).join(', ')}.</p>`,
    `<section id="overview"><p>${esc(m.description)}</p>`,
    introHtml,
    '</section>',
    heading(2, 'screens', 'Screens'),
    ...groups.flatMap((g) => [
      g.name ? heading(3, g.id, esc(g.name)) : '',
      ...g.screens.map(
        (s) => `<section class="screen" id="${esc(s.id)}">
<div class="shots"><a href="screens/${s.id}-light.png"><img src="screens/${s.id}-light.png" alt="${esc(s.title)}, light" loading="lazy"></a><a href="screens/${s.id}-dark.png"><img src="screens/${s.id}-dark.png" alt="${esc(s.title)}, dark" loading="lazy"></a></div>
<div>
<h4><a class="self" href="#${esc(s.id)}">${++n}. ${esc(s.title)}</a></h4>
<p class="links">Its id: <a href="#${esc(s.id)}"><code>${esc(s.id)}</code></a> · ${back}</p>
<dl>${s.when ? `<dt>When</dt><dd>${inline(s.when)}</dd>` : ''}${s.shows ? `<dt>What shows</dt><dd>${inline(s.shows)}</dd>` : ''}${s.actions?.length ? `<dt>What it does</dt><dd><ul>${s.actions.map((a) => `<li><strong>${esc(a.on)}</strong>: ${inline(a.does)}${a.to ? ` <a href="#${esc(a.to)}">→ ${esc(a.to)}</a>` : ''}</li>`).join('')}</ul></dd>` : ''}</dl>
<p class="links">${s.inLive ? `A screen the app has: the proposal adds ${s.added} thing${s.added === 1 ? '' : 's'} (marked + in its structure).` : 'A screen the proposal adds.'}</p>
<p class="links">${s.open ? `<a href="${esc(s.open)}">Open in MF Designer</a>${stepsText(s.steps) ? ` (then ${esc(stepsText(s.steps))})` : ''} · ` : ''}<a href="screens/${s.id}.md">Outline</a> · <a href="screens/${s.id}.json">JSON</a></p>
<details><summary>Structure</summary><pre>${esc(s.outline)}</pre></details>
</div>
</section>`,
      ),
    ]),
    heading(2, 'how-to-read', 'How to read the structure'),
    markdown(READING, 0, taken),
    handoff ? `${heading(2, 'logic', 'Logic: the proposal’s handoff')}\n${logicHtml}` : '',
  ];
  const body = `<div class="page">\n${tocHtml(toc)}\n<main>\n${main.filter(Boolean).join('\n')}\n</main>\n</div>`;
  return shell(`${m.code} · ${m.title}`, body);
}
