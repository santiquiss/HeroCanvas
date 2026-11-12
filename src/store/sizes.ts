// What a store listing's images are, store by store, as App Store Connect and Google Play Console ask for them
// (checked 2026-10-26: their specification pages, linked in each store's sources). Screenshots HeroCanvas makes: each
// drawn on a display of its own (a catalog device's where the size is one, so the app lays out as on it), the screen
// alone, at the store's pixels. The other assets (icons, feature graphics, creative assets) are listed so the set is
// whole; they're made elsewhere for now.
import { ALL_DEVICES, type Display } from '../devices/devices';
import { t } from '../i18n/ui';

export type StoreId = 'appstore' | 'play';

export interface StoreAsset {
  /** Unique across stores: `appstore.iphone63`. */
  id: string;
  store: StoreId;
  /** A screenshot set (made here from the prototype's screens) or a graphic (made elsewhere for now). */
  kind: 'screenshot' | 'graphic';
  label: string;
  /** The devices it covers, or what it's for. */
  note: string;
  /** The sizes the store takes, in pixels (portrait); the first is what HeroCanvas exports. */
  sizes: [w: number, h: number][];
  /** A screenshot's screen, in points: the first size divided by its scale. */
  display?: Display;
  /** How many the store takes (screenshots: per language). */
  min: number;
  max: number;
  /** `conditional`: when the app is on that platform, or from a date (requiredNote says which). */
  required: 'yes' | 'conditional' | 'no';
  requiredNote?: string;
  /** Not uploaded by hand (the store takes it from the app's build): left out of the export. */
  fromBuild?: boolean;
  /** Not required, but worth making: why (Apple's screenshot specifications). Shown as Recommended. */
  recommended?: string;
  format: string;
  /** What the store checks, and what to know before making it. */
  rules: string[];
}

export interface StoreGroup {
  name: string;
  assets: StoreAsset[];
}

export interface Store {
  id: StoreId;
  name: string;
  groups: StoreGroup[];
  /** The store's advice for a listing's images. */
  tips: string[];
  /**
   * The space its gallery leaves between two screenshots, as a share of a screenshot's width: an element across two
   * goes on after it (not where the first ends), and the canvas shows them this far apart.
   */
  gap: number;
  sources: { label: string; url: string }[];
}

/** A catalog device's display (the app lays out on it as in Prototype). */
const deviceDisplay = (device: string, key = 'main'): Display => {
  const x = ALL_DEVICES.find((d) => d.id === device)?.displays.find((y) => y.key === key);
  if (!x) throw new Error(`App Store Assets: no display ${device}/${key}`);
  return x;
};
/** A screen no catalog device has, in points: its corners' radius and the bezel its frame draws around it. */
const screen = (key: string, label: string, w: number, h: number, os: Display['os'], r: number, extra: Partial<Display> = {}): Display => ({ key, label, w, h, os, r, bez: 12, ...extra });

type Spec = Omit<StoreAsset, 'id' | 'store' | 'rules'> & { key: string; rules?: string[] };
const assets = (store: StoreId, list: Spec[]): StoreAsset[] =>
  list.map(({ key, rules = [], display, ...a }) => {
    const id = `${store}.${key}`;
    // Its own copy of the display, so where a screenshot is drawn tells which size it is (sizeOf): two sizes on the
    // same device (an iPhone in both stores) keep their own layers' values apart.
    const own = display && { ...display };
    if (own) SIZE_OF.set(own, id);
    return { id, store, rules, ...a, ...(own && { display: own }) };
  });

const SIZE_OF = new WeakMap<Display, string>();
/** The store size a display is drawn for (its id: `appstore.ipad13`), as given to the canvas. */
export const sizeOf = (display: Display | undefined): string | undefined => (display ? SIZE_OF.get(display) : undefined);

// Every Apple screenshot's format; the count (1 to 10) is per language.
const APPLE_SHOT = t('JPEG or PNG, no transparency');
const appleShot = (note: string) => [note];
// Every Google graphic's and screenshot's format.
const PLAY_IMAGE = t('JPEG or 24-bit PNG, no transparency');
const DUO_NOTE = t('Required from April 2027 for apps built with the iOS 27.1 SDK or later. Both Duo sets earn the “optimized for iPhone Duo” badge.');
const TABLET_NOTE = t('Not needed to publish; 4 or more show the app to large-screen users (with the adaptive quality’s Tier 2 or 1, its badge).');
const TABLET_RULES = [t('9:16 or 16:9, sides from 1080 to 7680 px.'), t('The tablet layout, not the phone one stretched; no text outside the app, it gets cropped.')];

