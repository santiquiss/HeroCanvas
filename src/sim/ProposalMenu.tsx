// The toolbar's design picker: Live, or a proposal (`?proposal=`). A dropdown of its own (not the browser's) so each
// proposal shows what it is before it's picked, as a table: its code, its title (how many versions) over its summary,
// its status, who made it and when; the picked one checked at the left. Newest first; the archived ones behind a switch at the bottom (they still open from a link).
// Closes on Escape or a click outside; the arrows move between the rows, Enter picks. Designer UI, as CheckDropdown.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/Icon';
import { PROPOSALS } from '../proposals';
import { STATUSES, type Proposal } from '../proposals/types';
import { StatusDot, useProposalParam } from '../tools/ProposalPanel';
import { NO_APP } from '../nav/pages';
import surface from '../theme/surface.module.css';
import styles from './ProposalMenu.module.css';

/** Live's icon: the app as it is on the phone today. */
const LIVE_ICON = 'smartphone';

const statusOf = (p: Proposal) => STATUSES.find((s) => s.id === p.meta.status) ?? STATUSES[0];

/** `2026-10-19` → `Oct 19` (this year) or `Oct 19, 2025`. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function ProposalMenu() {
  const [current, setCurrent] = useProposalParam();
  const active = PROPOSALS.find((p) => p.id === current);
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const archived = PROPOSALS.filter((p) => p.meta.status === 'archived');
  // Newest first; the one picked stays listed even when archived.
  const shown = [...PROPOSALS].reverse().filter((p) => showArchived || p.meta.status !== 'archived' || p.id === active?.id);

  // Listeners only while open; the picked row (else Live) takes focus so the arrows start there.
  useEffect(() => {
    if (!open) return;
    (list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = () => {
    setOpen(false);
    root.current?.querySelector<HTMLElement>('button')?.focus();
  };
  const pick = (pid: string | null) => {
    setCurrent(pid);
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
    }
  };

  // No app connected: the picker on view, off, saying what it's for.
  if (NO_APP)
    return (
      <div className={styles.root}>
        <button className={styles.trigger} disabled title="Live or a proposal: the app as it is, or a change to it kept apart, to compare and hand off. Once your app is connected.">
          <Icon name={LIVE_ICON} size={16} />
          <span className={styles.triggerTitle}>Live</span>
          <Icon name="expand_more" size={18} />
        </button>
      </div>
    );
  return (
    <div ref={root} className={styles.root} onKeyDown={open ? onKey : undefined}>
      {/* Back to Live in one click, beside the proposal on screen. */}
      {active && (
        <button className={styles.back} title="Back to Live" onClick={() => setCurrent(null)}>
          <Icon name="arrow_back" size={16} />
          <span>Live</span>
        </button>
      )}
      <button
        className={`${styles.trigger} ${active ? styles.triggerProposal : ''} ${open ? styles.triggerOpen : ''}`}
        title="Design: what's live, or a proposal"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {active ? <StatusDot status={active.meta.status} /> : <Icon name={LIVE_ICON} size={16} />}
        {active && <span className={styles.code}>{active.id}</span>}
        <span className={styles.triggerTitle}>{active?.meta.title ?? 'Live'}</span>
        <Icon name="expand_more" size={18} />
      </button>
      {open && (
        <div ref={list} id={id} className={styles.menu} role="listbox" aria-label="Design">
          {/* Live on the table's grid, in one line: its check, its icon under the codes, its name and line under the titles. */}
          <button role="option" aria-selected={!active} className={`${styles.row} ${styles.cols} ${styles.liveRow} ${!active ? styles.rowOn : ''}`} onClick={() => pick(null)}>
            <Check on={!active} />
            <span className={styles.codeCol}>
              <Icon name={LIVE_ICON} size={18} color="var(--ui-text-2)" />
            </span>
            <span className={`${styles.liveText} ${styles.span}`}>
              <span className={styles.title}>Live</span>
              <span className={styles.liveLine}>What the app is today</span>
            </span>
          </button>
          {/* No proposals to list: what one is and how to make it (or, all archived, where they are). */}
          {shown.length === 0 ? (
            <div className={surface.empty}>
              <span className={surface.emptyIcon}>
                <Icon name="lightbulb" size={24} />
              </span>
              <span className={surface.emptyTitle}>{archived.length ? 'No active proposals' : 'No proposals yet'}</span>
              <span className={surface.emptyBody}>
                {archived.length
                  ? `${archived.length === 1 ? 'The only one is' : `All ${archived.length} are`} archived: show them below.`
                  : 'A proposal is a change to the app, kept apart from it: new or changed screens, versions to compare, a handoff for whoever builds it. Start one in the Proposal panel, or ask your agent.'}
              </span>
            </div>
          ) : (
            <div className={`${styles.cols} ${styles.colHead}`} aria-hidden>
              <span />
              <span>Code</span>
              <span>Proposal · {shown.length}</span>
              <span>Status</span>
              <span>Created by</span>
              <span>Date</span>
            </div>
          )}
          {shown.map((p) => {
            const on = p.id === active?.id;
            const s = statusOf(p);
            const versions = p.variants.length;
            return (
              <button key={p.id} role="option" aria-selected={on} className={`${styles.row} ${styles.cols} ${on ? styles.rowOn : ''}`} onClick={() => pick(p.id)}>
                <Check on={on} />
                <span className={styles.codeCol}>{p.id}</span>
                <span className={styles.what}>
                  <span className={styles.title}>
                    {p.meta.title}
                    {versions > 0 && <span className={styles.versions}>{versions} versions</span>}
                  </span>
                  {(p.meta.summary ?? p.meta.description) && <span className={styles.summary}>{p.meta.summary ?? p.meta.description}</span>}
                </span>
                <span className={styles.statusCol}>
                  <span className={styles.status} style={{ color: s.id === 'handed-off' ? s.color : undefined }}>
                    <StatusDot status={p.meta.status} />
                    <span>{s.label}</span>
                  </span>
                  {p.meta.ticket && <span className={styles.ticket}>{p.meta.ticket}</span>}
                </span>
                <span className={styles.muted}>{p.meta.author ?? '—'}</span>
                <span className={styles.muted}>{shortDate(p.meta.created)}</span>
              </button>
            );
          })}
          {archived.length > 0 && (
            <button className={styles.footer} onClick={() => setShowArchived((a) => !a)}>
              <Icon name={showArchived ? 'visibility_off' : 'inventory_2'} size={14} />
              <span>{showArchived ? 'Hide archived' : `Show archived (${archived.length})`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The picked row's check, in a column of its own that's always there: the rows don't move when it shows. */
function Check({ on }: { on: boolean }) {
  return <span className={styles.check}>{on && <Icon name="check" size={16} color="#0d99ff" />}</span>;
}
