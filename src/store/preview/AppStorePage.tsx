// The App Store as a device shows the listing (Preview): its product page (the header art over it when the listing
// has one) and a search for it, as Apple's App Store template draws them (iOS 27: the Liquid Glass tab bar and
// buttons). Measures in points, from the template's iPhone (402 wide); a wider screen keeps them and lets its content
// breathe. What it shows is the listing's own: its icon and header (StoreData.graphics), its texts (StoreData.listing)
// and its screenshots for this device's size, drawn as App Store Assets draws them.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { hasSymbol, Icon } from '../../components/Icon';
import type { Layout } from '../../sim/layout';
import { CORNER_STATUS } from '../../sim/layout';
import { HomeIndicator, StatusBar } from '../../sim/SystemChrome';
import { LANGUAGES, type Language } from '../../sim/language';
import { ShotImage, type BackgroundRun, type Neighbor } from '../ShotImage';
import { runOf, type ListingInfo, type StoreShot } from '../shots';
import { storeOf, type StoreAsset } from '../sizes';
import type { StoreAssetsProps } from '../StoreAssets';
import styles from './StorePreview.module.css';

export type StorePage = 'product' | 'search';

export interface AppStorePageProps {
  page: StorePage;
  layout: Layout;
  /** The store size whose screenshots it shows (its display is the screenshots'). */
  asset: StoreAsset & { display: NonNullable<StoreAsset['display']> };
  shots: StoreShot[];
  info: ListingInfo;
  icon?: string;
  header?: string;
  language: Language;
  layoutFor: StoreAssetsProps['layoutFor'];
  /** The page in the store's dark colors. */
  dark?: boolean;
  /** Goes to the other page: Back on the product page to the search, the search's result to the product page. */
  onPage?: (page: StorePage) => void;
}

const file = (path?: string) => (path ? import.meta.env.BASE_URL + path : undefined);

/** A screenshot's width on the page: a phone's two and a bit across (the template's 234 of 402), a tablet's three. */
const shotWidth = (vw: number, tablet: boolean, search: boolean) => (search ? (tablet ? vw * 0.18 : (vw - 60) / 3) : tablet ? vw * 0.3 : vw * 0.582);

