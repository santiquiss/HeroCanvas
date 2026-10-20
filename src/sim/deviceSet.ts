// A custom set of devices side by side (`?devices=`): each with its own display and orientation, repeats allowed.
// One item: the plain `device` / `display` / `land` params instead, so single-device links stay as they were.
//   ?devices=ip17,ipduo:inner:l   → iPhone 17 Pro, then iPhone Duo inner display in landscape
// A device may show another design than the toolbar's, its fourth field: `live`, a proposal, or `proposal~version`.
//   ?devices=ip17:::live,ip17:::PJ-4   → Live beside the proposal
// And its own language, the fifth (over `?lang=`):
//   ?devices=ip17,ip17::::es,ip17::::de   → the same screen in English, Spanish and German
import { DEVICES, findDevice, findDisplay } from '../devices/devices';
import { LANGUAGES, type Language } from './language';

export interface DeviceItem {
  device: string;
  display: string;
  land: boolean;
  /** Its own design instead of the toolbar's: `live`, a proposal id, or `proposal~version`. None: the toolbar's. */
  design?: string;
  /** Its own language instead of the device's (`?lang=`). None: that one. */
  lang?: Language;
}

/** A device's design → what its screen shows (null: the toolbar's). */
export function designChoice(design: string | undefined): { proposal: string | null; variant: string | null } | null {
  if (!design) return null;
  if (design === 'live') return { proposal: null, variant: null };
  const [proposal, variant = null] = design.split('~');
  return { proposal, variant };
}

export function parseDevices(raw: string | null): DeviceItem[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => {
      const [id, display = '', l, design, lang] = part.split(':');
      if (!DEVICES.some((d) => d.id === id)) return null;
      const dev = findDevice(id);
      const own = LANGUAGES.find((x) => x.id === lang)?.id;
      return { device: id, display: findDisplay(dev, display).key, land: l === 'l', ...(design ? { design } : {}), ...(own ? { lang: own } : {}) };
    })
    .filter((x): x is DeviceItem => !!x);
}

export function serializeDevices(items: DeviceItem[]): string {
  return items
    .map((it) => {
      const dev = findDevice(it.device);
      const display = dev.displays.length > 1 ? it.display : '';
      return [it.device, display, it.land ? 'l' : '', it.design ?? '', it.lang ?? ''].join(':').replace(/:+$/, '');
    })
    .join(',');
}

/** URL params for a set: two or more → `devices`; one → the plain single-device params. */
export function deviceSetParams(items: DeviceItem[]): Record<string, string | null> {
  if (items.length >= 2) return { devices: serializeDevices(items), device: null, display: null, land: null };
  const it = items[0];
  const dev = findDevice(it.device);
  return { devices: null, device: it.device, display: dev.displays.length > 1 ? it.display : null, land: it.land ? '1' : null };
}
