// What to export, picked before it starts (App Store Assets' Export): a table of the store's sizes (rows) by the app's
// languages (columns), a tick a size in a language. A row's or a column's header ticks it whole (or clears it, when
// it's whole already), the corner every one. It opens on the size and language on screen.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { plural, t } from '../i18n/ui';
import { LANGUAGES, type Language } from '../sim/language';
import { useSearchParams } from 'react-router';
import { LANG_PARAM, languageIn } from '../sim/language';
import { imagesIn, startExport, useExporting, type ExportGraphic, type ExportSize } from './ExportProgress';
import { useStoreAsset } from './route';
import { shotsOf, useGraphics, useShotSets } from './shots';
import { storeOf } from './sizes';
import { RequiredBadge } from './RequiredBadge';
import type { StoreAsset } from './sizes';
import styles from './StoreAssets.module.css';

/** A size as the table lists it: the export's, before its languages are picked. */
export type PickerSize = Omit<ExportSize, 'languages'> & { need: Pick<StoreAsset, 'required' | 'requiredNote' | 'recommended'> };

const cell = (size: string, lang: string) => `${size}|${lang}`;
const LANGS: Language[] = LANGUAGES.map((l) => l.id);
const slug = (s: string) => s.replace(/[″"]/g, 'in').replace(/[^a-zA-Z0-9.-]+/g, '-').replace(/^-|-$/g, '');

/** The zip's name and the progress's title, from what's picked: a size, a language, the whole store, or a choice. */
function nameOf(store: string, sizes: ExportSize[], everySize: boolean, langs: Set<Language>, everyLang: boolean) {
  const lang = langs.size === 1 ? [...langs][0] : null;
  const one = sizes.length === 1 ? sizes[0] : null;
  const what = one ? one.label : everySize ? t('All of {store}', { store }) : plural(sizes.length, '{n} size', '{n} sizes');
  const file = one ? slug(one.label) : everySize ? slug(store) : `${slug(store)}-${sizes.length}-sizes`;
  if (lang) return { label: t('{what}, in {language}', { what, language: LANGUAGES.find((l) => l.id === lang)?.name ?? lang }), file: `${file}-${lang}` };
  if (everyLang) return { label: t('{what}, every language', { what }), file };
  return { label: t('{what}, {n} languages', { what, n: langs.size }), file: `${file}-${langs.size}-languages` };
}

export function ExportPicker({ store, sizes, graphics = [], size, language, onClose }: { store: string; sizes: PickerSize[]; graphics?: ExportGraphic[]; size: string; language: Language; onClose: () => void }) {
  // The listing graphics with a file: all of them by default (one each, in no language).
  const [withGraphics, setWithGraphics] = useState(() => new Set(graphics.map((g) => g.label)));
  const [picked, setPicked] = useState(() => new Set(sizes.some((s) => s.id === size) ? [cell(size, language)] : []));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  /** Ticks every one of `cells`, or clears them when they're all ticked already. */
  const toggle = (cells: string[]) =>
    setPicked((p) => {
      const next = new Set(p);
      const all = cells.every((c) => p.has(c));
      for (const c of cells) {
        if (all) next.delete(c);
        else next.add(c);
      }
      return next;
    });
  const rowOf = (s: string) => LANGS.map((l) => cell(s, l));
  const columnOf = (l: string) => sizes.map((s) => cell(s.id, l));
  const every = sizes.flatMap((s) => rowOf(s.id));
  /** A header's tick: all, some (a dash) or none of its cells. */
  const state = (cells: string[]) => {
    const n = cells.filter((c) => picked.has(c)).length;
    return n === 0 ? 'none' : n === cells.length ? 'all' : 'some';
  };

  const request = useMemo(() => sizes.map((s) => ({ ...s, languages: LANGS.filter((l) => picked.has(cell(s.id, l))) })).filter((s) => s.languages.length), [sizes, picked]);
  const chosenGraphics = graphics.filter((g) => withGraphics.has(g.label));
  const images = imagesIn(request) + chosenGraphics.length;
  const start = () => {
    const used = new Set(request.flatMap((s) => s.languages));
    const named = request.length ? nameOf(store, request, request.length === sizes.length, used, used.size === LANGS.length) : { label: t('{store}’s graphics', { store }), file: `${slug(store)}-graphics` };
    onClose();
    void startExport({ ...named, sizes: request, graphics: chosenGraphics });
  };

  return createPortal(
    <div className={styles.dialogShim} role="dialog" aria-modal="true" aria-label={t('Export screenshots')} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.dialog} ${styles.exportDialog} ${styles.pickDialog}`}>
        <header className={styles.exportHead}>
          <Icon name="download" size={20} color="var(--ui-blue-text)" />
          <div>
            <strong>{t('Export screenshots')}</strong>
            <span>{t('Pick the sizes and languages. A row’s or a column’s name picks it whole.')}</span>
          </div>
        </header>
        <div className={styles.pickScroll}>
          <table className={styles.pickTable}>
            <thead>
              <tr>
                <th className={styles.pickCorner}>
                  <PickBox state={state(every)} label={t('Every size and language')} onClick={() => toggle(every)}>
                    {t('All')}
                  </PickBox>
                </th>
                {LANGUAGES.map((l) => (
                  <th key={l.id}>
                    <PickBox state={state(columnOf(l.id))} label={l.name} onClick={() => toggle(columnOf(l.id))} column>
                      {l.id}
                    </PickBox>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    <PickBox state={state(rowOf(s.id))} label={s.label} onClick={() => toggle(rowOf(s.id))}>
                      <span className={styles.pickSize}>
                        {s.label} <RequiredBadge asset={s.need} />
                      </span>
                      <span className={styles.pickMeta}>
                        {plural(s.count, '{n} shot', '{n} shots')} · {s.px[0]}×{s.px[1]}
                      </span>
                    </PickBox>
                  </th>
                  {LANGS.map((l) => {
                    const c = cell(s.id, l);
                    return (
                      <td key={l}>
                        <button type="button" className={styles.pickCell} aria-pressed={picked.has(c)} aria-label={`${s.label}, ${l}`} onClick={() => toggle([c])}>
                          <span className={styles.pickTick} data-state={picked.has(c) ? 'all' : 'none'} aria-hidden>
                            {picked.has(c) && <Icon name="check" size={12} />}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {graphics.length > 0 && (
          <div className={styles.pickGraphics}>
            <span className={styles.pickGraphicsTitle}>{t('Listing graphics')}</span>
            {graphics.map((g) => {
              const on = withGraphics.has(g.label);
              return (
                <button
                  key={g.label}
                  type="button"
                  className={styles.pickHead}
                  aria-pressed={on}
                  onClick={() =>
                    setWithGraphics((s) => {
                      const next = new Set(s);
                      if (on) next.delete(g.label);
                      else next.add(g.label);
                      return next;
                    })
                  }
                >
                  <span className={styles.pickTick} data-state={on ? 'all' : 'none'} aria-hidden>
                    {on && <Icon name="check" size={12} />}
                  </span>
                  <span className={styles.pickLabel}>
                    <span className={styles.pickSize}>{g.label}</span>
                    <span className={styles.pickMeta}>
                      {g.px[0]}×{g.px[1]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className={styles.menuNote}>{t('PNG at the store’s size, in a zip: a folder per language and size.')}</p>
        <div className={`${styles.exportActions} ${styles.pickActions}`}>
          <span className={styles.pickCount}>{plural(images, '{n} image', '{n} images')}</span>
          <button className={styles.button} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className={`${styles.button} ${styles.primary}`} disabled={!images} onClick={start}>
            {t('Export')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A row's, a column's or the table's header: a tick (all, some or none of its cells) and its name, one button. */
function PickBox({ state, label, onClick, column, children }: { state: 'all' | 'some' | 'none'; label: string; onClick: () => void; column?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`${styles.pickHead} ${column ? styles.pickColumn : ''}`} title={label} aria-pressed={state === 'all' ? true : state === 'some' ? 'mixed' : false} onClick={onClick}>
      <span className={styles.pickTick} data-state={state} aria-hidden>
        {state === 'all' ? <Icon name="check" size={12} /> : state === 'some' ? <Icon name="remove" size={12} /> : null}
      </span>
      <span className={styles.pickLabel}>{children}</span>
    </button>
  );
}

/**
 * The toolbar's Export, in App Store Assets: opens the picker on the size and language on screen. The store's sizes with
 * screenshots are its rows: the store's pixels, how many it has, how much the store needs it.
 */
export function ExportButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const [asset] = useStoreAsset();
  const [search] = useSearchParams();
  const sets = useShotSets();
  const exporting = useExporting();
  const store = storeOf(asset);
  const sizes: PickerSize[] = store.groups
    .flatMap((g) => g.assets)
    .flatMap((a) => (a.kind === 'screenshot' && a.display ? [{ id: a.id, store: store.name, label: a.label, px: a.sizes[0], count: Math.min(shotsOf(sets, a.id).length, a.max), need: a }] : []))
    .filter((s) => s.count > 0);
  // The store's listing graphics with a file (StoreData.graphics), but those it takes from the app's build.
  const files = useGraphics();
  const graphics: ExportGraphic[] = store.groups
    .flatMap((g) => g.assets)
    .flatMap((a) => (a.kind === 'graphic' && !a.fromBuild && files[a.id] ? [{ store: store.name, label: a.label, px: a.sizes[0], file: files[a.id] }] : []));
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} disabled={(!sizes.length && !graphics.length) || exporting} title={t('Export the screenshots: pick the sizes and languages')}>
        <Icon name="download" size={18} />
        {t('Export')}
      </button>
      {open && <ExportPicker store={store.name} sizes={sizes} graphics={graphics} size={asset.id} language={languageIn(search.get(LANG_PARAM))} onClose={() => setOpen(false)} />}
    </>
  );
}