export function AppStorePage({ page, layout, asset, shots, info, icon, header, language, layoutFor, dark, onPage }: AppStorePageProps) {
  const tablet = layout.vw >= 600;
  const withHeader = page === 'product' && !!header;
  // The iPhone Duo's column (outer display): the page beside it, its tabs in it. Its corner status (inner): the top
  // controls leave it free.
  const side = layout.sideW;
  const controlsRight = 20 + layout.headerInsetR;
  // The page's own width: all of it, or beside the Duo's column (the header art and the screenshots run under it).
  const contentW = layout.vw - side;
  const beside = side ? { width: contentW } : undefined;
  const d = asset.display;
  // The template's sizes: an iPhone's screenshots 234 wide of 402; the Duo's outer display's 316 tall, two in a search.
  const productShotW = side ? (316 * d.w) / d.h : shotWidth(layout.vw, tablet, false);
  const searchCount = side ? 2 : tablet ? 5 : 3;
  const searchShotW = side ? (contentW - 40 - 10 * (searchCount - 1)) / searchCount : shotWidth(layout.vw, tablet, true);
  // The template's header art: an iPad's 21:9; the iPhone Duo outer's 200 tall; a phone's (and the Duo open) 402 by 210.
  const duo = asset.id.startsWith('appstore.duo');
  const artH = side ? 200 : tablet && !duo ? (layout.vw * 9) / 21 : layout.vw * 0.5224;
  // The top buttons: under the status bar, or on the row of a corner status (the Duo open), centered on it.
  const buttonsTop = layout.reserved ? layout.reserved.top + (layout.reserved.height - 46) / 2 : layout.sbH - 2;
  const root = useRef<HTMLDivElement>(null);
  // A new page starts at its top, its bar not yet compact.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    root.current?.removeAttribute('data-compact');
  }, [page]);
  // As the product page scrolls: the header art at half speed (centered in what's left of it in view), and the bar
  // compact (small icon, Get, glass behind) once Get reaches it. Set on the elements, not in state: the page (its
  // screenshots) isn't drawn again on every pixel.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = root.current;
    if (!el || page !== 'product') return;
    const y = e.currentTarget.scrollTop;
    const art = el.querySelector<HTMLElement>('[data-art]');
    if (art) art.style.transform = `translateY(${y / 2}px)`;
    const get = el.querySelector('[data-get]')?.getBoundingClientRect();
    const bar = el.querySelector('[data-bar]')?.getBoundingClientRect();
    if (get && bar) el.toggleAttribute('data-compact', get.top <= bar.bottom);
  };
  return (
    <div ref={root} className={styles.store} data-dark={dark || undefined} style={{ width: layout.vw, height: layout.vh }}>
      {/* The compact bar's glass, behind its buttons: shown once Get has scrolled up to them. */}
      {page === 'product' && !side && <div className={styles.compactBg} style={{ height: buttonsTop + 46 + 8 }} />}
      <div ref={scroller} className={styles.scroll} onScroll={onScroll}>
        {page === 'product' ? (
          <>
            {withHeader ? (
              <HeaderArt src={file(header)!} art={artH} top={layout.sbH} />
            ) : (
              <div style={{ height: layout.sbH + (side ? 0 : 54) }} />
            )}
            <div style={beside}>
              <AppHeader info={info} icon={icon} />
              {/* On the iPhone Duo, three cells across the page's width (the template's), the rest sideways. */}
              <Metadata info={info} languages={LANGUAGES.length} cellW={duo ? (contentW - 40) / 3 : undefined} />
            </div>
            <Carousel asset={asset} shots={shots} width={productShotW} radius={tablet ? 18 : 26} language={language} layoutFor={layoutFor} />
          </>
        ) : (
          <div style={beside}>
            <div style={{ height: side ? 84 : layout.sbH + 76 }} />
            <SearchCell info={info} icon={icon} onOpen={onPage && (() => onPage('product'))}>
              <Carousel asset={asset} shots={shots.slice(0, searchCount)} width={searchShotW} radius={12.7} language={language} layoutFor={layoutFor} still />
            </SearchCell>
            <Placeholder count={searchCount} ratio={d.w / d.h} />
          </div>
        )}
        <div style={{ height: 120 }} />
      </div>
      {page === 'product' ? (
        side ? (
          // The Duo's column: back and share one over the other, under its status (the template's 169 and 229).
          <div className={styles.columnButtons} style={{ top: layout.statusTop + CORNER_STATUS.vertical.h + 26, width: side }}>
            <GlassButton icon="sf:chevron.backward" fallback="arrow_back_ios_new" label="Back" onTap={onPage && (() => onPage('search'))} />
            <GlassButton icon="sf:square.and.arrow.up" fallback="ios_share" />
          </div>
        ) : (
          <div className={styles.topButtons} data-bar style={{ top: buttonsTop, right: controlsRight - 4 }}>
            <GlassButton icon="sf:chevron.backward" fallback="arrow_back_ios_new" label="Back" onTap={onPage && (() => onPage('search'))} />
            {/* Compact: the app's small icon in the middle, Get in share's place. */}
            <span className={styles.compactIcon}>
              <AppIcon src={icon} size={32} />
            </span>
            <span className={styles.compactSwap}>
              <span className={styles.shareSlot}>
                <GlassButton icon="sf:square.and.arrow.up" fallback="ios_share" />
              </span>
              <span className={`${styles.getButton} ${styles.compactGet}`}>Get</span>
            </span>
          </div>
        )
      ) : (
        <>
          {/* The scroll edge (iOS 26 on): what scrolls under the status bar and the search blurs and fades into the page. */}
          <div className={styles.scrollEdge} style={{ height: (side ? 8 : layout.sbH) + 8 + 44 + 18 }} />
          <SearchToolbar text={info.name.split(' ')[0]} top={side ? 8 : layout.sbH} right={side + controlsRight} />
        </>
      )}
      <TabBar selected={page === 'product' ? 'apps' : 'search'} column={side ? { width: side, top: layout.statusTop } : undefined} />
      <StatusBar layout={layout} />
      <HomeIndicator layout={layout} />
    </div>
  );
}

