// An export on its way (App Store Assets' Export menu): made in the page, a screenshot at a time (drawn alone on the
// export's stage, ExportStage, its picture taken as Capture takes one, capture/domImage), at the store's pixels, as PNGs
// with no transparency in a zip: a folder per store, language and size. A modal over the designer shows its progress,
// the time it has left and a log of each one made; Cancel stops it. Nothing's edited meanwhile: the set stays one.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { elementToCanvas } from '../capture/domImage';
import { Icon } from '../components/Icon';
import { plural, t } from '../i18n/ui';
import type { Language } from '../sim/language';
import { clearStage, drawShot } from './ExportStage';
import { shotsNow } from './shots';
import { assetById } from './sizes';
import styles from './StoreAssets.module.css';
import { ZipWriter, zipSink } from './zipWriter';

/**
 * One size to export: its store and name (the zip's folders), the store's pixels, how many screenshots it has, and the
 * languages it's exported in (the picker's ticks on its row).
 */
export interface ExportSize {
  id: string;
  store: string;
  label: string;
  px: [number, number];
  count: number;
  languages: Language[];
}

/** What's exported: the menu's choice. */
export interface ExportRequest {
  label: string;
  /** The zip's name, without `.zip`. */
  file: string;
  sizes: ExportSize[];
  /** Listing graphics made outside (StoreData.graphics), at the store's pixels: one each, in no language. */
  graphics?: ExportGraphic[];
}

/** A listing graphic to export: its store and name (the zip's folders), the store's pixels, its file in public/. */
export interface ExportGraphic {
  store: string;
  label: string;
  px: [number, number];
  file: string;
}

/**
 * A graphic's file drawn at the store's pixels, on white with no alpha (as the screenshots). A size of other
 * proportions than the file (the header's 16:9 beside its 21:9) is filled from its middle, cropped, never stretched.
 */
