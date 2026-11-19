// Proposal panel: base vs proposals, create one, edit its meta and status, and see what it changes.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useLibrary } from '../design/library';
import { ChangeBadge } from '../flow/FlowView';
import { componentKind, useGalleryNav, useGalleryRoute } from '../gallery/route';
import { useNavRoot } from '../nav/context';
import { composePages } from '../nav/manifest';
import { BASE_PAGES, HOME } from '../nav/pages';
import { chainFor, SIM_PARAMS, stackUrl, variantState } from '../nav/stack';
import { recalledAuthor, rememberAuthor } from '../persist/author';
import { useCanWrite, writeJson } from '../persist/devApi';
import { authorLetters, defaultAuthorLetters, MAX_AUTHOR_LETTERS, nextProposalCode } from '../proposals/code';
import { RETIRED_CODES } from '../proposals/retired';
import { HANDOFF_NOTES_FILE, hasProposalNotes } from '../proposals/sources';
import { loadSpecMeta, specOf, specUrl, type SpecMeta } from '../proposals/specs';
import { activeVariant, CHANGES_PARAM, findProposal, listedProposals, PROPOSALS, proposalChanges, proposalPath, SCOPE_LABEL, slugify, VARIANT_PARAM, WHERE_PARAM } from '../proposals';
import { modeOf } from '../sim/modes';
import { useUrlState } from '../sim/SimContext';
import { ARCHIVED, STATUSES, ticketUrl, type Proposal, type ProposalMeta, type ProposalStatus } from '../proposals/types';
import styles from './Panel.module.css';
import { t } from '../i18n/ui';

const field: React.CSSProperties = { width: '100%', padding: '4px 6px', border: '1px solid #dfe2e6', borderRadius: 6, font: 'inherit', fontSize: 12 };

/** A status as its dot, or an archived proposal's (its status doesn't matter while it's out of the lists). */
export function StatusDot({ status, archived = false }: { status: ProposalStatus; archived?: boolean }) {
  const s = archived ? ARCHIVED : (STATUSES.find((x) => x.id === status) ?? STATUSES[0]);
  return <span className={styles.dot} style={{ background: s.color }} title={s.label} />;
}

export function useProposalParam(): [string | null, (id: string | null) => void] {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const set = (id: string | null) => {
    // A proposal with a start page (a welcome flow) opens on it in the prototype, with only the simulator params.
    const p = findProposal(id);
    if (p?.start && modeOf(pathname) === 'prototype') {
      const pages = composePages(p);
      const { path, stack } = stackUrl(pages, chainFor(pages, { id: p.start, params: {} }, HOME));
      const q = new URLSearchParams();
      for (const k of SIM_PARAMS) {
        const v = search.get(k);
        if (v != null) q.set(k, v);
      }
      // Its first version, without the last proposal's changes on view (as below).
      for (const k of [VARIANT_PARAM, CHANGES_PARAM, WHERE_PARAM]) q.delete(k);
      q.set('proposal', p.id);
      if (stack) q.set('stack', stack);
      return navigate(`${path}?${q}`);
    }
    setSearch(
      (prev) => {
        const q = new URLSearchParams(prev);
        if (id) q.set('proposal', id);
        else q.delete('proposal');
        // Another proposal starts on its first version, and without the last one's changes on view.
        q.delete(VARIANT_PARAM);
        q.delete(CHANGES_PARAM);
        q.delete(WHERE_PARAM);
        return q;
      },
      { replace: true },
    );
  };
  return [search.get('proposal'), set];
}

export function ProposalPanel() {
  const nav = useNavRoot();
  return nav.proposal ? <ActiveProposal p={nav.proposal} /> : <BaseView />;
}

