// The toolbar's design picker: Live, or a proposal (`?proposal=`). A dropdown of its own (not the browser's) so each
// proposal shows what it is before it's picked, as a table: its code, its title (how many versions) over its summary,
// its status, who made it and when; the picked one checked at the left. Newest first; the archived ones behind a switch at the bottom (they still open from a link).
// ui-sdk's Select (try-ui-library): opening, closing, the keyboard (typing a code jumps to it), focus and keeping the
// list on screen are its; the table and its look are ours. Live's tickets open Linear, so they're links under the list,
// not choices in it. Designer UI.
import { useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectGroupLabel, SelectItem, SelectTrigger } from '@ui-sdk/react/select';
import { Icon } from '../components/Icon';
import { PROPOSALS } from '../proposals';
import { ARCHIVED, STATUSES, type Proposal } from '../proposals/types';
import { LIVE_TICKETS } from '../proposals/tickets';
import { StatusDot, useProposalParam } from '../tools/ProposalPanel';
import surface from '../theme/surface.module.css';
import { plural, t, UI_LANGUAGE } from '../i18n/ui';
import styles from './ProposalMenu.module.css';

/** Live's icon: the app as it is on the phone today. */
const LIVE_ICON = 'smartphone';

/** A Live ticket is with the developers: Dev handoff's look. */
const HANDOFF = STATUSES.find((s) => s.id === 'handed-off')!;
const statusOf = (p: Proposal) => (p.meta.archived ? { id: 'archived', ...ARCHIVED } : (STATUSES.find((s) => s.id === p.meta.status) ?? STATUSES[0]));

/** `2026-10-19` → `Oct 19` (this year) or `Oct 19, 2025`. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(UI_LANGUAGE === 'es' ? 'es' : 'en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Live's value in the Select: no proposal. */
const LIVE = 'live';

