// Where a changed component is (`?where=Button`): a rail beside the canvas with every page (and variant) it's on,
// each a live thumbnail in its device's frame with the changes highlighted, to check it everywhere at a glance. A thumbnail opens that page
// on the device (highlighted too). Opened from the changes popover (a component's "On N pages"). Thumbnails render once they scroll into
// view (a component on forty pages doesn't draw forty screens at once), isolated like the scanner: a fixed copy of the
// URL and shared state of their own, so nothing they do reaches the device. They show what opens: the page with what
// it opens on arrival (a sheet, a numpad), as the device will.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PreviewScreen } from '../flow/PreviewScreen';
import { useNavRoot } from '../nav/context';
import { pageName } from '../nav/stack';
import { BASE_PAGES } from '../nav/pages';
import { CHANGES_PARAM, findProposal, highlightOnly, proposalChanges, VARIANT_PARAM, WHERE_PARAM } from '../proposals';
import { FrameHardware, frameBox, frameStyle } from './DeviceFrame';
import type { Layout } from './layout';
import { usePageIndex, useScanProgress, type PagePlace } from './pageIndex';
import { ProgressLine, Spinner } from '../components/Loading';
import { SharedSimProvider, useUrlPatch } from './SimContext';
import shell from './SimulatorShell.module.css';
import styles from './WhereRail.module.css';

/** The rail's width (WhereRail.module.css), for what floats on the canvas beside it. */
export const WHERE_RAIL_W = 204;
const THUMB_W = 164;

const same = (a: Record<string, string> = {}, b: Record<string, string> = {}) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The component the rail is about (`?where=`), when the design on changes it: in Live, or a version that doesn't change
 * it (a stale link, a version switched), there's no rail.
 */
export function useWhere(): string | null {
  const [search] = useSearchParams();
  const name = search.get(WHERE_PARAM);
  const proposal = findProposal(search.get('proposal'));
  if (!name || !proposal) return null;
  return proposalChanges(proposal, search.get(VARIANT_PARAM), BASE_PAGES).components.some((c) => c.name === name) ? name : null;
}

export function WhereRail({ name, makeLayout }: { name: string; makeLayout: (detailOpen: boolean, pageId?: string) => Layout }) {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const nav = useNavRoot();
  const index = usePageIndex(search.get('proposal') ?? 'live', true);
  const scanning = useScanProgress(search.get('proposal') ?? 'live');
  // The pages it's on (a place in one of their sheets is the gallery's to open: a thumbnail shows the page alone).
  const places = (index?.[name] ?? []).filter((p) => !p.sheet);
  // The other components this version changes, to switch to from the title.
  const proposal = findProposal(search.get('proposal'));
  const changed = proposal ? proposalChanges(proposal, search.get(VARIANT_PARAM), BASE_PAGES).components.map((c) => c.name) : [];
  // What the thumbnails read: the URL as it is, with this component highlighted (only it), read-only.
  const query = useMemo(() => {
    const q = new URLSearchParams(search);
    q.set(CHANGES_PARAM, name);
    return q;
  }, [search, name]);
  // The device highlights what the rail is about while it's open: switching follows, closing turns that off.
  const following = !!highlightOnly(search.get(CHANGES_PARAM));
  const pick = (other: string) => patch({ [WHERE_PARAM]: other, ...(following ? { [CHANGES_PARAM]: other } : {}) });
  const close = () => patch({ [WHERE_PARAM]: null, ...(following ? { [CHANGES_PARAM]: null } : {}) });
  const top = nav.stack[nav.stack.length - 1];
  const scroller = useRef<HTMLDivElement>(null);
  const open = (p: PagePlace) => nav.open(p.id, p.params, { [CHANGES_PARAM]: name });

  // Picking a component (the popover, the title) takes the device to its first place, once its places are known —
  // unless the device is already on one of them.
  const shown = useRef<string | null>(null);
  const onPlace = places.some((p) => p.id === top?.id && same(p.params, top.params));
  useEffect(() => {
    if (!index || shown.current === name) return;
    shown.current = name;
    if (places[0] && !onPlace) open(places[0]);
    // Once per component picked, when its places arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, index]);

  return (
    <aside className={styles.rail} aria-label={`Where ${name} is`}>
      <div className={styles.head}>
        <span className={styles.title}>
          {changed.length > 1 ? (
            <label className={styles.pick} title="Another component this version changes">
              <select value={name} onChange={(e) => pick(e.target.value)}>
                {changed.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              {name}
              <Icon name="expand_more" size={16} />
            </label>
          ) : (
            name
          )}
          <span className={styles.count}>
            {index ? (
              `${places.length} ${places.length === 1 ? 'place' : 'places'}`
            ) : (
              <>
                <Spinner size={11} /> Finding places{scanning != null ? ` · ${Math.round(scanning * 100)}%` : '…'}
              </>
            )}
          </span>
          {!index && <ProgressLine value={scanning ?? 0} />}
        </span>
        <button className={styles.close} title="Close" onClick={close}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div ref={scroller} className={styles.list}>
        {places.map((p) => (
          <Thumb
            key={`${p.id} ${p.label ?? ''}`}
            place={p}
            title={pageName(nav.pages, p.id)}
            current={top?.id === p.id && same(top.params, p.params)}
            query={query}
            makeLayout={makeLayout}
            root={scroller}
            onOpen={() => open(p)}
          />
        ))}
        {index && !places.length && <p className={styles.empty}>Not on a page as it loads (a sheet, a dialog, a state).</p>}
      </div>
    </aside>
  );
}

function Thumb({
  place,
  title,
  current,
  query,
  makeLayout,
  root,
  onOpen,
}: {
  place: PagePlace;
  title: string;
  current: boolean;
  query: URLSearchParams;
  makeLayout: (detailOpen: boolean, pageId?: string) => Layout;
  root: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Drawn once it comes into view (and kept).
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !box.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { root: root.current, rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [seen, root]);
  // The device as on the canvas: its frame (bezel, corners), scaled to the rail's width.
  const layout = makeLayout(false, place.id);
  const fb = frameBox(layout);
  const k = THUMB_W / fb.w;
  const corners = layout.frameRadius.replace(/[\d.]+px/g, (v) => `${parseFloat(v) * k}px`);
  return (
    <div className={styles.item}>
      <span className={styles.label}>
        {title}
        {place.label && <span className={styles.variant}> · {place.label}</span>}
      </span>
      {/* A div, not a button: the page inside has buttons of its own. */}
      <div
        ref={box}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
        className={`${styles.thumb} ${current ? styles.current : ''}`}
        style={{ width: THUMB_W, height: fb.h * k, borderRadius: corners }}
        title={`Open ${title}${place.label ? ` · ${place.label}` : ''}`}
        onClick={onOpen}
      >
        <span
          className={shell.frame}
          style={{
            ...frameStyle(layout, k),
            transition: 'none',
            boxShadow: 'none',
          }}
        >
          {seen && (
            <ErrorBoundary label={`Thumbnail ${place.id}`}>
              {/* Its own shared state: the sheets it opens on arrival (a numpad) are its own. */}
              <SharedSimProvider fixed>
                <PreviewScreen page={place} query={query} makeLayout={makeLayout} overlays still />
              </SharedSimProvider>
            </ErrorBoundary>
          )}
          <FrameHardware layout={layout} />
        </span>
      </div>
    </div>
  );
}