function BaseView() {
  const [, setProposal] = useProposalParam();
  // Archived proposals stay in the repository and open from a link, not from the list.
  const listed = listedProposals();
  const writable = useCanWrite();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Who is creating it: their name and their letters in the code, remembered in this browser.
  const [author, setAuthor] = useState(() => recalledAuthor().name);
  const [ownLetters, setOwnLetters] = useState(() => recalledAuthor().letters);
  const letters = authorLetters(ownLetters) || defaultAuthorLetters(author);
  const code = letters ? nextProposalCode(PROPOSALS.map((p) => p.id), letters, RETIRED_CODES) : '';
  const create = async () => {
    const folder = slugify(title);
    if (PROPOSALS.some((p) => p.folder === folder)) return setError(t('"{folder}" already exists', { folder }));
    // Its permanent reference: the author's next number (proposals/code.ts).
    const meta: ProposalMeta = { code, title: title.trim(), status: 'draft', created: new Date().toISOString().slice(0, 10), author: author.trim(), description: '' };
    rememberAuthor({ name: author.trim(), letters });
    try {
      await writeJson(proposalPath(folder, 'proposal.json'), meta);
      await writeJson(proposalPath(folder, 'config.json'), {});
      setTitle('');
      setProposal(code);
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <>
      <div className={styles.section}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '20px', marginBottom: 4 }}>{t('Live')}</div>
        <p className={styles.muted} style={{ margin: 0 }}>
          {t("What's live in the app today. Proposals add or change pages, components and screen config on top of it, without copying it.")}
        </p>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Proposals')}</div>
        {listed.length ? (
          listed.map((p) => (
            <div key={p.id} className={styles.row} style={{ paddingLeft: 4 }} onClick={() => setProposal(p.id)}>
              <StatusDot status={p.meta.status} archived={p.meta.archived} />
              <span className={`${styles.mono} ${styles.muted}`}>{p.id}</span>
              <span className={styles.name}>{p.meta.title}</span>
              <span className={styles.muted}>{p.meta.created}</span>
            </div>
          ))
        ) : (
          <span className={styles.muted}>{t('None yet')}</span>
        )}
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('New proposal')}</div>
        <input style={field} placeholder={t('Title, e.g. Project sections')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input style={field} placeholder={t('Your name')} value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input
            style={{ ...field, width: 56, flex: 'none', textAlign: 'center' }}
            placeholder={defaultAuthorLetters(author) || t('Letters')}
            title={t('Your letters in the code of your proposals (PJ-12): by default, the first letter of your name. Use two or three if someone else has the same')}
            maxLength={MAX_AUTHOR_LETTERS}
            value={ownLetters}
            onChange={(e) => setOwnLetters(authorLetters(e.target.value))}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <button className={styles.btn} disabled={!writable || !title.trim() || !code} title={writable ? t('Creates {folder}', { folder: `proposals/${slugify(title || 'proposal')}/` }) : t('Needs the dev server (npm run dev)')} onClick={create}>
            <Icon name="add" size={14} />
            {t('Create')}
          </button>
          {title.trim() && (
            <span className={`${styles.mono} ${styles.muted}`}>
              {code ? `${code} · ` : ''}
              {slugify(title)}
            </span>
          )}
        </div>
        {error && <span style={{ color: 'var(--ui-red-text)' }}>{error}</span>}
      </div>
    </>
  );
}

