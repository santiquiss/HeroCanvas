// The system's photo picker, as image_picker opens it (ImageSource.gallery): iOS's PHPicker and Android's Photo
// Picker, the library in a grid. Tapping a photo picks it and closes the picker. Not the app's UI: the simulator's
// stand-in for the system's, as the keyboard (SystemKeyboard).
// Where it sits follows the system's sheets:
// - a phone: a sheet from the top, the bar across it (close, Photos / Collections, Add);
// - 600 wide or more (iPad, the iPhone Duo's inner display): a centered sheet (Apple: sheets on the inner display are
//   centered, their bars horizontal). iPadOS's (26): a sidebar in a panel of its own (close, Photos, Collections, the
//   pinned collections, Albums), the title and a search field over a grid of five, and Filter and Location Included at
//   its foot. Android's: the phone's, centered;
// - the iPhone Duo's outer display (bars in the right column): under the corner status, its icon buttons in a vertical
//   bar on the right (close at the top, Add under it); the segmented control, too wide for it, stays at the top.
import type { DeviceOS } from '../devices/devices';
import { tallSheetTop } from './layout';
import { useSim } from './SimContext';
import styles from './SystemPhotoPicker.module.css';
import { useOverlay } from './useOverlay';

const MS = 340;
/** A centered sheet's size at most (iPadOS 26's picker, in points). */
const FORM = { w: 713, h: 640 };
/** iPadOS's sidebar: what it lists under Pinned, with its SF Symbol's Material twin. */
const PINNED: [string, string][] = [
  ['Favorites', 'favorite'],
  ['Recently Saved', 'download_for_offline'],
  ['Videos', 'videocam'],
  ['Screenshots', 'screenshot_region'],
  ['People & Pets', 'account_circle'],
];

export interface SystemPhotoPickerProps {
  os: DeviceOS;
  photos: string[];
  open: boolean;
  onClose: () => void;
  onPick: (src: string) => void;
}

export function SystemPhotoPicker({ os, photos, open, onClose, onPick }: SystemPhotoPickerProps) {
  const { layout: L } = useSim();
  const { mounted, on } = useOverlay(open, MS);
  if (!mounted) return null;
  const android = os === 'android';
  const form = L.vw >= 600;
  const side = !form && L.cornerStatus === 'vertical';
  const top = tallSheetTop(L) + (android && !side ? 38 : 0);
  const sheet = form
    ? (() => {
        const w = Math.min(L.vw - 48, FORM.w);
        const h = Math.min(L.vh - top - 24, FORM.h);
        return { left: (L.vw - w) / 2, width: w, top: Math.max(top, (L.vh - h) / 2), height: h };
      })()
    : { left: 0, right: 0, top, bottom: 0, paddingBottom: L.botIn };

  const close = (
    <button className={styles.close} aria-label="Close" onClick={onClose}>
      <span className={styles.sym}>close</span>
    </button>
  );
  // iOS's Add stays off with nothing selected; a tap on a photo picks it at once (single selection).
  const add = !android && (
    <span className={styles.done} aria-hidden>
      <span className={styles.sym}>check</span>
    </span>
  );
  const tabs = (
    <div className={styles.tabs}>
      <span className={`${styles.tab} ${styles.tabOn}`}>Photos</span>
      <span className={styles.tab}>{android ? 'Albums' : 'Collections'}</span>
    </div>
  );
  const sym = (name: string) => <span className={styles.sym}>{name}</span>;
  return (
    <div className={`${styles.root} ${android ? styles.android : styles.ios} ${form ? styles.form : ''} ${on ? styles.on : ''}`}>
      <div className={styles.shim} onClick={onClose} />
      <div className={styles.sheet} style={sheet} role="dialog" aria-label="Photos">
        {android && !form && <span className={styles.handle} />}
        {form && !android ? (
          <div className={styles.split}>
            <nav className={styles.sidebar}>
              <button className={styles.sideClose} aria-label="Close" onClick={onClose}>
                {sym('close')}
              </button>
              <span className={`${styles.sideRow} ${styles.sideOn}`}>
                {sym('photo_library')}
                <span>Photos</span>
              </span>
              <span className={styles.sideRow}>
                {sym('stacks')}
                <span>Collections</span>
              </span>
              <span className={styles.sideHead}>
                <span>Pinned</span>
                {sym('expand_more')}
              </span>
              {PINNED.map(([label, icon]) => (
                <span key={label} className={styles.sideRow}>
                  {sym(icon)}
                  <span>{label}</span>
                </span>
              ))}
              <span className={styles.sideHead}>
                <span>Albums</span>
                {sym('chevron_right')}
              </span>
            </nav>
            <div className={styles.content}>
              <div className={styles.contentBar}>
                <span className={styles.contentTitle}>Photos</span>
                <span className={styles.search}>
                  {sym('search')}
                  <span className={styles.searchHint}>Search your photos</span>
                  {sym('mic')}
                </span>
              </div>
              <Grid photos={photos} onPick={onPick} />
              <div className={styles.foot}>
                <span className={styles.footRound}>{sym('filter_list')}</span>
                <span className={styles.footOption}>
                  {sym('near_me')}
                  <span>Location Included</span>
                </span>
              </div>
            </div>
          </div>
        ) : side ? (
          <div className={styles.sideBody}>
            <div className={styles.main}>
              <div className={styles.barTabs}>{tabs}</div>
              <Grid photos={photos} onPick={onPick} />
            </div>
            <div className={styles.vbar} style={{ width: L.sideW }}>
              {close}
              {add}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.bar}>
              {close}
              {tabs}
              {add || <span />}
            </div>
            <Grid photos={photos} onPick={onPick} />
          </>
        )}
      </div>
    </div>
  );
}

function Grid({ photos, onPick }: { photos: string[]; onPick: (src: string) => void }) {
  return (
    <div className={styles.grid}>
      {photos.map((src) => (
        <button key={src} className={styles.cell} onClick={() => onPick(src)}>
          <img src={src} alt="" loading="lazy" draggable={false} />
        </button>
      ))}
    </div>
  );
}