export function ProposalMenu() {
  const [current, setCurrent] = useProposalParam();
  const active = PROPOSALS.find((p) => p.id === current);
  const [showArchived, setShowArchived] = useState(false);

  const archived = PROPOSALS.filter((p) => p.meta.archived);
  // Newest first; the one picked stays listed even when archived.
  const shown = [...PROPOSALS].reverse().filter((p) => showArchived || !p.meta.archived || p.id === active?.id);

  return (
    <div className={styles.root}>
      {/* Back to Live in one click, beside the proposal on screen. */}
      {active && (
        <button className={styles.back} title={t('Back to Live')} onClick={() => setCurrent(null)}>
          <Icon name="arrow_back" size={16} />
          <span>{t('Live')}</span>
        </button>
      )}
      <Select value={active?.id ?? LIVE} onValueChange={(v) => typeof v === 'string' && setCurrent(v === LIVE ? null : v)}>
        <SelectTrigger
          data-tour="proposals"
          className={`${styles.trigger} ${active ? styles.triggerProposal : ''}`}
          title={t("Design: what's live, or a proposal")}
          aria-label={t('Design')}
        >
          {active ? <StatusDot status={active.meta.status} archived={active.meta.archived} /> : <Icon name={LIVE_ICON} size={16} />}
          {active && <span className={styles.code}>{active.id}</span>}
          <span className={styles.triggerTitle}>{active?.meta.title ?? t('Live')}</span>
          <Icon name="expand_more" size={18} />
        </SelectTrigger>
        <SelectContent className={styles.menu} sideOffset={4} align="start">
          {/* Live on the table's grid, in one line: its check, its icon under the codes, its name and line under the titles. */}
          <SelectItem value={LIVE} label={t('Live')} className={`${styles.row} ${styles.cols} ${styles.liveRow}`}>
            <Check />
            <span className={styles.codeCol}>
              <Icon name={LIVE_ICON} size={18} color="var(--ui-text-2)" />
            </span>
            <span className={`${styles.liveText} ${styles.span}`}>
              <span className={styles.title}>{t('Live')}</span>
              <span className={styles.liveLine}>{t('What the app is today')}</span>
            </span>
          </SelectItem>
          {/* No proposals to list: what one is and how to make it (or, all archived, where they are). */}
          {shown.length === 0 ? (
            <div className={surface.empty}>
              <span className={surface.emptyIcon}>
                <Icon name="lightbulb" size={24} />
              </span>
              <span className={surface.emptyTitle}>{archived.length ? t('No active proposals') : t('No proposals yet')}</span>
              <span className={surface.emptyBody}>
                {archived.length
                  ? plural(archived.length, 'The only one is archived: show them below.', 'All {n} are archived: show them below.')
                  : t('A proposal is a change to the app, kept apart from it: new or changed screens, versions to compare, a handoff for whoever builds it. Start one in the Proposal panel, or ask your agent.')}
              </span>
            </div>
          ) : (
            <SelectGroup>
              {/* The group's name is its title column's head; the others name the table's columns. */}
              <SelectGroupLabel className={`${styles.cols} ${styles.colHead}`}>
                <span aria-hidden />
                <span aria-hidden>{t('Code')}</span>
                <span>{t('Proposal · {count}', { count: shown.length })}</span>
                <span aria-hidden>{t('Status')}</span>
                <span aria-hidden>{t('Created by')}</span>
                <span aria-hidden>{t('Date')}</span>
              </SelectGroupLabel>
              {shown.map((p) => {
                const s = statusOf(p);
                const versions = p.variants.length;
                return (
                  // Typing finds it by its code ("PS-18"), then its title.
                  <SelectItem key={p.id} value={p.id} label={`${p.id} ${p.meta.title}`} className={`${styles.row} ${styles.cols}`}>
                    <Check />
                    <span className={styles.codeCol}>{p.id}</span>
                    <span className={styles.what}>
                      <span className={styles.title}>
                        {p.meta.title}
                        {versions > 0 && <span className={styles.versions}>{plural(versions, '{n} version', '{n} versions')}</span>}
                      </span>
                      {(p.meta.summary ?? p.meta.description) && <span className={styles.summary}>{p.meta.summary ?? p.meta.description}</span>}
                    </span>
                    <span className={styles.statusCol}>
                      <span className={styles.status} style={{ color: s.id === 'handed-off' ? s.color : undefined }}>
                        <StatusDot status={p.meta.status} archived={p.meta.archived} />
                        <span>{s.label}</span>
                      </span>
                      {p.meta.ticket && <span className={styles.ticket}>{p.meta.ticket}</span>}
                    </span>
                    <span className={styles.muted}>{p.meta.author ?? '—'}</span>
                    <span className={styles.muted}>{shortDate(p.meta.created)}</span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          )}
          {/* Live's own tickets (proposals/tickets.json): small changes to the app as it is, with no proposal. Each opens
              its ticket, so they're links, not choices. */}
          {LIVE_TICKETS.length > 0 && (
            <div role="group" aria-label={t('Live tickets · {count}', { count: LIVE_TICKETS.length })}>
              <div className={`${styles.cols} ${styles.colHead}`} aria-hidden>
                <span />
                <span />
                <span>{t('Live tickets · {count}', { count: LIVE_TICKETS.length })}</span>
                <span />
                <span />
                <span />
              </div>
              {LIVE_TICKETS.map((tk) => (
                <a
                  key={tk.ticket}
                  className={`${styles.row} ${styles.cols} ${styles.link}`}
                  href={tk.url}
                  target="_blank"
                  rel="noopener"
                  title={tk.url ? t('Open {ticket}', { ticket: tk.ticket }) : tk.ticket}
                >
                  <span className={styles.check} />
                  {/* A ticket, not a proposal's code: its id goes under its status, as a proposal's ticket does. */}
                  <span className={styles.codeCol}>
                    <Icon name="confirmation_number" size={18} color="var(--ui-text-2)" />
                  </span>
                  <span className={styles.what}>
                    <span className={styles.title}>{tk.title}</span>
                    {tk.summary && <span className={styles.summary}>{tk.summary}</span>}
                  </span>
                  <span className={styles.statusCol}>
                    <span className={styles.status} style={{ color: HANDOFF.color }}>
                      <StatusDot status="handed-off" />
                      <span>{HANDOFF.label}</span>
                    </span>
                    <span className={styles.ticket}>{tk.ticket}</span>
                  </span>
                  <span className={styles.muted}>{tk.author ?? '—'}</span>
                  <span className={styles.muted}>{shortDate(tk.created)}</span>
                </a>
              ))}
            </div>
          )}
          {archived.length > 0 && (
            <button className={styles.footer} onClick={() => setShowArchived((a) => !a)}>
              <Icon name={showArchived ? 'visibility_off' : 'inventory_2'} size={14} />
              <span>{showArchived ? t('Hide archived') : t('Show archived ({count})', { count: archived.length })}</span>
            </button>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The picked row's check, in a column of its own that's always there (shown on the selected item): the rows don't move. */
function Check() {
  return (
    <span className={styles.check}>
      <Icon name="check" size={16} color="#0d99ff" className={styles.checkIcon} />
    </span>
  );
}