function ActiveProposal({ p }: { p: Proposal }) {
  const nav = useNavRoot();
  const [, setProposal] = useProposalParam();
  // Read only: its meta is edited in proposal.json, so what's shown is always what's in the repository.
  const meta = p.meta;

  const { openComponent } = useGalleryNav();
  const { name: openName } = useGalleryRoute();
  const pageIds = Object.keys(nav.pages).filter((id) => nav.change(id));
  const lib = useLibrary();
  const [variant] = useUrlState<string>(VARIANT_PARAM, '');
  const changes = proposalChanges(p, variant || null, BASE_PAGES);


  return (
    <>
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <StatusDot status={meta.status} archived={meta.archived} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>{p.meta.title}</span>
          <button className={styles.btn} onClick={() => setProposal(null)} title={t("Back to what's live")}>
            {t('Live')}
          </button>
        </div>
        <div className={styles.kv} style={{ alignItems: 'center' }}>
          <span className={styles.k} title={t("Its permanent reference: links carry it. It doesn't change when the title or the folder do")}>
            {t('Code')}
          </span>
          <span className={styles.mono}>{p.id}</span>
          <span className={styles.k}>{t('Status')}</span>
          <span>
            {(STATUSES.find((x) => x.id === meta.status) ?? STATUSES[0]).label}
            {meta.archived && ` · ${ARCHIVED.label}`}
          </span>
          {meta.ticket && (
            <>
              <span className={styles.k}>{t('Ticket')}</span>
              <a className={styles.mono} href={ticketUrl(meta.ticket)} target="_blank" rel="noreferrer">
                {meta.ticket}
              </a>
            </>
          )}
          {meta.author && (
            <>
              <span className={styles.k}>{t('Author')}</span>
              <span>{meta.author}</span>
            </>
          )}
          <span className={styles.k}>{t('Created')}</span>
          <span className={styles.mono}>{meta.created}</span>
          <span className={styles.k}>{t('Folder')}</span>
          <span className={styles.mono}>{p.folder}</span>
        </div>
        {meta.summary && <p style={{ margin: '8px 0 0', fontWeight: 600 }}>{meta.summary}</p>}
        {meta.description && <p style={{ margin: '8px 0 0', color: 'var(--ui-text-2)' }}>{meta.description}</p>}
        <p className={styles.muted} style={{ margin: '8px 0 0' }}>
          {t('Edited in code:')} <span className={styles.mono}>proposal.json</span>
        </p>
      </div>

      {p.variants.length > 0 && <Variants p={p} />}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Pages')}</div>
        {pageIds.length ? (
          pageIds.map((id) => {
            const def = nav.pages[id];
            const variant = def.variants?.()[0];
            return (
              <div key={id} className={styles.row} style={{ paddingLeft: 4 }} onClick={() => nav.open(id, variant?.params ?? {}, variant && variantState(def, variant))} title={t('Open')}>
                <ChangeBadge change={nav.change(id)!} />
                <span className={styles.name}>{def.name ?? (typeof def.title === 'string' ? def.title : id)}</span>
                <span className={styles.muted}>{!BASE_PAGES[id] ? t('new page') : p.pages[id] ? (p.config[id] ? t('page + config') : t('page')) : t('config')}</span>
              </div>
            );
          })
        ) : (
          <span className={styles.muted}>{t('No page changes yet')}</span>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Components')}</div>
        {/* What this version replaces on the screens, then the components the proposal adds (stories only). */}
        {changes.components.length ? (
          changes.components.map((c) => (
            <div
              key={c.name}
              className={`${styles.row} ${c.name === openName ? styles.current : ''}`}
              style={{ paddingLeft: 4 }}
              title={t('Open in the gallery')}
              onClick={() => openComponent(c.name)}
            >
              <ChangeBadge change={c.scope === 'added' ? 'new' : componentKind(c.name, lib)} />
              <span className={styles.name}>{c.name}</span>
              <span className={styles.muted} title={c.params?.join(', ')}>
                {SCOPE_LABEL[c.scope]}
              </span>
            </div>
          ))
        ) : (
          <span className={styles.muted}>{t('No component changes yet')}</span>
        )}
      </div>

      <SpecSection p={p} />

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Files')}</div>
        <div className={styles.mono} style={{ color: 'var(--ui-text-2)', lineHeight: '17px' }}>
          proposals/{p.folder}/
          <br />· proposal.json, config.json — {t('from the app')}
          <br />· pages.tsx — {t('new / replaced pages (code)')}
          <br />· components/ — {t('new components + stories')}
          <br />· {HANDOFF_NOTES_FILE} — {t('the specification for whoever implements it')}
          <br />· spec.json — {t('the screens and states its spec shows')}
        </div>
      </div>
    </>
  );
}

/**
 * The proposal's spec (`npm run spec`): its screens and states with pictures, their structure and its handoff, as
 * files anyone reads from a link — the developers and their agents, without the designer. Its links, or how to make it.
 */
function SpecSection({ p }: { p: Proposal }) {
  const spec = specOf(p.folder, p.id);
  const [meta, setMeta] = useState<SpecMeta | null | 'loading'>('loading');
  const [copied, setCopied] = useState<'people' | 'agents' | null>(null);
  const path = spec?.path ?? null;
  useEffect(() => {
    let live = true;
    if (!path) return setMeta(null);
    setMeta('loading');
    loadSpecMeta(path).then((m) => live && setMeta(m));
    return () => {
      live = false;
    };
  }, [path]);
  const copy = async (who: 'people' | 'agents') => {
    await navigator.clipboard.writeText(specUrl(path!, who === 'people' ? 'index.html' : 'index.md'));
    setCopied(who);
    window.setTimeout(() => setCopied(null), 1500);
  };
  const command = `npm run spec -- ${p.id}`;
  const ready = !!path && meta !== 'loading' && meta !== null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('Spec')}</div>
      <p className={styles.muted} style={{ margin: '0 0 8px', lineHeight: '16px' }}>
        {t("The proposal as files anyone opens from a link, without the designer: each screen and state in pictures, its structure (components, props, spacing, tokens) and the handoff's logic. What the developers and their agents build from.")}
      </p>
      {!hasProposalNotes(p.folder) && (
        <p style={{ margin: '0 0 8px', lineHeight: '16px', color: 'var(--ui-amber-text)' }}>
          {t('{file} is missing: the spec takes its logic from it.', { file: HANDOFF_NOTES_FILE })}
        </p>
      )}
      {!spec ? (
        <p style={{ margin: 0, lineHeight: '16px', color: 'var(--ui-amber-text)' }}>
          {t('No spec yet: list its screens and states in {file}, then run {command}.', { file: 'spec.json', command })}
        </p>
      ) : !ready ? (
        <p style={{ margin: 0, lineHeight: '16px', color: meta === 'loading' && path ? 'var(--ui-text-2)' : 'var(--ui-amber-text)' }}>
          {meta === 'loading' && path ? t('Looking for it…') : t('Not generated yet, or not published: run {command}.', { command })}
        </p>
      ) : (
        <>
          <p className={styles.muted} style={{ margin: '0 0 8px', lineHeight: '16px' }}>
            {t('{n} screens · generated {date} from version {version}. Generate it again after every change.', { n: String(spec.screens), date: meta.generated, version: meta.version })}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a className={styles.btn} href={specUrl(path, 'index.html')} target="_blank" rel="noreferrer">
              <Icon name="open_in_new" size={14} />
              {t('Open')}
            </a>
            <button className={styles.btn} onClick={() => copy('people')}>
              <Icon name={copied === 'people' ? 'check' : 'link'} size={14} />
              {copied === 'people' ? t('Copied') : t('Link for people')}
            </button>
            <button className={styles.btn} onClick={() => copy('agents')}>
              <Icon name={copied === 'agents' ? 'check' : 'smart_toy'} size={14} />
              {copied === 'agents' ? t('Copied') : t('Link for agents')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The proposal's versions: which one is on (the toolbar switches them too), what each tries and replaces. */
function Variants({ p }: { p: Proposal }) {
  const [variant, setVariant] = useUrlState<string>(VARIANT_PARAM, '');
  const on = activeVariant(p, variant)!;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {t('Versions')}
        <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          {t('{count} to compare', { count: p.variants.length })}
        </span>
      </div>
      <div className={styles.parts}>
        {p.variants.map((v, i) => (
          <button key={v.id} className={`${styles.version} ${v.id === on.id ? styles.versionOn : ''}`} role="radio" aria-checked={v.id === on.id} onClick={() => setVariant(i === 0 ? null : v.id)}>
            <span className={styles.versionKey}>{v.id.toUpperCase()}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{v.label}</span>
              {v.description && <span className={styles.muted}>{v.description}</span>}
              {v.components && <span className={`${styles.mono} ${styles.muted}`}>{Object.keys(v.components).join(', ')}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
