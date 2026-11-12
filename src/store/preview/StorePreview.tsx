// App Store Assets' Preview (`?view=preview`): the listing as the App Store shows it, on the prototype's own canvas:
// its devices (MultiDevices, one at a time: switched from its header; the pan),
// its zoom (ZoomBar) and its Light / Dark (ThemeSwitch), each screen showing the store's page (AppStorePage) instead
// of the app, with the listing's icon, header, texts and that device's screenshots. Its page (product or search), its
// devices and its zoom are in the URL, so a link opens the same.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../../components/Icon';
import { modeIn } from '../../design/themeModes';
import { findDevice, findDisplay } from '../../devices/devices';
import { MultiDevices, multiFit } from '../../sim/MultiDevices';
import { useUrlParams } from '../../sim/SimContext';
import { parseDevices, serializeDevices, type DeviceItem } from '../../sim/deviceSet';
import { ThemeSwitch } from '../../sim/ThemeSwitch';
import { parseZoom, ZoomBar } from '../../sim/ViewBar';
import shell from '../../sim/SimulatorShell.module.css';
import bar from '../../sim/Toolbar.module.css';
import { t } from '../../i18n/ui';
import { LANGUAGES, type Language } from '../../sim/language';
import { shotsOf, useGraphics, useListingInfo, useShotSets } from '../shots';
import { ALL_ASSETS, type StoreAsset } from '../sizes';
import type { StoreAssetsProps } from '../StoreAssets';
import { AppStorePage, type StorePage } from './AppStorePage';
import styles from './StorePreview.module.css';

type ShotSize = StoreAsset & { display: NonNullable<StoreAsset['display']> };

/**
 * The devices it offers: the catalog's whose screen is one of the App Store's screenshot sizes. No iPad for now: its
 * App Store page isn't drawn from a reference yet.
 */
const PREVIEW_DEVICES = ['ip18', 'ip17pm', 'ipduo'];
const OPTIONS = PREVIEW_DEVICES.map((id) => ({ id, name: findDevice(id).name }));
/** The latest iPhone: what it opens on, and what it keeps when the last one is taken out (never an empty canvas). */
const DEFAULT_DEVICES: DeviceItem[] = [{ device: 'ip18', display: 'main', land: false }];

/** The App Store size whose screenshots a device's screen shows: the one of its screen's size. */
function sizeFor(item: DeviceItem): ShotSize | undefined {
  const d = findDisplay(findDevice(item.device), item.display);
  return ALL_ASSETS.find((a): a is ShotSize => a.store === 'appstore' && a.kind === 'screenshot' && !!a.display && a.display.w === d.w && a.display.h === d.h);
}

export const PREVIEW_VIEW = 'preview';
export const PREVIEW_PAGE_PARAM = 'ppage';
export const PREVIEW_DEVICES_PARAM = 'pdev';
export const PREVIEW_ZOOM_PARAM = 'pzoom';

/** The URL's params set (null: dropped), the history left as it is. */
function usePatch() {
  const [, setSearch] = useSearchParams();
  return useCallback(
    (values: Record<string, string | null>) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(values)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true },
      ),
    [setSearch],
  );
}