/** SF's weights as Icon takes them, and their names in the symbols' files (`chevron.backward:semibold`). */
const WEIGHTS = { regular: 400, medium: 500, semibold: 600 } as const;

/**
 * A symbol by its SF name, in its weight, where this copy has made it (`npm run symbols`), else Material's closest:
 * the store's glyphs are SF Symbols.
 */
function Glyph({ sf, material, size, weight = 'regular' }: { sf: string; material: string; size: number; weight?: keyof typeof WEIGHTS }) {
  const name = sf.slice(3);
  const made = hasSymbol(name) || hasSymbol(`${name}:${weight}`);
  return made ? <Icon name={sf} size={size} weight={WEIGHTS[weight]} /> : <Icon name={material} size={size} fill weight={WEIGHTS[weight]} />;
}

/** A round Liquid Glass button (44), its symbol large and regular, as the store's back and share. */
function GlassButton({ icon, fallback, label, onTap }: { icon: string; fallback: string; label?: string; onTap?: () => void }) {
  const glyph = <Glyph sf={icon} material={fallback} size={30} />;
  return onTap ? (
    <button type="button" className={`${styles.glass} ${styles.glassButton} ${styles.tappable}`} aria-label={label} onClick={onTap}>
      {glyph}
    </button>
  ) : (
    <span className={`${styles.glass} ${styles.glassButton}`}>{glyph}</span>
  );
}

/**
 * The header art as the store shows it: its picture center-cropped under the status bar (`art` tall), and behind the
 * status bar the same picture mirrored and blurred, so it reaches the screen's top edge.
 */
function HeaderArt({ src, art, top }: { src: string; art: number; top: number }) {
  return (
    <div className={styles.headerArt} style={{ height: top + art }}>
      {/* Moved at half the scroll (data-art): what's left of it in view keeps it centered, the blur going up with it. */}
      <div className={styles.headerInner} data-art>
        {/* Mirrored twice: sharp underneath, blurred over it, so where the blur thins at its edges it shows the same
            colors, never the page's white (no seam against the picture). */}
        <div className={styles.headerMirror} style={{ height: top }}>
          <img src={src} alt="" style={{ height: art }} />
          <img className={styles.headerBlur} src={src} alt="" style={{ height: art }} />
        </div>
        <img className={styles.headerMain} src={src} alt="" style={{ top, height: art }} />
      </div>
    </div>
  );
}

/** The app's icon (118), its name and subtitle, and Get: the template's App page header. */
function AppHeader({ info, icon }: { info: ListingInfo; icon?: string }) {
  return (
    <div className={styles.appHeader}>
      <AppIcon src={icon} size={118} />
      <div className={styles.appHeaderText}>
        <div className={styles.titles}>
          <span className={styles.appName}>{info.name}</span>
          <span className={styles.appSubtitle}>{info.subtitle}</span>
        </div>
        <span className={styles.getRow}>
          <span className={styles.getButton} data-get>
            Get
          </span>
          {info.inAppPurchases && <span className={styles.inApp}>In-App Purchases</span>}
        </span>
      </div>
    </div>
  );
}

function AppIcon({ src, size }: { src?: string; size: number }) {
  // The store's rounded square: a radius of 22.4% of its side (26 at 118), a hairline around it.
  return <span className={styles.appIcon} style={{ width: size, height: size, borderRadius: size * 0.224, backgroundImage: src ? `url("${file(src)}")` : undefined }} />;
}

const stars = (n: number) => '★★★★★'.slice(0, Math.round(n)).padEnd(5, '☆');

/** Ratings, age, chart and developer, between hairlines: the template's App Page Metadata. */
/**
 * Ratings, age, category or chart, developer and languages, side by side in cells of one width that scroll sideways
 * (the store shows two and a bit on an iPhone), hairlines between.
 */