export const STORES: Store[] = [
  {
    id: 'appstore',
    name: 'App Store',
    // On an iPhone's product page, about 10 pt between screenshots about 220 pt wide.
    gap: 0.045,
    groups: [
      {
        name: 'iPhone',
        assets: assets('appstore', [
          {
            key: 'iphone63',
            kind: 'screenshot',
            label: 'iPhone 6.3″',
            note: t('Dynamic Island, medium: iPhone 18 Pro, 17 Pro, 17, 16 Pro, 16, 15 Pro, 15, 14 Pro'),
            sizes: [
              [1206, 2622],
              [1179, 2556],
            ],
            display: deviceDisplay('ip17'),
            min: 1,
            max: 10,
            required: 'yes',
            requiredNote: t('The one iPhone size App Store Connect asks for: the others are optional, and use scaled copies of a larger one when missing.'),
            format: APPLE_SHOT,
            rules: appleShot(t('Used scaled on Face ID medium iPhones (5.8″, 6.1″) when they have none.')),
          },
          {
            key: 'iphone69',
            kind: 'screenshot',
            label: 'iPhone 6.9″',
            note: t('Dynamic Island, large: iPhone Air, 18 Pro Max, 17 Pro Max, 16 Pro Max, 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max'),
            sizes: [
              [1320, 2868],
              [1290, 2796],
              [1260, 2736],
            ],
            display: deviceDisplay('ip17pm'),
            min: 0,
            max: 10,
            required: 'no',
            recommended: t('The largest iPhones: Apple names no clear stand-in for them (the 6.5″ and the 6.9″ each point to the other).'),
            format: APPLE_SHOT,
            rules: appleShot(t('Without it, the 6.5″ set is used, scaled.')),
          },
          {
            key: 'iphone65',
            kind: 'screenshot',
            label: 'iPhone 6.5″',
            note: t('Face ID, large: iPhone 14 Plus, 13 Pro Max, 12 Pro Max, 11 Pro Max, 11, XS Max, XR'),
            sizes: [
              [1284, 2778],
              [1242, 2688],
            ],
            display: deviceDisplay('ip14plus'),
            min: 0,
            max: 10,
            required: 'no',
            requiredNote: t('Needed only when there’s no Dynamic Island set (6.3″ or 6.9″).'),
            format: APPLE_SHOT,
            rules: appleShot(t('Without it, the 6.9″ set is used, scaled.')),
          },
          {
            key: 'iphone61',
            kind: 'screenshot',
            label: 'iPhone 6.1″',
            note: t('Face ID, medium: iPhone 17e, 16e, 14, 13 Pro, 13, 13 mini, 12 Pro, 12, 12 mini, 11 Pro, XS, X'),
            sizes: [
              [1170, 2532],
              [1125, 2436],
              [1080, 2340],
            ],
            display: deviceDisplay('ip16e'),
            min: 0,
            max: 10,
            required: 'no',
            format: APPLE_SHOT,
            rules: appleShot(t('Without it, the 6.3″ set is used, scaled.')),
          },
          {
            key: 'iphone55',
            kind: 'screenshot',
            label: 'iPhone 5.5″',
            note: t('Home button: iPhone 8 Plus, 7 Plus, 6s Plus'),
            sizes: [[1242, 2208]],
            display: deviceDisplay('ip8plus'),
            min: 0,
            max: 10,
            required: 'no',
            format: APPLE_SHOT,
            rules: appleShot(t('Smaller Home-button iPhones (4.7″, 4″) use this set, scaled.')),
          },
        ]),
      },
      {
        name: 'iPad',
        assets: assets('appstore', [
          {
            key: 'ipad13',
            kind: 'screenshot',
            label: 'iPad 13″',
            note: t('iPad Pro M5, M4, 3rd–6th gen; iPad Air M2–M4'),
            sizes: [
              [2064, 2752],
              [2048, 2732],
            ],
            display: deviceDisplay('ipad13'),
            min: 1,
            max: 10,
            required: 'conditional',
            requiredNote: t('Required when the app runs on iPad. The smaller iPads use it, scaled, when they have none.'),
            format: APPLE_SHOT,
            rules: appleShot(t('Show the iPad layout, not the phone one stretched.')),
          },
          {
            key: 'ipad11',
            kind: 'screenshot',
            label: 'iPad 11″',
            note: t('iPad Pro 11″, iPad Air, iPad, iPad mini'),
            sizes: [
              [1668, 2420],
              [1668, 2388],
              [1640, 2360],
              [1488, 2266],
            ],
            display: deviceDisplay('ipad11'),
            min: 0,
            max: 10,
            required: 'no',
            format: APPLE_SHOT,
            rules: appleShot(t('Without it, the 13″ set is used, scaled.')),
          },
        ]),
      },
      {
        name: 'iPhone Duo',
        assets: assets('appstore', [
          {
            key: 'duoOuter',
            kind: 'screenshot',
            label: t('iPhone Duo, outer'),
            note: t('The outer display, folded'),
            sizes: [[1398, 2034]],
            display: deviceDisplay('ipduo', 'outer'),
            min: 1,
            max: 10,
            required: 'conditional',
            requiredNote: DUO_NOTE,
            recommended: DUO_NOTE,
            format: APPLE_SHOT,
            rules: appleShot(t('Its own size: no other set is scaled into it.')),
          },
          {
            key: 'duoInner',
            kind: 'screenshot',
            label: t('iPhone Duo, inner'),
            note: t('The inner display, open'),
            sizes: [[2007, 2853]],
            display: deviceDisplay('ipduo', 'inner'),
            min: 1,
            max: 10,
            required: 'conditional',
            requiredNote: DUO_NOTE,
            recommended: DUO_NOTE,
            format: APPLE_SHOT,
            rules: appleShot(t('Its own size: no other set is scaled into it.')),
          },
        ]),
      },
      {
        name: t('Listing graphics'),
        assets: assets('appstore', [
          {
            key: 'icon',
            kind: 'graphic',
            label: t('App Store icon'),
            note: t('From the app’s build, not uploaded'),
            fromBuild: true,
            sizes: [[1024, 1024]],
            min: 1,
            max: 1,
            required: 'yes',
            format: t('PNG, opaque, square corners'),
            rules: [t('It comes from the app’s asset catalog (or Icon Composer): the store masks the corners.'), t('Dark, tinted and clear versions are made in Icon Composer.')],
          },
          {
            key: 'header',
            kind: 'graphic',
            label: t('Product page header'),
            note: t('Creative asset, iOS and iPadOS 27 and later'),
            sizes: [
              [3840, 1646],
              [5244, 2950],
            ],
            min: 0,
            max: 1,
            required: 'no',
            format: t('21:9 JPEG or PNG, or 16:9 PNG; no transparency'),
            rules: [t('One clear idea, the key art inside the template’s safe area. No prices or discounts.'), t('Reviewed on its own, from the Asset Library.')],
          },
          {
            key: 'search',
            kind: 'graphic',
            label: t('Search result art'),
            note: t('Creative asset, iOS and iPadOS 27 and later'),
            sizes: [
              [3840, 2560],
              [1920, 1280],
              [5244, 2950],
            ],
            min: 0,
            max: 1,
            required: 'no',
            format: t('3:2 JPEG or PNG, or 16:9 PNG; no transparency'),
            rules: [t('Without it, search shows the app’s events, previews or first screenshots.')],
          },
          {
            key: 'eventCard',
            kind: 'graphic',
            label: t('In-app event card'),
            note: t('Each event, in search and on the product page'),
            sizes: [
              [1920, 1080],
              [3840, 2160],
            ],
            min: 1,
            max: 1,
            required: 'conditional',
            requiredNote: t('For each in-app event.'),
            format: t('16:9 JPEG or PNG, up to 500 MB'),
            rules: [t('The event’s details page takes a 9:16 image (1080 × 1920 to 2160 × 3840).')],
          },
          {
            key: 'iap',
            kind: 'graphic',
            label: t('In-app purchase image'),
            note: t('A purchase or subscription promoted on the page'),
            sizes: [[1024, 1024]],
            min: 0,
            max: 1,
            required: 'conditional',
            requiredNote: t('Only to promote the purchase on the product page or in a win-back offer.'),
            format: t('JPEG or PNG, RGB, flattened, square corners'),
          },
        ]),
      },
    ],
    tips: [
      t('Show the app in use, not only title art, a login or a splash screen.'),
      t('The first three screenshots show in search when there’s no preview: lead with the strongest feature, one idea each, as a story.'),
      t('If the app has a dark mode, show it in at least one.'),
      t('Short captions are allowed; localize them with each language.'),
      t('Use made-up data, never a real person’s. No prices, URLs, awards, Apple’s recognitions or other platforms’ names.'),
      t('Everything must suit a 4+ rating, whatever the app’s rating.'),
      t('A new language uses the primary language’s screenshots until it has its own.'),
    ],
    sources: [
      { label: t('Screenshot specifications'), url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/' },
      { label: t('Creative assets'), url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/' },
      { label: t('In-app events'), url: 'https://developer.apple.com/help/app-store-connect/reference/in-app-events/in-app-event-media-and-audio-specifications/' },
      { label: t('Asset best practices'), url: 'https://developer.apple.com/app-store/asset-best-practices/' },
      { label: t('Review Guidelines 2.3'), url: 'https://developer.apple.com/app-store/review/guidelines/' },
    ],
  },
  {
    id: 'play',
    name: 'Google Play',
    // Google Play's app page: 8 dp between screenshots about 110 dp wide.
    gap: 0.07,
    groups: [
      {
        name: t('Phone'),
        assets: assets('play', [
          {
            key: 'phone',
            kind: 'screenshot',
            label: t('Phone'),
            note: t('9:16 portrait'),
            sizes: [[1080, 1920]],
            // Google's own phone, Play's reference.
            display: screen('phone', t('Phone'), 360, 640, 'android', 32, { devices: ['p10'] }),
            min: 2,
            max: 8,
            required: 'yes',
            requiredNote: t('At least 2 screenshots in all to publish. With 4 or more at 1080 px or larger, in 9:16, the app can be featured.'),
            format: PLAY_IMAGE,
            rules: [t('Sides from 320 to 3840 px, the long one at most twice the short one.')],
          },
        ]),
      },
      {
        name: t('Large screens'),
        assets: assets('play', [
          {
            key: 'tablet7',
            kind: 'screenshot',
            label: t('7″ tablet'),
            note: t('9:16 portrait'),
            sizes: [[1350, 2400]],
            // Samsung leads Android tablets.
            display: screen('tablet7', t('7″ tablet'), 675, 1200, 'android', 18, { bez: 20, devices: ['gtabs9'] }),
            min: 4,
            max: 8,
            required: 'no',
            requiredNote: TABLET_NOTE,
            format: PLAY_IMAGE,
            rules: TABLET_RULES,
          },
          {
            key: 'tablet10',
            kind: 'screenshot',
            label: t('10″ tablet'),
            note: t('9:16 portrait'),
            sizes: [[1800, 3200]],
            display: screen('tablet10', t('10″ tablet'), 900, 1600, 'android', 18, { bez: 20, devices: ['gtabs9'] }),
            min: 4,
            max: 8,
            required: 'no',
            requiredNote: TABLET_NOTE,
            format: PLAY_IMAGE,
            rules: TABLET_RULES,
          },
        ]),
      },
      {
        name: t('Listing graphics'),
        assets: assets('play', [
          {
            key: 'icon',
            kind: 'graphic',
            label: t('App icon'),
            note: t('On the listing and in search'),
            sizes: [[512, 512]],
            min: 1,
            max: 1,
            required: 'yes',
            format: t('32-bit PNG, sRGB, up to 1024 KB'),
            rules: [t('A full square: Play rounds the corners and adds the shadow.'), t('No ranks, prices, deals or Play badges.')],
          },
          {
            key: 'feature',
            kind: 'graphic',
            label: t('Feature graphic'),
            note: t('The video’s cover, collections and ads'),
            sizes: [[1024, 500]],
            min: 1,
            max: 1,
            required: 'yes',
            format: PLAY_IMAGE,
            rules: [t('Key elements in the middle: the edges get cropped.'), t('Little text; avoid plain white, black or dark grey backgrounds; not just the icon again.')],
          },
        ]),
      },
    ],
    tips: [
      t('No device frames: they date quickly. The screen alone, as HeroCanvas makes it.'),
      t('The real app first: its interface in the first three screenshots.'),
      t('Captions in 20% of the image at most; nothing time-limited.'),
      t('A clean status bar; nothing blurry or stretched.'),
      t('No “#1”, awards, “New”, prices or Play programs; nothing misleading, like a fake notification dot.'),
      t('Every device type the app supports, and both orientations if it has them.'),
      t('Alt text under 140 characters for each image.'),
    ],
    sources: [
      { label: t('Preview assets'), url: 'https://support.google.com/googleplay/android-developer/answer/9866151' },
      { label: t('Icon specifications'), url: 'https://developer.android.com/distribute/google-play/resources/icon-design-specifications' },
      { label: t('Listing best practices'), url: 'https://support.google.com/googleplay/android-developer/answer/13393723' },
      { label: t('Metadata policy'), url: 'https://support.google.com/googleplay/android-developer/answer/9898842' },
    ],
  },
];

export const ALL_ASSETS: StoreAsset[] = STORES.flatMap((s) => s.groups.flatMap((g) => g.assets));

/** The asset of an id, or the first one: the iPhone set App Store Connect asks for (6.3″). */
export const assetById = (id: string | null | undefined): StoreAsset => ALL_ASSETS.find((a) => a.id === id) ?? ALL_ASSETS[0];

export const storeOf = (a: StoreAsset): Store => STORES.find((s) => s.id === a.store)!;