export function StorePreview({ layoutFor, language, onLanguage }: { layoutFor: StoreAssetsProps['layoutFor']; language: Language; onLanguage: (l: Language) => void }) {
  const [search] = useSearchParams();
  const patch = usePatch();
  const page: StorePage = search.get(PREVIEW_PAGE_PARAM) === 'search' ? 'search' : 'product';
  const raw = search.get(PREVIEW_DEVICES_PARAM);
  const items = useMemo(() => {
    // One at a time: the first the link names, else the latest iPhone.
    const own = raw === null ? [] : parseDevices(raw).filter((it) => PREVIEW_DEVICES.includes(it.device));
    return own.length ? own.slice(0, 1) : DEFAULT_DEVICES;
  }, [raw]);
  const layouts = useMemo(() => items.map((it) => layoutFor(findDisplay(findDevice(it.device), it.display), false)), [items, layoutFor]);
  const theme = modeIn(useUrlParams()).scheme;
  const zoom = parseZoom(search.get(PREVIEW_ZOOM_PARAM));

  const sets = useShotSets();
  const info = useListingInfo();
  const graphics = useGraphics();

  // The canvas's size, for Fit (as the prototype's stage).
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!stage) return;
    const ro = new ResizeObserver(() => setSize({ w: stage.clientWidth, h: stage.clientHeight }));
    ro.observe(stage);
    return () => ro.disconnect();
  }, [stage]);
  const fit = size.w ? multiFit(layouts, size.w, size.h) : 1;

  const screen = (item: DeviceItem, layout: (typeof layouts)[number]) => {
    const asset = sizeFor(item);
    if (!asset) return null;
    // In the screen's own corners, as the app's screen is (DeviceScreen).
    return (
      <div className={styles.screen} style={{ width: layout.vw, height: layout.vh, borderRadius: layout.screenRadius }}>
        <AppStorePage
          page={page}
          layout={layout}
          asset={asset}
          shots={shotsOf(sets, asset.id).slice(0, asset.max)}
          info={info}
          icon={graphics['appstore.icon']}
          header={graphics['appstore.header']}
          language={language}
          layoutFor={layoutFor}
          dark={theme === 'dark'}
          onPage={(p) => patch({ [PREVIEW_PAGE_PARAM]: p === 'search' ? 'search' : null })}
        />
      </div>
    );
  };

  return (
    <main ref={setStage} className={`${shell.stage} ${styles.view}`}>
      <MultiDevices
        items={items}
        layouts={layouts}
        scale={zoom === 'fit' ? fit : zoom}
        theme={theme}
        onChange={(next) => patch({ [PREVIEW_DEVICES_PARAM]: next.length ? serializeDevices(next) : null })}
        screen={screen}
        devices={OPTIONS}
        single
      />
      {/* Top left, as the prototype's view bar: back to the screenshots, and which page of the store. */}
      <div className={bar.viewBar} data-canvas-ui>
        <button type="button" className={bar.chip} title={t('Back to the screenshots')} onClick={() => patch({ view: null })}>
          <Icon name="arrow_back" size={18} />
          {t('Back')}
        </button>
        <span className={bar.viewSep} />
        <div className={bar.segment} role="radiogroup" aria-label={t('Page')}>
          {(['product', 'search'] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={page === p} className={`${bar.chip} ${page === p ? bar.active : ''}`} onClick={() => patch({ [PREVIEW_PAGE_PARAM]: p === 'search' ? 'search' : null })}>
              {p === 'product' ? t('Product page') : t('Search')}
            </button>
          ))}
        </div>
      </div>
      {/* Top right: the language, then the screens' Light / Dark, where the prototype has it. */}
      <div className={styles.topRight} data-canvas-ui>
        {LANGUAGES.length > 1 && (
          <label className={bar.select} title={t('The screenshots’ language')}>
            <Icon name="translate" size={16} />
            <span>{LANGUAGES.find((l) => l.id === language)?.name}</span>
            <Icon name="expand_more" size={16} />
            <select value={language} onChange={(e) => onLanguage(e.target.value as Language)} aria-label={t('Language')}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <ThemeSwitch />
      </div>
      <ZoomBar zoom={zoom} fitScale={fit} onZoom={(z) => patch({ [PREVIEW_ZOOM_PARAM]: z === 'fit' ? null : String(z) })} />
    </main>
  );
}

/**
 * The toolbar's Preview, in App Store Assets: the listing as the App Store shows it (`?view=preview`), or back to the
 * screenshots. Lit while it's on.
 */
export function PreviewButton({ className, activeClassName }: { className: string; activeClassName: string }) {
  const [search] = useSearchParams();
  const patch = usePatch();
  const on = search.get('view') === PREVIEW_VIEW;
  return (
    <button
      type="button"
      className={`${className} ${on ? activeClassName : ''}`}
      aria-pressed={on}
      title={t('See the listing as the App Store shows it, on several devices')}
      onClick={() => patch({ view: on ? null : PREVIEW_VIEW })}
    >
      <Icon name="visibility" size={18} />
      {t('Preview')}
    </button>
  );
}
