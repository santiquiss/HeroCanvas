// The toolbar's Share: a link to what's on screen (for the team: every state is in the URL), or a guest link, with
// its own password and an end (src/share/gate.ts makes it). Guest links are made where the door is, the production
// site: anywhere else (`npm run dev`) it offers to open this view there, its menu open.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { t } from '../i18n/ui';
import { APP_CONTROLS, DEFAULT_PERSONA, findPersona, PERSONA_PARAM, PERSONAS } from '../sim/persona';
import { PersonaPicker } from '../tools/PersonaPicker';
import { TOOLS } from '../tools/registry';
import { DEFAULT_DEVICE, DEVICES } from '../devices/devices';
import { DevicePicker } from '../sim/MultiDevices';
import { activeVariant, CHANGES_PARAM, findProposal, VARIANT_PARAM, WHERE_PARAM } from '../proposals';
import { LINK_HOURS, type ViewControl } from './profiles';
import { ALLOW_PARAM, HIDE_PARAM, PROFILES, SHARE_URL } from './view';
import styles from './ShareMenu.module.css';

/** In the hash's query: open Share's guest link on arrival (from "Make it on the production site"). */
const OPEN_PARAM = 'share';

type Made = { url: string; expires: number };
type State = { kind: 'idle' } | { kind: 'making' } | { kind: 'made'; made: Made } | { kind: 'elsewhere' } | { kind: 'error'; message: string };

/** The URL's hash as its route and its params (the designer's home has none yet: `#/`). */
function hashParts(): [string, URLSearchParams] {
  const [path, query = ''] = (window.location.hash || '#/').split('?');
  return [path, new URLSearchParams(query)];
}

/** The persona on screen (Scenarios'), by id. */
const currentPersona = () => findPersona(hashParts()[1].get(PERSONA_PARAM))?.id;
/** The device on screen (a set's: its first), by id. */
const currentDevice = () => {
  const id = hashParts()[1].get('device');
  return DEVICES.some((d) => d.id === id) ? id! : DEFAULT_DEVICE;
};
/** The proposal on screen (and its version), if any. */
function currentProposal() {
  const q = hashParts()[1];
  const p = findProposal(q.get('proposal'));
  if (!p) return null;
  const v = activeVariant(p, q.get(VARIANT_PARAM));
  return { p, label: v && p.variants.length > 1 ? `${p.id} · ${v.id.toUpperCase()} ${v.label}` : `${p.id} · ${p.meta.title}` };
}
/** What a proposal brings with it in the URL: its version, and its changes outlined. */
const PROPOSAL_PARAMS = ['proposal', VARIANT_PARAM, CHANGES_PARAM, WHERE_PARAM];

/** What a device brings with it in the URL: its display, landscape, a set or Compare. */
const DEVICE_PARAMS = ['device', 'display', 'land', 'devices', 'compare'];

/** A control a link can give back, as its checkbox says it. */
const ALLOW_LABEL: Partial<Record<ViewControl, string>> = {
  devices: t('Let them change the device'),
  compare: t('Let them compare devices'),
  zoom: t('Let them zoom'),
  inspect: t('Let them inspect components'),
  comments: t('Let them see and leave comments'),
  proposals: t('Let them switch proposals'),
};

/**
 * Where the guest starts: this screen as it is (its device, theme, proposal, what Scenarios changed), or the app's
 * first screen; as `persona`, either way. Another persona than the one on screen comes with their own values for the
 * app's controls (what was changed here goes), as picking them in Scenarios does.
 */
function startOf(onScreen: boolean, persona: string | undefined, device: string, live = false): string {
  const [path, here] = hashParts();
  const q = onScreen ? here : new URLSearchParams();
  // The proposal on screen, or Live: the app as it is. A screen only the proposal adds isn't in Live: its first one.
  const proposal = here.get('proposal') ? PROPOSAL_PARAMS.map((k) => [k, here.get(k)] as const) : [];
  for (const k of PROPOSAL_PARAMS) q.delete(k);
  if (!live) for (const [k, v] of proposal) if (v) q.set(k, v);
  for (const k of [OPEN_PARAM, 'view', HIDE_PARAM, ALLOW_PARAM]) q.delete(k);
  // On a computer, the device they see; a phone shows the app on its own screen (Real mode) and leaves it.
  if (device !== currentDevice()) for (const k of DEVICE_PARAMS) q.delete(k);
  if (device === DEFAULT_DEVICE) q.delete('device');
  else q.set('device', device);
  if (persona !== currentPersona()) for (const c of APP_CONTROLS) q.delete(c.param);
  if (!persona || persona === DEFAULT_PERSONA) q.delete(PERSONA_PARAM);
  else q.set(PERSONA_PARAM, persona);
  const rest = q.toString();
  return (onScreen ? path : '#/') + (rest ? `?${rest}` : '');
}

