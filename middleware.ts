// The deployed site's door (Vercel Routing Middleware; `npm run dev` is not affected): the team's password
// (SITE_PASSWORD), or a guest link and its password (SHARE_SECRET signs them). How it works: src/share/gate.ts.
// Vercel runs it as files of their own, not a bundle: each import names its file as it runs (`.js`), as Node needs.
import { next } from '@vercel/functions';
import hc from './herocanvas.config.js';
import { gate } from './src/share/gate.js';
import { profilesOf } from './src/share/profiles.js';

export const config = { runtime: 'nodejs' };

const profiles = Object.keys(profilesOf(hc.share?.profiles));

export default async function middleware(request: Request) {
  const out = await gate(request, { name: hc.name, sitePassword: process.env.SITE_PASSWORD, shareSecret: process.env.SHARE_SECRET, profiles });
  return out === 'next' ? next() : out;
}
