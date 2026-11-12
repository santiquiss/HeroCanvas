// Setting a device layer's screen to the exact state it shows: the prototype itself, live, in a dialog over the canvas
// (an iframe of the site in real mode, the store size's display large), to go anywhere, scroll, open a menu or a sheet;
// Done keeps where it is (its page and query), how far each of its lists is scrolled, and the taps on that page that
// left something open (replayed where it's drawn), and the screenshot shows it still.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import type { Display } from '../devices/devices';
import { useNavRoot } from '../nav/context';
import { pageName, parsePath } from '../nav/stack';
import type { PageRef } from '../nav/types';
import type { Language } from '../sim/language';
import { DEFAULT_PERSONA, PERSONA_PARAM, PERSONAS } from '../sim/persona';
import { Dropdown } from './controls';
import { screenSpec } from './screenImage';
import { t } from '../i18n/ui';
import { cleanQuery } from './lastScreen';
import type { DeviceLayer, ScrollAt, Tap } from './shots';
import { applyScroll, readScroll, replayTaps, screenRootIn, tapOf } from './replay';
import styles from './StoreAssets.module.css';

/**
 * Keeps the taps on a live screen that left something open: a tap that changed the URL is kept by it instead (and a
 * new page starts over, its taps its own).
 */
function useTapRecorder(frame: React.RefObject<HTMLIFrameElement | null>, ready: boolean, start: Tap[]) {
  const taps = useRef<Tap[]>(start);
  useEffect(() => {
    const win = frame.current?.contentWindow;
    const doc = frame.current?.contentDocument;
    if (!ready || !win || !doc) return;
    const pathOf = () => win.location.hash.split('?')[0];
    const onClick = (e: MouseEvent) => {
      // Our own replays aren't the person's.
      // The frame's own Element, not this window's (another realm).
      const target = e.target as Element | null;
      if (!e.isTrusted || !target || typeof target.closest !== 'function') return;
      const root = screenRootIn(doc);
      const place = root && tapOf(root, target);
      if (!place) return;
      const before = win.location.hash;
      const page = pathOf();
      // After it acted: the URL tells whether it's kept already.
      setTimeout(() => {
        if (pathOf() !== page) taps.current = [];
        else if (win.location.hash === before) taps.current = [...taps.current, place];
      }, 250);
    };
    doc.addEventListener('click', onClick, true);
    return () => doc.removeEventListener('click', onClick, true);
  }, [frame, ready]);
  return taps;
}

/** The dialog: the screen live at its size, fitted to the window; Done or Cancel. */
export function ScreenStateDialog({ layer, display, language, onDone, onClose }: { layer: DeviceLayer; display: Display; language: Language; onDone: (s: { page: PageRef; query: string; scroll: ScrollAt[]; taps: Tap[] }) => void; onClose: () => void }) {
  const pages = useNavRoot().pages;
  const frame = useRef<HTMLIFrameElement>(null);
  const [fit, setFit] = useState(1);
  const [ready, setReady] = useState(false);
  const taps = useTapRecorder(frame, ready, layer.taps ?? []);
  // The screen at its size, as large as the window allows.
  useEffect(() => {
    const size = () => setFit(Math.min(1, (window.innerHeight - 160) / display.h, (window.innerWidth - 120) / display.w));
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [display]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  // Who's using the app in it: the layer's persona, another picked here (the screen opens again as them).
  const [persona, setPersona] = useState(() => new URLSearchParams(layer.query).get(PERSONA_PARAM) ?? DEFAULT_PERSONA ?? '');
  const shown = useMemo(() => {
    const q = new URLSearchParams(layer.query);
    if (persona) q.set(PERSONA_PARAM, persona);
    return { ...layer, query: q.toString() };
  }, [layer, persona]);
  // The same screen the canvas pictures (screenSpec), at its size.
  const src = `${import.meta.env.BASE_URL}#${screenSpec(pages, shown, display, language).hash}`;
  useEffect(() => setReady(false), [src]);
  // Once in, what the layer had open (its taps), then each list where it had it; shown when it's like that.
  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return setReady(true);
    setTimeout(async () => {
      if (layer.taps?.length) await replayTaps(doc, layer.taps);
      let tries = 0;
      const put = () => !applyScroll(doc, layer.scroll ?? []) && tries++ < 60 && requestAnimationFrame(put);
      put();
      setReady(true);
    }, 300);
  };
  const done = () => {
    const win = frame.current?.contentWindow;
    const doc = frame.current?.contentDocument;
    if (!win || !doc) return onClose();
    const [path, query = ''] = win.location.hash.replace(/^#/, '').split('?');
    const page = parsePath(pages, path) ?? layer.page;
    onDone({ page, query: cleanQuery(new URLSearchParams(query)), scroll: readScroll(doc), taps: taps.current });
  };
  return createPortal(
    <div className={styles.dialogShim} role="dialog" aria-modal="true" aria-label={t('Interact with the screen')} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <header className={styles.dialogHead}>
          <div>
            <strong>{t('Interact with the screen')}</strong>
            <span>{t('Go where it should show, scroll, open the menus and sheets it should have open; Done keeps it like that.')}</span>
          </div>
          <div className={styles.dialogHeadRight}>
            {PERSONAS.length > 1 && (
              <Dropdown label={t('Persona')} title={t('Who’s using the app in it: the screen opens again as them')} value={persona} options={PERSONAS.map((p) => ({ value: p.id, label: p.name }))} onChange={setPersona} />
            )}
            <span className={styles.mono}>{pageName(pages, layer.page.id)}</span>
          </div>
        </header>
        <div className={styles.dialogScreen} style={{ width: display.w * fit, height: display.h * fit, borderRadius: display.r * fit }}>
          {!ready && <Icon name="hourglass_empty" size={20} />}
          <iframe key={src} ref={frame} title={t('The screen, live')} src={src} onLoad={onLoad} style={{ width: display.w, height: display.h, transform: `scale(${fit})`, opacity: ready ? 1 : 0 }} />
        </div>
        <footer className={styles.dialogFoot}>
          <button className={styles.button} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className={`${styles.button} ${styles.primary}`} onClick={done}>
            <Icon name="check" size={16} />
            {t('Done')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
