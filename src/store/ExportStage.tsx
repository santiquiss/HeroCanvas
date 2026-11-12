// App Store Assets' export, drawn in the page: one screenshot of a size alone, at its screen's points, under the export's
// modal (ExportProgress), its screens still (no motion). `drawShot` asks for one and resolves with its element once it's
// drawn (its screens' pictures or the app live, its devices' bodies, its images and fonts), for the export to take its
// picture (capture/domImage, as Capture does).
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { StillCtx } from '../kit/motion';
import type { Language } from '../sim/language';
import { bodiesPending, setBodyExportScale } from './Device3D';
import { ShotImage, type BackgroundRun, type Neighbor } from './ShotImage';
import { runOf, type StoreShot } from './shots';
import { assetById, storeOf } from './sizes';
import type { StoreAssetsProps } from './StoreAssets';

/** One screenshot to draw: the size's (its id), in a language, its place among the listing's. */
export interface StageShot {
  size: string;
  language: Language;
  shots: StoreShot[];
  index: number;
}

/** How long a drawn screenshot stays unchanged before its picture is taken. */
const QUIET_MS = 250;
/** How long a screenshot may take to draw before it's taken as it is. */
const READY_MS = 40_000;

let current: { shot: StageShot; done: (el: HTMLElement) => void } | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Draws one screenshot on the stage: its element, once it's drawn. */
export function drawShot(shot: StageShot): Promise<HTMLElement> {
  return new Promise((done) => {
    current = { shot, done };
    listeners.forEach((l) => l());
  });
}

/** The stage put away: the export is over. */
export function clearStage() {
  current = null;
  setBodyExportScale(null);
  listeners.forEach((l) => l());
}

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Whether what's in `el` is drawn: no screen loading or replaying its taps, every image decoded, no body waiting. */
function drawn(el: HTMLElement): boolean {
  if (el.querySelector('[aria-busy], [data-replaying]')) return false;
  if ([...el.querySelectorAll('img')].some((i) => !i.complete)) return false;
  return bodiesPending() === 0;
}

/** Resolves once `el` is drawn and has stayed still a moment (a chart's last values, a font's swap). */
async function whenDrawn(el: HTMLElement): Promise<void> {
  const end = performance.now() + READY_MS;
  await document.fonts.ready;
  while (performance.now() < end) {
    await frame();
    if (!drawn(el)) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }
    const changed = await new Promise<boolean>((done) => {
      const mo = new MutationObserver(() => (mo.disconnect(), done(true)));
      mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
      setTimeout(() => (mo.disconnect(), done(false)), QUIET_MS);
    });
    if (!changed && drawn(el)) return;
  }
}

/** The stage, mounted by App Store Assets: nothing until the export asks for a screenshot. */
export function ExportStage({ layoutFor }: StoreAssetsProps) {
  const job = useSyncExternalStore(subscribe, () => current);
  const stage = useRef<HTMLDivElement>(null);
  const asset = job ? assetById(job.shot.size) : null;
  const display = asset?.kind === 'screenshot' ? asset.display : undefined;
  const ratio = asset && display ? asset.sizes[0][0] / display.w : 1;
  useEffect(() => {
    if (!job || !stage.current) return;
    // The devices' bodies at the store's pixels, not the screen's.
    setBodyExportScale(ratio);
    let alive = true;
    const el = stage.current;
    void whenDrawn(el).then(() => {
      const image = el.querySelector<HTMLElement>('[data-store-image]');
      if (alive && image) job.done(image);
    });
    return () => {
      alive = false;
    };
  }, [job, ratio]);
  if (!job || !asset || !display) return null;
  const { shots, index } = job.shot;
  const shot = shots[index];
  // As its row draws it: what of the others reaches into it, and a background shared across a run.
  const span = runOf(shots, index);
  const run: BackgroundRun | undefined =
    span.end > span.start ? { background: shots[span.start].background, count: span.end - span.start + 1, at: index - span.start, spread: shots[span.start].spread } : undefined;
  const neighbors: Neighbor[] = shots.flatMap((n, j) => (j === index ? [] : [{ shot: n, at: j - index }]));
  // On the page, under the modal's backdrop (in view, so its screens draw), invisible; still, its animations off.
  return createPortal(
    <div ref={stage} data-store-export aria-hidden style={{ position: 'fixed', left: 0, top: 0, width: display.w, height: display.h, zIndex: 999, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      <style>{'[data-store-export] *, [data-store-export] *::before, [data-store-export] *::after { animation: none !important; transition: none !important; }'}</style>
      <StillCtx.Provider value>
        <ShotImage key={`${job.shot.size}:${job.shot.language}:${shot.id}`} shot={shot} display={display} language={job.shot.language} layoutFor={layoutFor} neighbors={neighbors} gap={storeOf(asset).gap} run={run} />
      </StillCtx.Provider>
    </div>,
    document.body,
  );
}