function Metadata({ info, languages, cellW }: { info: ListingInfo; languages: number; cellW?: number }) {
  const cells: { label: string; value: ReactNode; sub: ReactNode }[] = [
    { label: `${info.ratings} ratings`, value: info.rating.toFixed(1), sub: <span className={styles.stars}>{stars(info.rating)}</span> },
    { label: 'Age Rating', value: info.age, sub: 'Years Old' },
    ...(info.chart ? [{ label: 'Chart', value: <>No.{info.chart}</>, sub: info.category }] : [{ label: 'Category', value: <Glyph sf="sf:figure.run" material="directions_run" size={30} />, sub: info.category }]),
    { label: 'Developer', value: <Glyph sf="sf:person.crop.circle" material="account_circle" size={30} />, sub: info.developer },
    { label: 'Language', value: 'EN', sub: languages > 1 ? `+ ${languages - 1} More` : 'English' },
  ];
  return (
    // The line over it stays put while its cells scroll sideways (it's the box's, not the row's).
    <div className={styles.metaWrap}>
    <div className={styles.metadata}>
      {cells.map((c, i) => (
        <div key={i} className={styles.metaCell} style={cellW ? { width: cellW } : undefined}>
          <span className={styles.metaLabel}>{c.label}</span>
          <span className={styles.metaValue}>{c.value}</span>
          <span className={styles.metaSub}>{c.sub}</span>
        </div>
      ))}
    </div>
    </div>
  );
}

/** The listing's screenshots side by side, scrolling sideways, as the size's row draws them. */
function Carousel({ asset, shots, width, radius, language, layoutFor, still }: { asset: AppStorePageProps['asset']; shots: StoreShot[]; width: number; radius: number; language: Language; layoutFor: StoreAssetsProps['layoutFor']; still?: boolean }) {
  const d = asset.display;
  const h = (width * d.h) / d.w;
  return (
    <div className={`${styles.carousel} ${still ? styles.carouselStill : ''}`}>
      {shots.map((shot, i) => (
        <PreviewShot key={shot.id} shots={shots} index={i} asset={asset} w={width} h={h} radius={radius} language={language} layoutFor={layoutFor} />
      ))}
    </div>
  );
}