async function graphicPng(g: ExportGraphic): Promise<Uint8Array> {
  const img = new Image();
  img.src = import.meta.env.BASE_URL + g.file;
  await img.decode();
  const c = document.createElement('canvas');
  [c.width, c.height] = g.px;
  const ctx = c.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  const k = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, 'image/png'));
  if (!blob) throw new Error(t('The browser couldn’t make the image.'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** How many images a request makes: each size's screenshots in each of its languages. */
export const imagesIn = (sizes: ExportSize[]) => sizes.reduce((n, s) => n + s.count * s.languages.length, 0);

/** A screenshot in the log: which (its place of how many), its size, language and pixels. */
interface Shot {
  store: string;
  size: string;
  lang: string;
  shot: number;
  of: number;
  px: [number, number];
}
/** One made, and how long it took. */
interface Made extends Shot {
  ms: number;
}

interface Progress {
  request: ExportRequest;
  done: number;
  total: number;
  /** Being drawn now: it comes next in the log. */
  drawing: Shot[];
  phase: 'running' | 'done' | 'error' | 'cancelling';
  error?: string;
  startedAt: number;
  /** Every screenshot made so far, in order: the log. */
  log: Made[];
}

let now: Progress | null = null;
const listeners = new Set<() => void>();
const set = (p: Progress | null) => {
  now = p;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let cancelled = false;

/** Whether an export is on its way: the canvas takes no edits (its keys included) until it's over. */
export const useExporting = () => useSyncExternalStore(subscribe, () => now !== null && now.phase !== 'error');

/** A file or folder name: no slashes or marks a file system minds. */
const safe = (s: string) => s.replace(/[″"]/g, 'in').replace(/[\\/:*?<>|]/g, '-').trim();

/** A screenshot's element as a PNG at `scale`, on white with no alpha (the stores take none). */
async function png(el: HTMLElement, scale: number): Promise<Uint8Array> {
  const drawn = await elementToCanvas(el, scale);
  const flat = document.createElement('canvas');
  flat.width = drawn.width;
  flat.height = drawn.height;
  // Without alpha: the browser writes the PNG as RGB.
  const ctx = flat.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(drawn, 0, 0);
  const blob = await new Promise<Blob | null>((done) => flat.toBlob(done, 'image/png'));
  if (!blob) throw new Error(t('The browser couldn’t make the image.'));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Starts an export: where the zip goes is asked first (from the click), then every screenshot, in order (a size, each
 * of its languages, each of its places), drawn, taken and written in; the zip downloads, or is on disk, at the end.
 */
export async function startExport(request: ExportRequest) {
  if (now) return;
  const total = imagesIn(request.sizes) + (request.graphics?.length ?? 0);
  const target = await zipSink(`${request.file}.zip`);
  if (!target) return;
  cancelled = false;
  set({ request, done: 0, total, phase: 'running', startedAt: Date.now(), log: [], drawing: [] });
  const zip = new ZipWriter(target.sink);
  // The listing as it is now: what's exported is one set.
  const shots = shotsNow();
  try {
    for (const size of request.sizes) {
      const asset = assetById(size.id);
      if (asset.kind !== 'screenshot' || !asset.display) continue;
      const list = shots.slice(0, asset.max);
      const scale = size.px[0] / asset.display.w;
      for (const lang of size.languages)
        for (let i = 0; i < Math.min(size.count, list.length); i++) {
          if (cancelled) throw new Error('cancelled');
          const shot: Shot = { store: size.store, size: size.label, lang, shot: i + 1, of: size.count, px: size.px };
          set({ ...now!, drawing: [shot] });
          const t0 = performance.now();
          const el = await drawShot({ size: size.id, language: lang, shots: list, index: i });
          const data = await png(el, scale);
          await zip.add(`${safe(size.store)}/${lang}/${safe(size.label)} (${size.px[0]}x${size.px[1]})/${String(i + 1).padStart(2, '0')}.png`, data);
          const p = now!;
          set({ ...p, done: p.done + 1, drawing: [], log: [...p.log, { ...shot, ms: performance.now() - t0 }] });
        }
    }
    for (const g of request.graphics ?? []) {
      if (cancelled) throw new Error('cancelled');
      const shot: Shot = { store: g.store, size: g.label, lang: '–', shot: 1, of: 1, px: g.px };
      set({ ...now!, drawing: [shot] });
      const t0 = performance.now();
      await zip.add(`${safe(g.store)}/Graphics/${safe(g.label)} (${g.px[0]}x${g.px[1]}).png`, await graphicPng(g));
      const p = now!;
      set({ ...p, done: p.done + 1, drawing: [], log: [...p.log, { ...shot, ms: performance.now() - t0 }] });
    }
    await zip.close();
    clearStage();
    set({ ...now!, phase: 'done', drawing: [] });
    target.download?.();
    setTimeout(() => set(null), 1500);
  } catch (e) {
    clearStage();
    await zip.abort().catch(() => {});
    if (cancelled) return set(null);
    const p = now as Progress | null;
    if (p) set({ ...p, phase: 'error', drawing: [], error: e instanceof Error ? e.message : String(e) });
  }
}

/** Stops it after the screenshot being drawn: nothing is saved. */
function cancel() {
  const p = now;
  if (!p || p.phase !== 'running') return;
  cancelled = true;
  set({ ...p, phase: 'cancelling' });
}

/** A length of time as it reads: "45 s", "4 min", "1 h 10 min". */
function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return t('{n} s', { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t('{n} min', { n: m });
  return t('{h} h {m} min', { h: Math.floor(m / 60), m: m % 60 });
}

/**
 * The time left, from how fast they've come since it started (they come in bursts: one waits for those before it, so
 * the pace between two is no guide); none until there are enough to tell.
 */
function timeLeft(p: Progress, at: number): string {
  if (p.done < 12) return t('Working out the time left…');
  const each = (at - p.startedAt) / p.done;
  const left = each * (p.total - p.done);
  return left < 60_000 ? t('Less than a minute left') : t('About {time} left', { time: duration(left) });
}

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });
const languageName = (id: string) => {
  try {
    return LANGUAGE_NAMES.of(id) ?? id;
  } catch {
    return id;
  }
};

const pad = (n: number, of: number) => String(n).padStart(String(of).length, '0');

/** A screenshot's line: made (a check, how long it took), or being drawn (turning, quieter) in the place it'll have. */
function LogLine({ shot, ms }: { shot: Shot; ms?: number }) {
  const made = ms !== undefined;
  return (
    <div className={`${styles.logLine} ${made ? '' : styles.logDrawing}`}>
      {made ? <span className={styles.logCheck}>✓</span> : <span className={styles.logSpin} aria-hidden />}
      <span className={styles.logRow}>
        <span className={styles.logShot}>
          {pad(shot.shot, shot.of)}/{shot.of}
        </span>
        <span>{shot.size}</span>
        <span className={styles.logLang} title={languageName(shot.lang)}>
          {shot.lang}
        </span>
        <span className={styles.logMuted}>
          {shot.px[0]}×{shot.px[1]}
        </span>
        <span className={styles.logTime}>{made ? `${(ms / 1000).toFixed(1)}s` : '…'}</span>
      </span>
    </div>
  );
}

/**
 * What's been made, written as a terminal writes it: a line a screenshot, in order (a size, each language, each place),
 * then the ones being drawn, each becoming its line once it's made. It keeps to the newest unless scrolled up to read.
 */
function ExportLog({ p }: { p: Progress }) {
  const box = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [p.log.length, p.drawing.length, p.phase]);
  return (
    <div
      ref={box}
      className={styles.exportLog}
      role="log"
      aria-label={t('Screenshots exported')}
      onScroll={(e) => {
        const el = e.currentTarget;
        stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
    >
      {p.log.map((m, i) => (
        <LogLine key={i} shot={m} ms={m.ms} />
      ))}
      {p.phase === 'running' && p.drawing.map((d) => <LogLine key={`${d.size}:${d.lang}:${d.shot}`} shot={d} />)}
      {p.phase === 'cancelling' && (
        <div className={styles.logLine}>
          <span className={styles.logWarn}>!</span>
          <span className={styles.logMuted}>{t('cancelling: the one being drawn finishes')}</span>
        </div>
      )}
      {p.phase === 'done' && (
        <div className={styles.logLine}>
          <span className={styles.logCheck}>✓</span>
          <span>{t('{n} images in {time}', { n: p.done, time: duration(Date.now() - p.startedAt) })}</span>
        </div>
      )}
    </div>
  );
}

/** The modal, while an export is on: mounted once by App Store Assets. */
export function ExportProgress() {
  const p = useSyncExternalStore(subscribe, () => now);
  // The clock: the time spent and left move between two answers from the server.
  const [at, setAt] = useState(Date.now());
  useEffect(() => {
    if (!p || p.phase !== 'running') return;
    const timer = setInterval(() => setAt(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [p]);
  if (!p) return null;
  const share = p.total ? p.done / p.total : 0;
  return createPortal(
    <div className={styles.dialogShim} role="dialog" aria-modal="true" aria-label={t('Exporting screenshots')}>
      <div className={`${styles.dialog} ${styles.exportDialog}`}>
        <header className={styles.exportHead}>
          <Icon name={p.phase === 'error' ? 'error' : p.phase === 'done' ? 'check_circle' : 'download'} size={20} color={p.phase === 'error' ? 'var(--ui-red-text, #d93025)' : 'var(--ui-blue-text)'} />
          <div>
            <strong>{p.phase === 'error' ? t('Export failed') : p.phase === 'done' ? t('Exported: downloading the zip') : p.phase === 'cancelling' ? t('Cancelling…') : t('Exporting screenshots')}</strong>
            <span>
              {p.request.label} · {plural(p.total, '{n} image', '{n} images')}
            </span>
          </div>
        </header>
        {p.phase === 'error' ? (
          <p className={styles.exportError}>{p.error}</p>
        ) : (
          <>
            <div className={styles.exportBar} role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}>
              <span style={{ transform: `scaleX(${share})` }} />
            </div>
            <div className={styles.exportNumbers}>
              <span>{t('{done} of {total}', { done: p.done, total: p.total })}</span>
              <span>{p.phase === 'done' ? duration(at - p.startedAt) : timeLeft(p, at)}</span>
            </div>
            <ExportLog p={p} />
          </>
        )}
        <div className={styles.exportActions}>
          {p.phase === 'error' ? (
            <button className={styles.button} onClick={() => set(null)}>
              {t('Close')}
            </button>
          ) : (
            <button className={styles.button} disabled={p.phase !== 'running'} onClick={cancel}>
              {t('Cancel')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
