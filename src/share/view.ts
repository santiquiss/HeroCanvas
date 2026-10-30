// The view this browser shows (src/share/profiles.ts): a guest's, from the cookie their link set (src/share/gate.ts),
// or one tried with `?view=<profile>` (kept for the tab until `?view=full`), as on `npm run dev`, where there's no
// door. Read once when the designer loads: a link opens a new page, so it never changes while one is open.
import { parseHidden, profilesOf, type ViewControl, type ViewProfile } from './profiles';

export const PROFILES: Record<string, ViewProfile> = profilesOf(__HC_SHARE__.profiles);

/** The production site's address (herocanvas.config.ts `share.url`): where guest links are made. */
export const SHARE_URL: string | null = __HC_SHARE__.url;

export interface View {
  id: string;
  profile: ViewProfile;
  /** When the guest's link ends (ms); null for a view tried with `?view=`. */
  expires: number | null;
  /** Of the profile's optional panels, those this link leaves out (`?view-hide=pages`). */
  hidden: string[];
  /** Of the profile's extra controls, those this link gives back (`?view-allow=devices`). */
  allowed: ViewControl[];
}

/** The URL's params for the panels a tried view leaves out and the controls it gives back. */
export const HIDE_PARAM = 'view-hide';
export const ALLOW_PARAM = 'view-allow';

/** The link's extra controls the profile allows: no other. */
const allowedOf = (profile: ViewProfile, raw: string | null | undefined) => parseHidden(raw).filter((c): c is ViewControl => (profile.extra ?? []).includes(c as ViewControl));

const KEY = 'hc.view';
const HIDE_KEY = 'hc.view.hide';
const ALLOW_KEY = 'hc.view.allow';

function fromCookie(): View | null {
  const raw = typeof document === 'undefined' ? '' : (document.cookie.split('; ').find((c) => c.startsWith('hc_view=')) ?? '');
  const [id, expires, hidden, allowed] = raw.slice('hc_view='.length).split('.');
  const profile = PROFILES[id];
  return profile && Number(expires) > 0 ? { id, profile, expires: Number(expires), hidden: parseHidden(hidden), allowed: allowedOf(profile, allowed) } : null;
}

function tried(): View | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const asked = q.get('view');
    if (asked === 'full') {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(HIDE_KEY);
      sessionStorage.removeItem(ALLOW_KEY);
      q.delete(HIDE_PARAM);
      q.delete(ALLOW_PARAM);
      // Back to the whole designer: the param did its job, it leaves the URL.
      q.delete('view');
      const rest = q.toString();
      history.replaceState(null, '', window.location.hash.split('?')[0] + (rest ? `?${rest}` : ''));
    }
    else if (asked && PROFILES[asked]) {
      sessionStorage.setItem(KEY, asked);
      sessionStorage.setItem(HIDE_KEY, parseHidden(q.get(HIDE_PARAM)).join('+'));
      sessionStorage.setItem(ALLOW_KEY, parseHidden(q.get(ALLOW_PARAM)).join('+'));
    }
    const id = sessionStorage.getItem(KEY);
    if (!id || !PROFILES[id]) return null;
    return { id, profile: PROFILES[id], expires: null, hidden: parseHidden(sessionStorage.getItem(HIDE_KEY)), allowed: allowedOf(PROFILES[id], sessionStorage.getItem(ALLOW_KEY)) };
  } catch {
    return null;
  }
}

/** The view in use; null: the whole designer. */
export const VIEW: View | null = fromCookie() ?? tried();

// A `?view=` added to the URL of an open page (typed, or a link to the same page) changes only its hash, so the page
// doesn't load again: it reloads, to read it. A guest's view is the cookie's, whatever the URL says.
if (typeof window !== 'undefined' && !VIEW?.expires) {
  window.addEventListener('hashchange', () => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const asked = q.get('view');
    const hidden = parseHidden(q.get(HIDE_PARAM)).join('+');
    const allowed = parseHidden(q.get(ALLOW_PARAM)).join('+');
    const changed = !VIEW || asked !== VIEW.id || hidden !== VIEW.hidden.join('+') || allowed !== VIEW.allowed.join('+');
    if ((asked === 'full' && VIEW) || (asked && asked !== 'full' && PROFILES[asked] && changed)) window.location.reload();
  });
}

/**
 * Back to the whole designer: a view tried with `?view=` drops it; a guest's (a link's cookie) only with the team's
 * password too, which the server checks (src/share/gate.ts). False when it can't (a guest).
 */
export async function leaveView(): Promise<boolean> {
  if (!VIEW) return false;
  if (VIEW.expires == null) {
    const [path, query = ''] = window.location.hash.split('?');
    const q = new URLSearchParams(query);
    q.set('view', 'full');
    window.location.hash = `${path}?${q}`;
    window.location.reload();
    return true;
  }
  try {
    const res = await fetch('/__leave', { method: 'POST' });
    if (!res.ok) return false;
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser has the team's password (asked once, only in a guest's view: anyone else is the team). */
let team: Promise<boolean> | null = null;
export function isTeam(): Promise<boolean> {
  if (!VIEW?.expires) return Promise.resolve(true);
  team ??= fetch('/__session')
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : { team: false }))
    .then((b: { team?: boolean }) => !!b.team)
    .catch(() => false);
  return team;
}

/** Whether the view keeps a control (always, with the whole designer). */
export const can = (c: ViewControl): boolean => !VIEW || VIEW.profile.controls.includes(c) || VIEW.allowed.includes(c);
export const showsMode = (mode: string): boolean => !VIEW || VIEW.profile.modes.includes(mode);
export const showsTool = (id: string): boolean => !VIEW || (VIEW.profile.tools.includes(id) && !VIEW.hidden.includes(id));
