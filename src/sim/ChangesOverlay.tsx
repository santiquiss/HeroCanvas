// Highlight changes (`?changes=1`, or `?changes=Button` for that component only): on a screen, what its proposal (and version) changes, in hot pink (design/changes
// HIGHLIGHT) so it stands out on any screen — a changed page's whole screen with a dashed line (following its corners),
// each changed component solid with diagonal stripes. The components are marked where they are (`data-hl`, styled in
// CSS), so the highlight moves with them as they scroll, with nothing measured per frame.
// The prototype works as usual while it's on; hovering a highlighted component shows a short note of what changed by
// it. Per screen: a device with its own version marks that version's changes. `interactive` off (thumbnails, the
// scanner): marked, no notes.
import { useEffect, useState, type CSSProperties } from 'react';
import { CHANGE, HIGHLIGHT } from '../design/changes';
import { componentKind } from '../gallery/route';
import { useScreenDesign } from '../design/overridable';
import { componentInstance } from '../design/component';
import { useNavRoot } from '../nav/context';
import { BASE_PAGES } from '../nav/pages';
import { CHANGES_PARAM, highlightOnly, proposalChanges, type ComponentChangeItem } from '../proposals';
import { useUrlParams } from './SimContext';
import { t } from '../i18n/ui';
import styles from './ChangesOverlay.module.css';

const NOTE_W = 240;
/** A marked element that was static, made relative for its stripes (restored when unmarked). */
const MADE_RELATIVE = 'hlPos';

export function ChangesOverlay({ screen, zIndex, radius, interactive }: { screen: HTMLElement | null; zIndex: number; /** The screen's corners (CSS border-radius). */ radius: string; interactive: boolean }) {
  const get = useUrlParams();
  const value = get(CHANGES_PARAM);
  const only = highlightOnly(value);
  const { proposal, variant } = useScreenDesign();
  const { stack } = useNavRoot();
  const changes = value && proposal ? proposalChanges(proposal, variant, BASE_PAGES) : null;
  const names = changes
    ? changes.components
        .filter((c) => !only || c.name === only)
        .map((c) => c.name)
        .join(',')
    : '';
  // The open note: which component, and where (screen points).
  const [note, setNote] = useState<{ name: string; at: CSSProperties } | null>(null);

  // Mark the changed components (the outermost of each): checked as the screen changes, unmarked when off.
  useEffect(() => {
    if (!screen || !names) return;
    const wanted = new Set(names.split(','));
    const nameOf = (el: Element | null) => (el ? componentInstance((el as HTMLElement).dataset.hc)?.name : undefined);
    const mark = () => {
      for (const el of screen.querySelectorAll<HTMLElement>('[data-hc]')) {
        const name = nameOf(el);
        const outer = !wanted.has(nameOf(el.parentElement?.closest('[data-hc]') ?? null) ?? '');
        const should = !!name && wanted.has(name) && outer;
        if (should && !el.hasAttribute('data-hl')) {
          // Its kind: a new component is outlined in the color of new, a changed one in the highlight's.
          el.setAttribute('data-hl', componentKind(name));
          if (getComputedStyle(el).position === 'static') {
            el.style.position = 'relative';
            el.dataset[MADE_RELATIVE] = '';
          }
        } else if (!should && el.hasAttribute('data-hl')) unmark(el);
      }
    };
    mark();
    const mo = new MutationObserver(() => mark());
    mo.observe(screen, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      screen.querySelectorAll<HTMLElement>('[data-hl]').forEach(unmark);
    };
  }, [screen, names]);

  // The prototype works as usual; hovering a highlighted component shows its note (what changed) by it.
  useEffect(() => {
    if (!screen || !names || !interactive) return;
    let current: HTMLElement | null = null;
    const show = (hit: HTMLElement | null) => {
      if (hit === current) return;
      current = hit;
      if (!hit) return setNote(null);
      const sr = screen.getBoundingClientRect();
      const k = sr.width / (screen.offsetWidth || 1);
      const r = hit.getBoundingClientRect();
      const b = { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, h: r.height / k };
      setNote({ name: componentInstance(hit.dataset.hc)?.name ?? '', at: notePlace(b, screen.offsetWidth, screen.offsetHeight) });
    };
    const onOver = (e: PointerEvent) => show((e.target as Element).closest<HTMLElement>('[data-hl]'));
    const onLeave = () => show(null);
    // The note is placed where the component was: scrolling hides it (the next hover places it again).
    const onScroll = () => show(null);
    screen.addEventListener('pointerover', onOver, true);
    screen.addEventListener('pointerleave', onLeave);
    screen.addEventListener('scroll', onScroll, true);
    return () => {
      screen.removeEventListener('pointerover', onOver, true);
      screen.removeEventListener('pointerleave', onLeave);
      screen.removeEventListener('scroll', onScroll, true);
      setNote(null);
    };
  }, [screen, names, interactive]);

  if (!changes) return null;
  const top = stack[stack.length - 1];
  // One component only: no page frame.
  const page = !only && changes.pages.find((p) => p.id === top.id);
  const item = note && changes.components.find((c) => c.name === note.name);
  return (
    <div className={styles.layer} style={{ zIndex, '--hl': HIGHLIGHT } as CSSProperties}>
      {page && <span className={styles.frame} style={{ borderRadius: radius, borderColor: CHANGE[page.kind].color }} aria-hidden />}
      {note && item && <Note item={item} at={note.at} />}
    </div>
  );
}

function unmark(el: HTMLElement) {
  el.removeAttribute('data-hl');
  if (MADE_RELATIVE in el.dataset) {
    el.style.position = '';
    delete el.dataset[MADE_RELATIVE];
  }
}

/** Below the component when there's room, else above; kept inside the screen. */
function notePlace(b: { x: number; y: number; h: number }, sw: number, sh: number): CSSProperties {
  const left = Math.max(12, Math.min(b.x, sw - NOTE_W - 12));
  const below = b.y + b.h + 8;
  return below + 110 < sh ? { left, top: below, width: NOTE_W } : { left, bottom: sh - b.y + 8, width: NOTE_W };
}

function Note({ item, at }: { item: ComponentChangeItem; at: CSSProperties }) {
  const kind = item.scope === 'added' ? 'new' : componentKind(item.name);
  return (
    <div className={styles.note} style={{ ...at, '--hl': CHANGE[kind].color } as CSSProperties} role="tooltip">
      <span className={styles.noteName}>{item.name}</span>
      <span className={styles.noteScope}>
        {item.scope === 'version'
          ? t('{change} in this version', { change: CHANGE[kind].label })
          : item.scope === 'added' || item.scope === 'params'
            ? t('{change} in the component library', { change: CHANGE[kind].label })
            : t('{change} in every version', { change: CHANGE[kind].label })}
      </span>
      {item.note && <span className={styles.noteText}>{item.note}</span>}
    </div>
  );
}
