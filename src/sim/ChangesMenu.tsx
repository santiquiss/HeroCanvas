// What the active proposal (in its version) changes, from the toolbar: a chip counting changes in the colors of change
// (design/changes) that opens a popover listing them — pages new, changed or removed (and what: the screen, its fields,
// its layout rules), components changed (by this version or all) — each with its type's icon in the color of its
// change and a way to go see it: Open a page, every place a component is (WhereRail, beside the canvas). HighlightButton,
// beside Inspect, outlines them on the screens (`?changes=1`).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { ChangeCounts, CHANGE_ORDER, changeCounts } from '../design/ChangeCounts';
import { CHANGE, HIGHLIGHT, type ChangeKind } from '../design/changes';
import { componentKind, useGalleryNav } from '../gallery/route';
import { useNavRoot } from '../nav/context';
import { BASE_PAGES } from '../nav/pages';
import { pageIcon, pageName, variantState } from '../nav/stack';
import { stepState } from '../nav/flow';
import { CHANGES_ALL, CHANGES_PARAM, PROPOSALS, proposalChanges, SCOPE_LABEL, VARIANT_PARAM, WHERE_PARAM } from '../proposals';
import type { PageDef } from '../nav/types';
import { useMode, useSetMode } from './modes';
import { usePageIndex, useScanProgress } from './pageIndex';
import { ProgressLine, Spinner } from '../components/Loading';
import { useUrlPatch, useUrlState } from './SimContext';
import { plural, t } from '../i18n/ui';
import styles from './Toolbar.module.css';