/** One screenshot at the page's size: drawn (at its own points, scaled) once it nears the screen's view. */
function PreviewShot({ shots, index, asset, w, h, radius, language, layoutFor }: { shots: StoreShot[]; index: number; asset: AppStorePageProps['asset']; w: number; h: number; radius: number; language: Language; layoutFor: StoreAssetsProps['layoutFor'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '0px 300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const d = asset.display;
  const shot = shots[index];
  // As its row draws it: what of the others reaches into it, and a background shared across a run.
  const span = runOf(shots, index);
  const run: BackgroundRun | undefined =
    span.end > span.start ? { background: shots[span.start].background, count: span.end - span.start + 1, at: index - span.start, spread: shots[span.start].spread } : undefined;
  const neighbors: Neighbor[] = shots.flatMap((n, j) => (j === index ? [] : [{ shot: n, at: j - index }]));
  return (
    <div ref={ref} className={styles.shot} style={{ width: w, height: h, borderRadius: radius } as CSSProperties}>
      {near && (
        <div style={{ width: d.w, height: d.h, transform: `scale(${w / d.w})`, transformOrigin: '0 0' }}>
          <ShotImage shot={shot} display={d} language={language} layoutFor={layoutFor} neighbors={neighbors} gap={storeOf(asset).gap} run={run} />
        </div>
      )}
    </div>
  );
}

/** The search field over the results: the template's Search toolbar. */
function SearchToolbar({ text, top, right }: { text: string; top: number; right: number }) {
  return (
    <div className={styles.searchToolbar} style={{ top: top + 8, right }}>
      <span className={`${styles.glass} ${styles.searchField}`}>
        <Glyph sf="sf:magnifyingglass" material="search" size={20} weight="medium" />
        <span className={styles.searchText}>{text}</span>
        <Glyph sf="sf:xmark.circle.fill" material="cancel" size={22} />
      </span>
      <span className={`${styles.glass} ${styles.glassButton}`}>
        <Glyph sf="sf:xmark" material="close" size={22} weight="medium" />
      </span>
    </div>
  );
}

/** The listing as a search result: icon, name, category and Get; stars, developer, category; its first screenshots. */
/** The result: a tap anywhere on it opens the product page, as in the store. */
function SearchCell({ info, icon, onOpen, children }: { info: ListingInfo; icon?: string; onOpen?: () => void; children: ReactNode }) {
  return (
    <div className={`${styles.searchCell} ${onOpen ? styles.tappable : ''}`} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onClick={onOpen} onKeyDown={onOpen && ((e) => e.key === 'Enter' && onOpen())}>
      <div className={styles.cellHead}>
        <AppIcon src={icon} size={60} />
        <div className={styles.cellTitles}>
          <span className={styles.cellName}>{info.name}</span>
          <span className={styles.cellCategory}>{info.subtitle || info.category}</span>
        </div>
        <span className={styles.cellGet}>Get</span>
      </div>
      <div className={styles.cellMeta}>
        <span>
          <span className={styles.stars}>{stars(info.rating)}</span> {info.ratings}
        </span>
        <span>
          <Glyph sf="sf:person.crop.circle" material="account_circle" size={15} /> {info.developer}
        </span>
        <span>
          <Glyph sf="sf:figure.run" material="directions_run" size={15} /> {info.category}
        </span>
      </div>
      {children}
    </div>
  );
}

/** The results after it, still loading: the template's placeholder cell, as many screenshots as the result above. */
function Placeholder({ count, ratio }: { count: number; ratio: number }) {
  return (
    <div className={styles.placeholder} aria-hidden>
      <div className={styles.phRow}>
        <span className={styles.phIcon} />
        <span className={styles.phLines}>
          <span style={{ width: '45%' }} />
          <span style={{ width: '75%' }} />
        </span>
        <span className={styles.phGet} />
      </div>
      <div className={styles.phShots}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} style={{ aspectRatio: ratio }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The store's tabs with its own glyphs, the originals from Apple's App Store template (public/assets/store/appstore-icons,
 * its Duo Tab Bar): the App Store draws them, not SF Symbols. Width and height in points, as the template's.
 */
const TABS = [
  { id: 'today', label: 'Today', glyph: 'today', w: 19, h: 24 },
  { id: 'games', label: 'Games', glyph: 'games', w: 24.3, h: 24.6 },
  { id: 'apps', label: 'Apps', glyph: 'apps', w: 24.8, h: 23.7 },
  { id: 'arcade', label: 'Arcade', glyph: 'arcade', w: 26.3, h: 24 },
] as const;

/** One of the template's glyphs, as a mask in the text's color (`scale`: over its own size in points). */
function TemplateGlyph({ name, w, h, scale = 1 }: { name: string; w: number; h: number; scale?: number }) {
  const url = `url("${import.meta.env.BASE_URL}assets/store/appstore-icons/${name}.svg")`;
  return <span className={styles.templateGlyph} style={{ width: w * scale, height: h * scale, maskImage: url, WebkitMaskImage: url }} aria-hidden />;
}

/**
 * The Liquid Glass tab bar: four tabs in a pill, Search apart in its own circle. In the iPhone Duo's column, upright
 * (the template's Vertical style), its tabs icons only.
 */
function TabBar({ selected, column }: { selected: 'apps' | 'search'; column?: { width: number; top: number } }) {
  return (
    <div className={`${styles.tabBar} ${column ? styles.tabBarColumn : ''}`} style={column ? { width: column.width } : undefined}>
      <div className={`${styles.glass} ${styles.tabs}`}>
        {TABS.map((tab) => (
          <span key={tab.id} className={`${styles.tab} ${selected === tab.id ? styles.tabOn : ''}`}>
            <span className={styles.tabIcon}>
              <TemplateGlyph name={tab.glyph} w={tab.w} h={tab.h} />
            </span>
            <span>{tab.label}</span>
          </span>
        ))}
      </div>
      <span className={`${styles.glass} ${styles.searchTab} ${selected === 'search' ? styles.searchTabOn : ''}`}>
        <TemplateGlyph name="search" w={21.1} h={21.3} scale={1.1} />
      </span>
    </div>
  );
}