/** `hash` with more params. */
const withParams = (hash: string, params: Record<string, string>) => {
  const [path, query = ''] = hash.split('?');
  const q = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return `${path}?${q}`;
};

const HOURS_LABEL: Record<number, string> = { 1: t('1 hour'), 24: t('24 hours'), 168: t('7 days') };

export const formatUntil = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function ShareMenu() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').has(OPEN_PARAM));
  const [copied, setCopied] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(24);
  const ids = Object.keys(PROFILES);
  const [profile, setProfile] = useState(ids[0]);
  const [state, setState] = useState<State>({ kind: 'idle' });
  // Who the guest sees the app as, and where they start: this screen, as whoever is on it now (when the menu opens).
  const [persona, setPersona] = useState(currentPersona);
  const [onScreen, setOnScreen] = useState(true);
  // The view's panels a link may leave out, each shown unless unchecked.
  const optional = PROFILES[profile].optional ?? [];
  const [hidden, setHidden] = useState<string[]>([]);
  const hide = hidden.filter((id) => optional.includes(id));
  // The controls it can give back, each off unless checked.
  const extra = PROFILES[profile].extra ?? [];
  const [allowed, setAllowed] = useState<ViewControl[]>([]);
  const allow = allowed.filter((c) => extra.includes(c));
  const [device, setDevice] = useState(currentDevice);
  useEffect(() => {
    if (!open) return;
    setPersona(currentPersona());
    setDevice(currentDevice());
  }, [open]);
  // Inside a proposal: share it (as default) or Live.
  const [live, setLive] = useState(false);
  const proposal = open ? currentProposal() : null;
  useEffect(() => {
    if (open) setLive(false);
  }, [open]);
  const start = startOf(onScreen, persona, device, live);
  const root = useRef<HTMLDivElement>(null);

  // Arrived from another copy to make a guest link: the menu opens, the param leaves the URL.
  useEffect(() => {
    if (!open) return;
    const [path, query = ''] = window.location.hash.split('?');
    const q = new URLSearchParams(query);
    if (!q.has(OPEN_PARAM)) return;
    q.delete(OPEN_PARAM);
    const rest = q.toString();
    history.replaceState(null, '', path + (rest ? `?${rest}` : ''));
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = (what: string, text: string) => navigator.clipboard.writeText(text).then(() => setCopied(what));

  const make = async () => {
    setState({ kind: 'making' });
    try {
      const res = await fetch('/__share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hours, profile, start, hide, allow }) });
      // No door here (the dev server, a copy hosted without it): the production site makes them.
      if (!(res.headers.get('content-type') ?? '').includes('application/json')) return setState({ kind: 'elsewhere' });
      const body = (await res.json()) as Partial<Made> & { error?: string };
      if (!res.ok || !body.url || !body.expires) return setState({ kind: 'error', message: body.error ?? t("Couldn't make the link.") });
      setState({ kind: 'made', made: body as Made });
    } catch {
      setState({ kind: 'elsewhere' });
    }
  };

  // What to send the guest, in one paste.
  // What to send the guest, in one paste: the link and until when it works.
  const message = (m: Made) => [m.url, t('Works until {until}.', { until: formatUntil(m.expires) })].join('\n');

  return (
    <div ref={root} className={styles.root}>
      <button className={styles.share} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" title={t('Share this view')} data-tour="share">
        <Icon name="link" size={18} />
        {t('Share')}
      </button>
      {open && (
        <div className={styles.menu} role="dialog" aria-label={t('Share')}>
          {/* The team's link: what's on screen, for anyone with the team's password. */}
          <button className={styles.row} onClick={() => copy('view', window.location.href)}>
            <Icon name={copied === 'view' ? 'check' : 'link'} size={18} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{copied === 'view' ? t('Link copied') : t('Copy link')}</span>
              <span className={styles.rowHint}>{t('For the team: opens this same view')}</span>
            </span>
          </button>
          <div className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.head}>
              <Icon name="person_add" size={18} />
              <span className={styles.rowTitle}>{t('Guest link')}</span>
            </div>
            <p className={styles.hint}>{t('Anyone with the link sees this screen, without the team’s tools, until it expires.')}</p>
            {state.kind === 'made' ? (
              <>
                <Field label={t('Link')} value={state.made.url} copied={copied === 'url'} onCopy={() => copy('url', state.made.url)} />
                <p className={styles.hint}>{t('Works until {until}.', { until: formatUntil(state.made.expires) })}</p>
                <div className={styles.actions}>
                  <button className={styles.secondary} onClick={() => setState({ kind: 'idle' })}>
                    {t('New link')}
                  </button>
                  <button className={styles.primary} onClick={() => copy('both', message(state.made))}>
                    <Icon name={copied === 'both' ? 'check' : 'content_copy'} size={16} />
                    {copied === 'both' ? t('Copied') : t('Copy message')}
                  </button>
                </div>
              </>
            ) : state.kind === 'elsewhere' ? (
              <>
                <p className={styles.hint}>{t('Guest links are made on the production site, where they’re checked.')}</p>
                {SHARE_URL ? (
                  <a className={styles.primary} href={`${SHARE_URL.replace(/\/$/, '')}/${withParams(startOf(true, currentPersona(), currentDevice()), { [OPEN_PARAM]: '1' })}`} target="_blank" rel="noreferrer">
                    <Icon name="open_in_new" size={16} />
                    {t('Make it on the production site')}
                  </a>
                ) : (
                  <p className={styles.hint}>{t('Set its address in herocanvas.config.ts (share.url) to go there from here.')}</p>
                )}
              </>
            ) : (
              <>
                {ids.length > 1 && (
                  <label className={styles.label}>
                    {t('What they see')}
                    <select className={styles.select} value={profile} onChange={(e) => setProfile(e.target.value)}>
                      {ids.map((id) => (
                        <option key={id} value={id}>
                          {PROFILES[id].label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {proposal && (
                  <div className={styles.label}>
                    {t('Design')}
                    <div className={styles.segments} role="radiogroup" aria-label={t('Design')}>
                      <button role="radio" aria-checked={!live} className={!live ? styles.on : ''} onClick={() => setLive(false)} title={proposal.label}>
                        <span className={styles.ellipsis}>{proposal.label}</span>
                      </button>
                      <button role="radio" aria-checked={live} className={live ? styles.on : ''} onClick={() => setLive(true)} title={t('The app as it is')}>
                        {t('Live')}
                      </button>
                    </div>
                  </div>
                )}
                {PERSONAS.length > 0 && persona && (
                  <div className={styles.label}>
                    {t('As')}
                    <PersonaPicker persona={findPersona(persona)!} onPick={setPersona} />
                  </div>
                )}
                <div className={styles.label}>
                  {t('On a computer, on')}
                  <DevicePicker className={styles.device} value={device} title={t('Device')} onPick={setDevice}>
                    <Icon name={DEVICES.find((d) => d.id === device)!.type === 'tablet' ? 'tablet' : 'smartphone'} size={16} />
                    <span className={styles.deviceName}>{DEVICES.find((d) => d.id === device)!.name}</span>
                    <Icon name="expand_more" size={16} />
                  </DevicePicker>
                  <span className={styles.rowHint}>{t('On a phone, the app fills its screen.')}</span>
                </div>
                <label className={styles.check}>
                  <input type="checkbox" checked={onScreen} onChange={(e) => setOnScreen(e.target.checked)} />
                  <span>
                    {t('Start on this screen')}
                    <span className={styles.rowHint}>{onScreen ? t('As it is now, with its theme') : t('The app’s first screen')}</span>
                  </span>
                </label>
                {optional.map((id) => {
                  const tool = TOOLS.find((x) => x.id === id);
                  return (
                    <label key={id} className={styles.check}>
                      <input type="checkbox" checked={!hidden.includes(id)} onChange={(e) => setHidden((h) => (e.target.checked ? h.filter((x) => x !== id) : [...h, id]))} />
                      <span>{t('Show {panel}', { panel: tool?.title ?? id })}</span>
                    </label>
                  );
                })}
                {extra.map((c) => (
                  <label key={c} className={styles.check}>
                    <input type="checkbox" checked={allowed.includes(c)} onChange={(e) => setAllowed((a) => (e.target.checked ? [...a, c] : a.filter((x) => x !== c)))} />
                    <span>{ALLOW_LABEL[c] ?? c}</span>
                  </label>
                ))}
                <div className={styles.label}>
                  {t('Expires in')}
                  <div className={styles.segments} role="radiogroup" aria-label={t('Expires in')}>
                    {LINK_HOURS.map((h) => (
                      <button key={h} role="radio" aria-checked={hours === h} className={hours === h ? styles.on : ''} onClick={() => setHours(h)}>
                        {HOURS_LABEL[h]}
                      </button>
                    ))}
                  </div>
                </div>
                {state.kind === 'error' && <p className={styles.error}>{state.message}</p>}
                <div className={styles.actions}>
                  <a className={styles.secondary} href={`${window.location.pathname}${withParams(start, { view: profile, [HIDE_PARAM]: hide.join('+'), [ALLOW_PARAM]: allow.join('+') })}`} target="_blank" rel="noreferrer" title={t('Opens this view as a guest sees it, in a new tab')}>
                    {t('Preview')}
                  </a>
                  <button className={styles.primary} onClick={make} disabled={state.kind === 'making'}>
                    {state.kind === 'making' ? t('Making…') : t('Make guest link')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className={styles.label}>
      {label}
      <div className={styles.field}>
        <input className={styles.input} value={value} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button className={styles.copy} onClick={onCopy} title={t('Copy')} aria-label={t('Copy')}>
          <Icon name={copied ? 'check' : 'content_copy'} size={16} />
        </button>
      </div>
    </div>
  );
}
