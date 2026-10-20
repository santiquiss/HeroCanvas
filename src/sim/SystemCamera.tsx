// The system's camera, as image_picker opens it (ImageSource.camera): iOS's UIImagePickerController (PHOTO, Cancel,
// the shutter, flip; then Retake / Use Photo) and Android's camera app (the shutter, flip; then ✕ / ✓). It opens on
// the front camera (image_picker's preferredCameraDevice: front, for a profile photo). The feed is a photo (data/photos)
// drifting a little, as a hand-held phone. Not the app's UI: the simulator's stand-in for the system's.
// In portrait the controls are under the viewfinder; turned, or beside the iPhone Duo's right column, they stand in a
// column on the right (as the iPhone's camera turned) and the viewfinder fills the rest. On the Duo that column is its
// own, below its camera, and holds icons only (Apple: a vertical bar takes icon items; text stays horizontal): close at
// the top, the shutter (or ✓, Use Photo) in the middle, flip (or retake) at the foot. Apple doesn't show the system
// camera on the Duo: this follows its rule for vertical bars. The status bar, and the Duo's corner status, hide over it.
import { useState } from 'react';
import type { DeviceOS } from '../devices/devices';
import { CAMERA_FEEDS, type CameraSide } from './photos';
import { useSim } from './SimContext';
import styles from './SystemCamera.module.css';
import { useOverlay } from './useOverlay';

const MS = 340;
/** The controls' column when it's on the side without the Duo's column (a phone turned). */
const SIDE_MIN = 112;

export interface SystemCameraProps {
  os: DeviceOS;
  open: boolean;
  onClose: () => void;
  /** The photo taken, once it's accepted (Use Photo / ✓). */
  onUse: (src: string) => void;
}

export function SystemCamera({ os, open, onClose, onUse }: SystemCameraProps) {
  const { layout: L } = useSim();
  const { mounted, on } = useOverlay(open, MS);
  const [side, setSide] = useState<CameraSide>('front');
  const [shot, setShot] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  if (!mounted) return null;
  const android = os === 'android';
  const aside = L.vw > L.vh || L.sideNav;
  const feed = CAMERA_FEEDS[side];
  const take = () => {
    setFlash((n) => n + 1);
    setShot(feed);
  };
  const sym = (name: string) => <span className={styles.sym}>{name}</span>;
  const text = (label: string, onClick: () => void) => (
    <button className={styles.text} onClick={onClick}>
      <span>{label}</span>
    </button>
  );
  const round = (icon: string, label: string, onClick: () => void, cls = '') => (
    <button className={`${styles.round} ${cls}`} aria-label={label} onClick={onClick}>
      {sym(icon)}
    </button>
  );
  const flip = round(android ? 'cameraswitch' : 'flip_camera_ios', 'Switch camera', () => setSide((s) => (s === 'front' ? 'back' : 'front')));
  const shutter = <button className={styles.shutter} aria-label="Take photo" onClick={take} />;
  const cancel = android ? round('close', 'Close', onClose) : text('Cancel', onClose);

  // The controls: first (left / top), the main one, last (right / bottom). On the side, icons only.
  const retake = aside || android ? round(aside ? 'replay' : 'close', 'Retake', () => setShot(null)) : text('Retake', () => setShot(null));
  const use = aside || android ? round('check', 'Use Photo', () => onUse(shot!), styles.accept) : text('Use Photo', () => onUse(shot!));
  const [first, main, last] = shot
    ? aside
      ? [round('close', 'Cancel', onClose), use, retake]
      : android
        ? [retake, use, <span key="slot" className={styles.slot} />]
        : [retake, null, use]
    : aside
      ? [round('close', 'Cancel', onClose), shutter, flip]
      : [cancel, shutter, flip];

  return (
    <div
      className={`${styles.root} ${android ? styles.android : styles.ios} ${aside ? styles.aside : ''} ${on ? styles.on : ''}`}
      data-status-bar="hidden"
      role="dialog"
      aria-label="Camera"
    >
      {!aside && (
        <div className={styles.top} style={{ paddingTop: L.sbH }}>
          {!shot && <span className={styles.topIcon}>{sym(android ? 'settings' : 'bolt')}</span>}
        </div>
      )}
      <div className={styles.view}>
        {shot ? (
          // The photo as saved: the front camera's preview is a mirror, the photo isn't (as iOS and Android save it).
          <img className={styles.feed} src={shot} alt="" draggable={false} />
        ) : (
          <img key={side} className={`${styles.feed} ${styles.live} ${side === 'front' ? styles.mirror : ''}`} src={feed} alt="" draggable={false} />
        )}
        {aside && !shot && <span className={`${styles.topIcon} ${styles.viewIcon}`}>{sym(android ? 'settings' : 'bolt')}</span>}
        {flash > 0 && <span key={flash} className={styles.flash} />}
      </div>
      <div
        className={styles.bottom}
        // Beside the Duo's column: its width, below its camera (where the hidden status was).
        style={aside ? { width: L.sideNav ? L.sideW : SIDE_MIN, paddingTop: L.sideNav ? L.statusTop : 16, paddingBottom: L.botIn + 12 } : { paddingBottom: L.botIn + 8 }}
      >
        {!shot && !android && !aside && <span className={styles.mode}>PHOTO</span>}
        <div className={styles.row}>
          {first}
          {main ?? <span />}
          {last}
        </div>
      </div>
    </div>
  );
}
