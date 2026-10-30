import { describe, expect, it } from 'vitest';
// The browser stand-in (happy-dom) drops set-cookie from a Response, as a browser does: the guest's cookie is made
// here with the server's own function.
import { gate, guestToken, makeToken, readToken, teamToken, type GateOptions } from './gate';

const NOW = Date.UTC(2026, 9, 29, 12);
const opts: GateOptions = { name: 'Studio', sitePassword: 'team-pass', shareSecret: 'secret', profiles: ['simple'], now: NOW };
const at = (ms: number): GateOptions => ({ ...opts, now: ms });
const BASE = 'https://studio.example';

/** A request with a cookie: the stand-in's Request drops the header (a browser's can't set it), its Headers keep it. */
const req = (path: string, init: RequestInit & { cookie?: string } = {}): Request => {
  const r = new Request(BASE + path, init);
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  return new Proxy(r, {
    get: (target, key) => {
      if (key === 'headers') return headers;
      const v = Reflect.get(target, key, target) as unknown;
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
};
const form = (fields: Record<string, string>) => {
  const body = new URLSearchParams(fields);
  return { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } };
};
const asResponse = (out: Response | 'next') => {
  if (out === 'next') throw new Error('expected a response');
  return out;
};

async function teamCookie() {
  return `mfd_auth=${await teamToken('team-pass')}`;
}

async function makeLink(hours = 24, o = opts) {
  const res = asResponse(await gate(req('/__share', { method: 'POST', cookie: await teamCookie(), body: JSON.stringify({ hours, profile: 'simple', start: '#/today?device=iphone-16' }) }), o));
  expect(res.status).toBe(200);
  return (await res.json()) as { url: string; expires: number };
}

describe('gate', () => {
  it('keeps the team cookie of the site before it (same value, no one signed out)', async () => {
    // The previous middleware's: HMAC-SHA256 of 'mf-designer-v1' keyed by the password, base64url.
    // (Node's createHmac('sha256', 'team-pass').update('mf-designer-v1').digest('base64url').)
    expect(await teamToken('team-pass')).toBe('L_OypwTjyNVC1SAsG930RrCEp05bbVfujJM3AU5gQQs');
  });

  it('closes the site without SITE_PASSWORD, and asks for it without the cookie', async () => {
    expect(asResponse(await gate(req('/'), { ...opts, sitePassword: undefined })).status).toBe(503);
    expect(asResponse(await gate(req('/'), opts)).status).toBe(401);
    expect(await gate(req('/', { cookie: await teamCookie() }), opts)).toBe('next');
  });

  it('only the team makes guest links, and only with SHARE_SECRET', async () => {
    const body = JSON.stringify({ hours: 24, profile: 'simple', start: '' });
    expect(asResponse(await gate(req('/__share', { method: 'POST', body }), opts)).status).toBe(401);
    expect(asResponse(await gate(req('/__share', { method: 'POST', body, cookie: await teamCookie() }), { ...opts, shareSecret: undefined })).status).toBe(503);
    expect(asResponse(await gate(req('/__share', { method: 'POST', cookie: await teamCookie(), body: JSON.stringify({ hours: 5, profile: 'simple' }) }), opts)).status).toBe(400);
    expect(asResponse(await gate(req('/__share', { method: 'POST', cookie: await teamCookie(), body: JSON.stringify({ hours: 24, profile: 'everything' }) }), opts)).status).toBe(400);
  });

  it('lets a guest in with the link alone, as its profile, starting where it was made', async () => {
    const link = await makeLink();
    expect(link.expires).toBe(NOW + 24 * 3600 * 1000);
    expect(link).not.toHaveProperty('password');
    const ok = asResponse(await gate(req(new URL(link.url).pathname), opts));
    expect(ok.status).toBe(303);
    expect(ok.headers.get('location')).toBe('/#/today?device=iphone-16');
    const guest = `hc_guest=${await guestToken('secret', link.expires / 1000, 'simple')}`;
    expect(await gate(req('/', { cookie: guest }), opts)).toBe('next');
    expect(asResponse(await gate(req('/', { cookie: `hc_guest=${await guestToken('secret', link.expires / 1000, 'other')}` }), opts)).status).toBe(401);
  });

  it('ends at its time: the link, and the guest already in', async () => {
    const link = await makeLink(1);
    const path = new URL(link.url).pathname;
    const guest = `hc_guest=${await guestToken('secret', link.expires / 1000, 'simple')}`;
    const later = at(NOW + 3600 * 1000 + 1000);
    expect(asResponse(await gate(req(path), later)).status).toBe(410);
    expect(asResponse(await gate(req('/', { cookie: guest }), later)).status).toBe(410);
  });

  it('refuses a link or a cookie that was changed, or signed with another secret', async () => {
    const link = await makeLink(1);
    const token = new URL(link.url).pathname.slice('/__s/'.length);
    const data = (await readToken('secret', token))!;
    // A week instead of an hour, the signature left as it was.
    const [, mac] = token.split('.');
    const longer = (await makeToken('other', { ...data, e: data.e + 7 * 24 * 3600 })).split('.')[0] + '.' + mac;
    expect(asResponse(await gate(req('/__s/' + longer), opts)).status).toBe(404);
    expect(asResponse(await gate(req('/__s/' + token), { ...opts, shareSecret: 'rotated' })).status).toBe(404);
    expect(asResponse(await gate(req('/', { cookie: `hc_guest=${data.e + 999999}.simple.${mac}` }), opts)).status).toBe(401);
  });

  it('carries the panels a link leaves out and the controls it gives back, and nothing that isn’t a panel id', async () => {
    const res = asResponse(await gate(req('/__share', { method: 'POST', cookie: await teamCookie(), body: JSON.stringify({ hours: 24, profile: 'simple', start: '', hide: ['pages', '<script>'], allow: ['devices'] }) }), opts));
    const { url } = (await res.json()) as { url: string };
    const data = await readToken('secret', new URL(url).pathname.slice('/__s/'.length));
    expect(data?.h).toEqual(['pages']);
    expect(data?.c).toEqual(['devices']);
  });

  it('lets someone of the team back out of a guest view, and no guest', async () => {
    const guest = `hc_guest=${await guestToken('secret', NOW / 1000 + 3600, 'simple')}`;
    const both = `${await teamCookie()}; ${guest}`;
    expect(await (asResponse(await gate(req('/__session', { cookie: both }), opts))).json()).toEqual({ team: true });
    expect(await (asResponse(await gate(req('/__session', { cookie: guest }), opts))).json()).toEqual({ team: false });
    expect(asResponse(await gate(req('/__leave', { method: 'POST', cookie: both }), opts)).status).toBe(204);
    expect(asResponse(await gate(req('/__leave', { method: 'POST', cookie: guest }), opts)).status).toBe(403);
  });

  it('signs the team in, back to the hash it came from', async () => {
    const res = asResponse(await gate(req('/__login', form({ password: 'team-pass', hash: '#/today' })), opts));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/#/today');
    expect(asResponse(await gate(req('/__login', form({ password: 'nope' })), opts)).status).toBe(401);
  });
});
