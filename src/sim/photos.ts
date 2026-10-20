// The phone's own photos, for the system's photo picker and camera (sim/SystemPhotoPicker, sim/SystemCamera): what the
// library holds and what each camera sees. Soft gradients drawn here, so the tool ships no pictures of its own; an app
// can put real ones in public/ and list them instead.
const gradient = (a: string, b: string, angle: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/></svg>`,
  )}`;

const PAIRS: [string, string][] = [
  ['#ff9a8b', '#ff6a88'],
  ['#a1c4fd', '#c2e9fb'],
  ['#fbc2eb', '#a6c1ee'],
  ['#84fab0', '#8fd3f4'],
  ['#fccb90', '#d57eeb'],
  ['#e0c3fc', '#8ec5fc'],
  ['#f6d365', '#fda085'],
  ['#96fbc4', '#f9f586'],
  ['#cfd9df', '#e2ebf0'],
  ['#a18cd1', '#fbc2eb'],
  ['#ffecd2', '#fcb69f'],
  ['#89f7fe', '#66a6ff'],
];

/** The photo library, newest first. */
export const LIBRARY_PHOTOS: string[] = PAIRS.map(([a, b], i) => gradient(a, b, (i * 37) % 180));

/** What each camera sees. */
export const CAMERA_FEEDS = { front: gradient('#d4a373', '#faedcd', 90), back: gradient('#5b8def', '#a7c5ff', 160) } as const;
export type CameraSide = keyof typeof CAMERA_FEEDS;
