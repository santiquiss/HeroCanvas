// App Store Assets' design picker, in the toolbar where the other modes pick a proposal: Live (the screenshots the
// store shows) or a proposal for the listing (`?listing=L2`), a set of its own to try without touching Live. Only the
// images: the screens in the devices are always the app as it ships. The same table as the app's proposals
// (ProposalMenu), and below it what the open one can do: a new one from it, its name and status, make it Live, remove it.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { StatusDot } from '../tools/ProposalPanel';
import { STATUSES } from '../proposals/types';
import { useCanWrite } from '../persist/devApi';
import { plural, t, UI_LANGUAGE } from '../i18n/ui';
import { listingShots, LISTING_PARAM, makeListingLive, newListingProposal, removeListingProposal, SHARED, updateListingProposal, useListingProposal, useStoreData, type ListingStatus } from './shots';
import { SHOT_PARAM, LAYER_PARAM } from './route';
import menu from '../sim/ProposalMenu.module.css';
import surface from '../theme/surface.module.css';
import styles from './StoreAssets.module.css';

/** Live's icon: the store's listing as it is today. */
const LIVE_ICON = 'storefront';
/** A listing's proposal is a draft or in review; once it ships it's made Live. */
const LISTING_STATUSES = STATUSES.filter((s): s is (typeof STATUSES)[number] & { id: ListingStatus } => s.id === 'draft' || s.id === 'review');

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(UI_LANGUAGE === 'es' ? 'es' : 'en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The listing open (`?listing=`); a picked screenshot stays picked when it's in the other too (a copy keeps its ids). */
function useListingParam(): (id: string | null) => void {
  const [, setSearch] = useSearchParams();
  return (id) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set(LISTING_PARAM, id);
        else next.delete(LISTING_PARAM);
        const shot = next.get(SHOT_PARAM);
        if (shot && !listingShots(id).some((s) => s.id === shot)) {
          next.delete(SHOT_PARAM);
          next.delete(LAYER_PARAM);
        }
        return next;
      },
      { replace: true },
    );
}

