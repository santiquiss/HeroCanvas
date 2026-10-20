// An element drawn into a canvas, as the browser shows it: a copy with every computed style written on it (pseudo
// elements too), its images and fonts embedded, inside an SVG foreignObject, rasterized at `scale`. Our own few
// lines instead of a library (AGENTS.md: no new runtime dependency). One shot, on demand: it walks every element.
//
// What a foreignObject doesn't draw comes out flat: a WebGL canvas without preserveDrawingBuffer (Rive) may be blank.

const XHTML = 'http://www.w3.org/1999/xhtml';

/** A URL's content as a data URL ('' when it can't be read: cross-origin without CORS, a 404). */
async function dataUrl(url: string, cache: Map<string, Promise<string>>): Promise<string> {
  if (url.startsWith('data:')) return url;
  let hit = cache.get(url);
  if (!hit) {
    hit = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => '');
    cache.set(url, hit);
  }
  return hit;
}

const URL_RE = /url\((['"]?)([^'")]+)\1\)/g;

/** A CSS value with its url(...)s replaced by data URLs. */
async function inlineUrls(value: string, base: string, cache: Map<string, Promise<string>>): Promise<string> {
  const urls = [...value.matchAll(URL_RE)].map((m) => m[2]);
  if (!urls.length) return value;
  const data = await Promise.all(urls.map((u) => dataUrl(new URL(u, base).href, cache)));
  let i = 0;
  return value.replace(URL_RE, () => {
    const d = data[i++];
    return d ? `url("${d}")` : 'none';
  });
}

/**
 * Logical properties (inset-inline-start, padding-block-end…) repeat the physical ones in the computed style; written
 * after them they'd win over the root's overrides (its left and top), so they're left out.
 */
const LOGICAL = /(^|-)(block|inline)(-|$)|^border-(start|end)-|^inset-/;

/** Every computed property as one declaration list. */
function declarations(cs: CSSStyleDeclaration): string {
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i];
    if (LOGICAL.test(name)) continue;
    out += `${name}:${cs.getPropertyValue(name)};`;
  }
  return out;
}

const URL_PROPS = ['background-image', 'mask-image', '-webkit-mask-image', 'list-style-image', 'border-image-source'];

/** The fonts the copy uses, as @font-face rules with their files embedded (Google Fonts' CSS allows CORS). */
async function fontFaces(families: Set<string>, cache: Map<string, Promise<string>>): Promise<string> {
  const sheets: { css: string; base: string }[] = [];
  for (const sheet of document.styleSheets) {
    try {
      sheets.push({ css: [...sheet.cssRules].map((r) => r.cssText).join('\n'), base: sheet.href ?? location.href });
    } catch {
      // A cross-origin sheet hides its rules: read it again with CORS.
      if (sheet.href) {
        const css = await fetch(sheet.href)
          .then((r) => r.text())
          .catch(() => '');
        sheets.push({ css, base: sheet.href });
      }
    }
  }
  const faces: Promise<string>[] = [];
  for (const { css, base } of sheets)
    for (const m of css.matchAll(/@font-face\s*{[^}]*}/g)) {
      const rule = m[0];
      const family = /font-family:\s*['"]?([^;'"]+)/.exec(rule)?.[1]?.trim();
      if (!family || !families.has(family)) continue;
      // Google Fonts splits a family by script: the Latin ones are what the app shows.
      const range = /unicode-range:\s*([^;]+)/.exec(rule)?.[1];
      if (range && !/U\+0000-00FF/i.test(range)) continue;
      faces.push(inlineUrls(rule, base, cache));
    }
  return (await Promise.all(faces)).join('\n');
}

const INSETS = ['position', 'top', 'left', 'bottom', 'right'];

/**
 * How far a sticky box is from its place in the flow, in CSS pixels: its offset as it is, and again unstuck (relative,
 * no insets). Offsets, not client rects: the frame on the canvas is zoomed and may be turned.
 */
function stuckOffset(el: HTMLElement): [number, number] {
  const x = el.offsetLeft;
  const y = el.offsetTop;
  const saved = INSETS.map((k) => [el.style.getPropertyValue(k), el.style.getPropertyPriority(k)] as const);
  el.style.setProperty('position', 'relative', 'important');
  for (const k of INSETS.slice(1)) el.style.setProperty(k, 'auto', 'important');
  const offset: [number, number] = [x - el.offsetLeft, y - el.offsetTop];
  INSETS.forEach((k, i) => el.style.setProperty(k, saved[i][0], saved[i][1]));
  return offset;
}

/** A copy of `el` with its styles written on it; `rules` gets the pseudo elements' and `families` the fonts used. */
function copy(el: Element, rules: string[], families: Set<string>, pending: Promise<void>[], cache: Map<string, Promise<string>>): Node {
  if (el instanceof HTMLCanvasElement) {
    const img = document.createElement('img');
    try {
      img.src = el.toDataURL();
    } catch {
      // A tainted canvas: left empty.
    }
    img.style.cssText = declarations(getComputedStyle(el));
    return img;
  }
  const out = el.cloneNode(false) as HTMLElement | SVGElement;
  const cs = getComputedStyle(el);
  // `data-capture="skip"`: on the canvas but not in the picture (a turned frame's body, drawn by the PNG's own 3D).
  if (cs.display === 'none' || el.getAttribute('data-capture') === 'skip') return document.createComment('');
  out.removeAttribute('class');
  out.removeAttribute('id');
  out.setAttribute('style', declarations(cs));
  if (cs.position === 'sticky' && el instanceof HTMLElement) {
    // The copy isn't scrolled, so a sticky box would sit in the flow and move up with the scrolled content: it's
    // drawn where it's stuck instead, relative by how far that is from its place in the flow.
    const [dx, dy] = stuckOffset(el);
    for (const [k, v] of Object.entries({ position: 'relative', top: `${dy}px`, left: `${dx}px`, bottom: 'auto', right: 'auto' }))
      out.style.setProperty(k, v);
  }
  for (const f of cs.fontFamily.split(',')) families.add(f.trim().replace(/^['"]|['"]$/g, ''));
  for (const prop of URL_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v.includes('url(')) pending.push(inlineUrls(v, location.href, cache).then((d) => out.style.setProperty(prop, d)));
  }
  for (const pseudo of ['::before', '::after'] as const) {
    const ps = getComputedStyle(el, pseudo);
    if (ps.content === 'none' || ps.content === 'normal') continue;
    const cls = `cap${rules.length}`;
    out.classList.add(cls);
    rules.push(`.${cls}${pseudo}{${declarations(ps)}}`);
  }
  if (el instanceof HTMLImageElement && el.currentSrc)
    pending.push(dataUrl(el.currentSrc, cache).then((d) => (out.setAttribute('src', d), out.removeAttribute('srcset'))));
  if (el instanceof SVGImageElement) {
    const href = el.href.baseVal;
    if (href) pending.push(dataUrl(new URL(href, location.href).href, cache).then((d) => out.setAttribute('href', d)));
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) out.setAttribute('value', el.value);
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) out.appendChild(child.cloneNode());
    else if (child instanceof Element) out.appendChild(copy(child, rules, families, pending, cache));
  }
  // A scrolled box: the copy starts at the top, so its children move up by what was scrolled.
  if (el.scrollTop || el.scrollLeft)
    for (const child of out.children)
      if (child instanceof HTMLElement || child instanceof SVGElement) child.style.setProperty('translate', `${-el.scrollLeft}px ${-el.scrollTop}px`);
  return out;
}

/**
 * `el` as a canvas `scale` times its CSS size, transparent around it. `root` styles override the copy's root (the
 * frame's position and transform on the canvas don't belong in the picture).
 */
export async function elementToCanvas(el: HTMLElement, scale: number, root: Record<string, string> = {}): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const rules: string[] = [];
  const families = new Set<string>();
  const pending: Promise<void>[] = [];
  const cache = new Map<string, Promise<string>>();
  const clone = copy(el, rules, families, pending, cache) as HTMLElement;
  for (const [k, v] of Object.entries({ position: 'relative', inset: '0 auto auto 0', margin: '0', transform: 'none', transition: 'none', ...root }))
    clone.style.setProperty(k, v);
  const [fonts] = await Promise.all([fontFaces(families, cache), ...pending]);

  const host = document.createElementNS(XHTML, 'div');
  const style = document.createElementNS(XHTML, 'style');
  style.textContent = fonts + '\n' + rules.join('\n');
  host.appendChild(style);
  host.appendChild(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">${new XMLSerializer().serializeToString(host)}</foreignObject></svg>`;

  const img = new Image();
  img.decoding = 'sync';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
