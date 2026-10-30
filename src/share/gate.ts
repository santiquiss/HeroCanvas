// The deployed site's door (the root middleware.ts runs it on Vercel; `npm run dev` has none). Two ways in:
// - The team: SITE_PASSWORD, remembered for 30 days (a cookie holding an HMAC keyed by it: changing it signs everyone out).
// - A guest: a link made by someone of the team (`POST /__share`), until it expires: the link alone lets them in (no
//   password: whoever has it, as its maker chose). Nothing is stored: the link carries when it expires, the view it
//   opens (a profile, src/share/view.ts) and where it starts, signed with SHARE_SECRET, so none of it can be changed.
//   Changing SHARE_SECRET ends every guest link at once.
// The guest's view (fewer modes and panels) is the interface's: the server only lets a guest in while the link lasts.
// With `.js`, as the server runs it (middleware.ts: files of their own, not a bundle).
import { expiredPage, loginPage, messagePage } from './pages.js';
import { LINK_HOURS, parseHidden } from './profiles.js';

export const TEAM_COOKIE = 'mfd_auth';
/** The guest's proof (HttpOnly), and the view it opens, readable by the page (`profile.expiresAt`). */
export const GUEST_COOKIE = 'hc_guest';
export const VIEW_COOKIE = 'hc_view';
export const LOGIN = '/__login';
export const LOGOUT = '/__logout';
export const SHARE = '/__share';
/** A guest link: `/__s/<token>`. */
export const LINK = '/__s/';
/** Whether this browser has the team's password too (the page can't read its HttpOnly cookie): `{ team }`. */
export const SESSION = '/__session';
/** Out of a guest view, back to the whole designer: only with the team's password. */
export const LEAVE = '/__leave';

const TEAM_AGE = 60 * 60 * 24 * 30;

export interface GateOptions {
  /** The designer's name (herocanvas.config.ts `name`), on its pages. */
  name: string;
  /** The team's password (SITE_PASSWORD). Unset: the site stays closed. */
  sitePassword?: string;
  /** What guest links are signed with (SHARE_SECRET). Unset: no guest links. */
  shareSecret?: string;
  /** The profiles a link may open (src/share/view.ts). */
  profiles: string[];
  /** Now, in ms (tests). */
  now?: number;
}

/**
 * What the link carries: when it expires (s), the profile it opens, the hash it starts at, the panels it leaves out
 * and the controls it gives back (each the profile's to allow: src/share/view.ts).
 */
export interface LinkData {
  e: number;
  p: string;
  s: string;
  h?: string[];
  c?: string[];
}

const enc = new TextEncoder();
/** base64url, with what the web has (the server and the tests alike). */
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