export function ListingMenu() {
  const data = useStoreData();
  const active = useListingProposal();
  const setListing = useListingParam();
  const editable = useCanWrite();
  const [open, setOpen] = useState(false);
  // Make Live and Remove ask once more, on the same button.
  const [confirm, setConfirm] = useState<'live' | 'remove' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const shown = [...data.proposals].reverse();
  const liveCount = data.live[SHARED]?.length ?? 0;

  useEffect(() => {
    if (!open) return;
    (list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  useEffect(() => setConfirm(null), [open, active?.id]);

  const close = () => {
    setOpen(false);
    root.current?.querySelector<HTMLElement>('button')?.focus();
  };
  const pick = (pid: string | null) => {
    setListing(pid);
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
    }
  };
  const create = () => setListing(newListingProposal(active?.id ?? null));

  return (
    <div ref={root} className={menu.root} onKeyDown={open ? onKey : undefined}>
      {active && (
        <button className={menu.back} title={t('Back to Live')} onClick={() => setListing(null)}>
          <Icon name="arrow_back" size={16} />
          <span>{t('Live')}</span>
        </button>
      )}
      <button
        className={`${menu.trigger} ${active ? menu.triggerProposal : ''} ${open ? menu.triggerOpen : ''}`}
        title={t('The listing: what the store shows (Live), or a proposal for it')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {active ? <StatusDot status={active.status} /> : <Icon name={LIVE_ICON} size={16} />}
        {active && <span className={menu.code}>{active.id}</span>}
        <span className={menu.triggerTitle}>{active?.title ?? t('Live')}</span>
        <Icon name="expand_more" size={18} />
      </button>
      {open && (
        <div ref={list} id={id} className={menu.menu} role="listbox" aria-label={t('Listing')}>
          <button role="option" aria-selected={!active} className={`${menu.row} ${menu.cols} ${menu.liveRow} ${!active ? menu.rowOn : ''}`} onClick={() => pick(null)}>
            <Check on={!active} />
            <span className={menu.codeCol}>
              <Icon name={LIVE_ICON} size={18} color="var(--ui-text-2)" />
            </span>
            <span className={`${menu.liveText} ${menu.span}`}>
              <span className={menu.title}>{t('Live')}</span>
              <span className={menu.liveLine}>
                {t('What the store shows today')} · {plural(liveCount, '{n} screenshot', '{n} screenshots')}
              </span>
            </span>
          </button>
          {shown.length === 0 ? (
            <div className={surface.empty}>
              <span className={surface.emptyIcon}>
                <Icon name="lightbulb" size={24} />
              </span>
              <span className={surface.emptyTitle}>{t('No listing proposals yet')}</span>
              <span className={surface.emptyBody}>
                {t('A proposal is another set of screenshots for the store, made beside Live’s to try it without touching them. The screens in its devices are always the app as it ships.')}
              </span>
            </div>
          ) : (
            <div className={`${menu.cols} ${menu.colHead}`} aria-hidden>
              <span />
              <span>{t('Code')}</span>
              <span>{t('Proposal · {count}', { count: shown.length })}</span>
              <span>{t('Status')}</span>
              <span>{t('Screenshots')}</span>
              <span>{t('Date')}</span>
            </div>
          )}
          {shown.map((p) => {
            const on = p.id === active?.id;
            const s = LISTING_STATUSES.find((x) => x.id === p.status) ?? LISTING_STATUSES[0];
            return (
              <button key={p.id} role="option" aria-selected={on} className={`${menu.row} ${menu.cols} ${on ? menu.rowOn : ''}`} onClick={() => pick(p.id)}>
                <Check on={on} />
                <span className={menu.codeCol}>{p.id}</span>
                <span className={menu.what}>
                  <span className={menu.title}>{p.title}</span>
                </span>
                <span className={menu.statusCol}>
                  <span className={menu.status}>
                    <StatusDot status={p.status} />
                    <span>{s.label}</span>
                  </span>
                </span>
                <span className={menu.muted}>{p.shots.length}</span>
                <span className={menu.muted}>{shortDate(p.created)}</span>
              </button>
            );
          })}
          {/* What the open one can do: on the dev server, where the file is written. */}
          {editable && active && (
            <div className={styles.listingEdit}>
              <label className={styles.listingName}>
                <span>{t('Name')}</span>
                <input value={active.title} onChange={(e) => updateListingProposal(active.id, { title: e.target.value })} aria-label={t('Name')} />
              </label>
              <div className={styles.listingStatus} role="radiogroup" aria-label={t('Status')}>
                {LISTING_STATUSES.map((s) => (
                  <button key={s.id} role="radio" aria-checked={active.status === s.id} className={`${styles.segment} ${active.status === s.id ? styles.segmentOn : ''}`} onClick={() => updateListingProposal(active.id, { status: s.id })}>
                    <StatusDot status={s.id} />
                    {s.label}
                  </button>
                ))}
              </div>
              <div className={styles.listingActions}>
                <button
                  className={`${styles.button} ${confirm === 'live' ? styles.buttonPrimary : ''}`}
                  title={t('When the store shows these: they become Live’s, and the proposal is done')}
                  onClick={() => {
                    if (confirm !== 'live') return setConfirm('live');
                    makeListingLive(active.id);
                    setListing(null);
                  }}
                >
                  <Icon name="publish" size={16} />
                  {confirm === 'live' ? t('Replace Live’s screenshots?') : t('Make it Live')}
                </button>
                <button
                  className={`${styles.button} ${confirm === 'remove' ? styles.buttonDanger : ''}`}
                  onClick={() => {
                    if (confirm !== 'remove') return setConfirm('remove');
                    removeListingProposal(active.id);
                    setListing(null);
                  }}
                >
                  <Icon name="delete" size={16} />
                  {confirm === 'remove' ? t('Remove it?') : t('Remove')}
                </button>
              </div>
            </div>
          )}
          {editable && (
            <button
              className={menu.footer}
              onClick={() => {
                create();
                close();
              }}
            >
              <Icon name="add" size={14} />
              <span>{active ? t('New proposal from {name}', { name: active.title }) : t('New proposal from Live')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return <span className={menu.check}>{on && <Icon name="check" size={16} color="#0d99ff" />}</span>;
}