export function ChangesMenu({ proposalId }: { proposalId: string | null }) {
  const p = PROPOSALS.find((x) => x.id === proposalId);
  const [variant] = useUrlState<string>(VARIANT_PARAM, '');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const nav = useNavRoot();
  const patch = useUrlPatch();
  const { openComponent } = useGalleryNav();
  const mode = useMode();
  const setMode = useSetMode();
  // Where the changed components are: built ahead, in idle time, once a proposal is on (or now, if it's opened first).
  const index = usePageIndex(proposalId ?? 'live', open || (proposalId ? 'idle' : false));
  const scanning = useScanProgress(proposalId ?? 'live');

  // Listeners only while open.
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

  if (!p) return null;
  const c = proposalChanges(p, variant || null, BASE_PAGES);
  const count = changeCounts(c);
  // New first, then changed, then removed.
  const pages = [...c.pages].sort((a, b) => CHANGE_ORDER.indexOf(a.kind) - CHANGE_ORDER.indexOf(b.kind));
  const total = count.changed + count.new + count.removed;

  // Every place a component is, in a rail beside the canvas (WhereRail), with it highlighted: in the prototype, so
  // from Components or Flow it goes back there.
  const showAll = (name: string) => {
    const show = { [WHERE_PARAM]: name, [CHANGES_PARAM]: name };
    if (mode === 'prototype') patch(show);
    else setMode('prototype', show);
    setOpen(false);
  };

  return (
    <div ref={root} className={styles.changes}>
      <button className={`${styles.chip} ${open ? styles.chipOpen : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={t('What this proposal changes')}>
        <Icon name="difference" size={18} />
        {total ? <ChangeCounts counts={count} /> : <span>{t('No changes')}</span>}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label={t('What changes')}>
          <div className={styles.popHead}>{t('What changes')}</div>
          {p.meta.summary?.trim() && <p className={styles.popSummary}>{p.meta.summary.trim()}</p>}
          {/* Where the components are is still being found: how far along. */}
          {!index && c.components.length > 0 && (
            <div className={styles.popScan}>
              <span className={styles.popMuted}>{t("Finding where they're used")}{scanning != null ? ` · ${Math.round(scanning * 100)}%` : '…'}</span>
              <ProgressLine value={scanning ?? 0} />
            </div>
          )}
          {!total && <p className={styles.popMuted}>{t('Nothing changes yet: add pages or components to the proposal.')}</p>}
          {pages.length > 0 && (
            <Section title={t('Pages')} count={pages.length}>
              {pages.map((pg) => {
                const def = (nav.pages[pg.id] ?? BASE_PAGES[pg.id]) as PageDef | undefined;
                return (
                  <Item
                    key={pg.step ? `${pg.id}:${pg.step.id}` : pg.id}
                    icon={pageIcon(def)}
                    kind={pg.kind}
                    name={pg.step ? `${pageName({ ...BASE_PAGES, ...nav.pages }, pg.id)} › ${pg.step.label}` : pageName({ ...BASE_PAGES, ...nav.pages }, pg.id)}
                    // A removed page is only in Live: nothing to open.
                    details={pg.kind === 'removed' ? [...pg.details, t('Only in Live')] : pg.details}
                    title={t('Open it on the device')}
                    onClick={
                      pg.kind === 'removed'
                        ? undefined
                        : () => {
                            const step = pg.step && def?.flow?.steps.find((st) => st.id === pg.step!.id);
                            if (step && def) nav.open(pg.id, {}, stepState(def, step));
                            else nav.open(pg.id, def?.variants?.()[0]?.params ?? {}, def && def.variants?.()[0] ? variantState(def, def.variants()[0]) : undefined);
                            setOpen(false);
                          }
                    }
                  />
                );
              })}
            </Section>
          )}
          {c.components.length > 0 && (
            <Section title={t('Components')} count={c.components.length}>
              {c.components.map((cm) => {
                const where = index?.[cm.name] ?? [];
                const onPages = new Set(where.map((w) => w.id)).size;
                const found = !index || where.length > 0;
                return (
                  <Item
                    key={cm.name}
                    icon="widgets"
                    kind={cm.scope === 'added' ? 'new' : componentKind(cm.name)}
                    name={cm.name}
                    details={[
                      `${SCOPE_LABEL[cm.scope].replace(/^./, (ch) => ch.toUpperCase())}${cm.params ? `: ${cm.params.join(', ')}` : ''}${cm.note ? ` · ${cm.note}` : ''}`,
                      ...(found ? [] : [t('Not on a page as it loads (a sheet, a dialog, a state)')]),
                    ]}
                    // The card: every place it's on, in the rail beside the canvas (it says "Finding…" while the scan runs).
                    meta={
                      !index ? (
                        <>
                          <Spinner size={11} /> {t('Finding')}
                        </>
                      ) : found ? plural(onPages, '{n} page', '{n} pages') + (where.length > onPages ? ` · ${plural(where.length, '{n} screen', '{n} screens')}` : '') : undefined
                    }
                    title={t("See every place it's on, beside the canvas")}
                    onClick={found ? () => showAll(cm.name) : undefined}
                    secondary={{
                      label: t('Components'),
                      title: t('Open it in Components (the gallery)'),
                      onClick: () => {
                        openComponent(cm.name);
                        setOpen(false);
                      },
                    }}
                  />
                );
              })}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className={styles.popSection}>
      <span className={styles.popTitle}>
        {title}
        <span className={styles.popTitleCount}>{count}</span>
      </span>
      {children}
    </section>
  );
}

interface ItemProps {
  icon: string;
  kind: ChangeKind;
  name: string;
  details: string[];
  /** Beside the chevron: where the card's action leads ("6 pages · 11 screens"). */
  meta?: ReactNode;
  /** The card's own action (a page: open it; a component: where it is). */
  onClick?: () => void;
  title?: string;
  /** A second action, a small button inside the card. */
  secondary?: { label: string; title: string; onClick: () => void };
}

/**
 * One change, as a small card: the item's type as an icon in the color of its change, what it is and what changed.
 * The card is its main action; a second one is a small button inside it (the card can't be a <button> holding one).
 */
function Item({ icon, kind, name, details, meta, onClick, title, secondary }: ItemProps) {
  const act = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        title,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onClick();
        },
      }
    : {};
  return (
    <div className={`${styles.popRow} ${onClick ? styles.popRowAct : ''}`} {...act}>
      <span className={styles.popIcon} style={{ background: CHANGE[kind].soft, color: CHANGE[kind].text }}>
        <Icon name={icon} size={16} />
      </span>
      <span className={styles.popText}>
        <span className={styles.popLine}>
          <span className={styles.popName}>{name}</span>
          <span className={styles.popKind} style={{ color: CHANGE[kind].text }}>
            {CHANGE[kind].label}
          </span>
          {(meta || onClick) && (
            <span className={styles.popMeta}>
              {meta}
              {onClick && <Icon name="chevron_right" size={18} />}
            </span>
          )}
        </span>
        {details.map((d) => (
          <span key={d} className={styles.popMuted}>
            {d}
          </span>
        ))}
        {secondary && (
          <button
            className={styles.popSecondary}
            title={secondary.title}
            onClick={(e) => {
              e.stopPropagation();
              secondary.onClick();
            }}
          >
            {secondary.label}
            <Icon name="arrow_forward" size={14} />
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * Outline what the proposal changes on the screens (`?changes=1`): beside Inspect, only with a proposal on. In the
 * highlight's color (outlined off, filled on) with a checkbox in it: it reads as a switch for what's on the screens.
 */
export function HighlightButton({ proposalId }: { proposalId: string | null }) {
  const [highlight, setHighlight] = useUrlState<string>(CHANGES_PARAM, '');
  if (!PROPOSALS.some((p) => p.id === proposalId)) return null;
  // On for everything or for one component (from the where-used rail); a tap turns it off either way.
  const on = !!highlight;
  const colors = { '--hl': HIGHLIGHT, '--hl-soft': CHANGE.changed.soft, '--hl-text': CHANGE.changed.text } as CSSProperties;
  return (
    <button
      className={`${styles.chip} ${styles.highlight} ${on ? styles.highlightOn : ''}`}
      style={colors}
      onClick={() => setHighlight(on ? null : CHANGES_ALL)}
      title={t('Outline what this proposal changes on the screens')}
      aria-pressed={on}
    >
      <span className={styles.check} aria-hidden>
        {on && <Icon name="check" size={13} />}
      </span>
      {t('Highlight changes')}
    </button>
  );
}