async function hmac(key: string, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

/** Constant-time comparison, so response timing doesn't leak how much of a guess was right. */
export function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The team's cookie: a fixed message signed with the password (the value the site has used since its first version). */
export const teamToken = async (password: string) => b64(await hmac(password, 'mf-designer-v1'));

/** Deep links live in the hash, which the server never sees; the page sends it back so login returns to it. */
export const safeHash = (h: string) => (h.startsWith('#/') && h.length < 4000 && !/[\s<>"]/.test(h) ? h : '');

/** A guest link's token: its data, then its signature. */
export async function makeToken(secret: string, data: LinkData): Promise<string> {
  const body = b64(enc.encode(JSON.stringify(data)));
  return `${body}.${b64(await hmac(secret, `link:${body}`))}`;
}

/** The token's data, if its signature is the secret's (expired or not: the caller says which). */
export async function readToken(secret: string, token: string): Promise<LinkData | null> {
  const [body, mac] = token.split('.');
  if (!body || !mac || !same(mac, b64(await hmac(secret, `link:${body}`)))) return null;
  try {
    const d = JSON.parse(unb64(body)) as LinkData;
    return typeof d.e === 'number' && typeof d.p === 'string' && typeof d.s === 'string' && (d.h == null || Array.isArray(d.h)) && (d.c == null || Array.isArray(d.c)) ? d : null;
  } catch {
    return null;
  }
}

/** The guest's cookie: the link's expiry and profile, signed (another message than the link's, so one isn't the other). */
export async function guestToken(secret: string, e: number, p: string): Promise<string> {
  const body = `${e}.${p}`;
  return `${body}.${b64(await hmac(secret, `guest:${body}`))}`;
}

async function readGuest(secret: string, value: string): Promise<{ e: number; p: string } | null> {
  const [e, p, mac] = value.split('.');
  if (!e || !p || !mac || !same(mac, b64(await hmac(secret, `guest:${e}.${p}`)))) return null;
  return { e: Number(e), p };
}

export function cookieOf(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

const cookie = (name: string, value: string, maxAge: number, httpOnly = true) =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; ${httpOnly ? 'HttpOnly; ' : ''}Secure; SameSite=Lax`;
const clear = (name: string) => cookie(name, '', 0);

export const html = (body: string, status: number, headers: HeadersInit = {}) => {
  const h = new Headers(headers);
  h.set('content-type', 'text/html; charset=utf-8');
  h.set('cache-control', 'no-store');
  return new Response(body, { status, headers: h });
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const redirect = (location: string, cookies: string[]) => {
  const h = new Headers({ location });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(null, { status: 303, headers: h });
};

/** A short pause on a wrong password makes guessing slow. */
const pause = () => new Promise((r) => setTimeout(r, 600));

/** What a phone asks for by itself when the site is added to its home screen, without the browser's cookie. */
const OPEN = new Set(['/manifest.webmanifest', '/pwa/icon-180.png', '/pwa/icon-192.png', '/pwa/icon-512.png']);

/** The response for a request, or `next` to serve the site. */
export async function gate(request: Request, o: GateOptions): Promise<Response | 'next'> {
  if (!o.sitePassword) return html(messagePage(o.name, 'Set SITE_PASSWORD in the Vercel project to open this site.'), 503);
  const url = new URL(request.url);
  const now = Math.floor((o.now ?? Date.now()) / 1000);
  const team = await teamToken(o.sitePassword);
  const isTeam = (() => {
    const c = cookieOf(request, TEAM_COOKIE);
    return !!c && same(c, team);
  })();

  // Someone of the team who opened a guest link (to see it as the guest does) can go back: the page asks first.
  if (url.pathname === SESSION) return json({ team: isTeam });
  if (url.pathname === LEAVE) {
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!isTeam) return json({ error: 'Only the team leaves a guest view.' }, 403);
    const h = new Headers({ 'cache-control': 'no-store' });
    h.append('set-cookie', clear(GUEST_COOKIE));
    h.append('set-cookie', clear(VIEW_COOKIE));
    return new Response(null, { status: 204, headers: h });
  }

  if (url.pathname === LOGOUT) return redirect('/', [clear(TEAM_COOKIE), clear(GUEST_COOKIE), clear(VIEW_COOKIE)]);

  if (url.pathname === LOGIN && request.method === 'POST') {
    const form = await request.formData();
    if (!same(await teamToken(String(form.get('password') ?? '')), team)) {
      await pause();
      return html(loginPage(o.name, { error: 'Wrong password.' }), 401);
    }
    // The team's way in replaces a guest's, if this browser had one.
    return redirect('/' + safeHash(String(form.get('hash') ?? '')), [cookie(TEAM_COOKIE, team, TEAM_AGE), clear(GUEST_COOKIE), clear(VIEW_COOKIE)]);
  }

  // A new guest link: only the team makes them.
  if (url.pathname === SHARE) {
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!isTeam) return json({ error: 'Sign in with the team password first.' }, 401);
    if (!o.shareSecret) return json({ error: 'Set SHARE_SECRET in the Vercel project to make guest links.' }, 503);
    let body: { hours?: unknown; profile?: unknown; start?: unknown; hide?: unknown; allow?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'Not JSON' }, 400);
    }
    const hours = Number(body.hours);
    const profile = String(body.profile ?? '');
    if (!(LINK_HOURS as readonly number[]).includes(hours)) return json({ error: `hours: one of ${LINK_HOURS.join(', ')}` }, 400);
    if (!o.profiles.includes(profile)) return json({ error: `profile: one of ${o.profiles.join(', ')}` }, 400);
    const ids = (v: unknown) => parseHidden(Array.isArray(v) ? v.join('+') : '');
    const hide = ids(body.hide);
    const allow = ids(body.allow);
    const data: LinkData = { e: now + hours * 3600, p: profile, s: safeHash(String(body.start ?? '')), ...(hide.length ? { h: hide } : {}), ...(allow.length ? { c: allow } : {}) };
    const token = await makeToken(o.shareSecret, data);
    return json({ url: `${url.origin}${LINK}${token}`, expires: data.e * 1000 });
  }

  // A guest link: straight in, as the link's profile, until it expires.
  if (url.pathname.startsWith(LINK)) {
    const token = url.pathname.slice(LINK.length);
    const data = o.shareSecret ? await readToken(o.shareSecret, token) : null;
    if (!data || !o.profiles.includes(data.p)) return html(messagePage(o.name, "This link isn't valid. Ask whoever shared it for a new one."), 404);
    if (data.e <= now) return html(expiredPage(o.name), 410);
    const age = data.e - now;
    return redirect('/' + data.s, [cookie(GUEST_COOKIE, await guestToken(o.shareSecret!, data.e, data.p), age), cookie(VIEW_COOKIE, [data.p, data.e * 1000, ...[data.h, data.c].map((l) => parseHidden((l ?? []).join('+')).join('+'))].join('.'), age, false)]);
  }

  if (OPEN.has(url.pathname)) return 'next';
  if (isTeam) return 'next';

  const guest = cookieOf(request, GUEST_COOKIE);
  if (guest && o.shareSecret) {
    const g = await readGuest(o.shareSecret, guest);
    // A view the site no longer has (taken out of herocanvas.config.ts) isn't one to let in: the password page.
    if (g && o.profiles.includes(g.p)) {
      if (g.e > now) return 'next';
      return html(expiredPage(o.name), 410, [['set-cookie', clear(GUEST_COOKIE)], ['set-cookie', clear(VIEW_COOKIE)]]);
    }
  }
  return html(loginPage(o.name, {}), 401);
}
