// The app's components as its developers have them: each one and its parameters, read from the app's code by a code
// connector (src/app/connectors/components-api.json: React props, SwiftUI or Compose parameters, Flutter
// constructors). The simulator's components take these names and props; where one is still called otherwise,
// src/app/connectors/name-map.json says so. Without a connector, Inspect shows the simulator's props alone.
//
// The API can be large and only Inspect needs it: it loads on first use (`useLibrary`), in its own chunk.
import { useEffect, useState } from 'react';

const names = (Object.values(import.meta.glob('../app/connectors/name-map.json', { eager: true, import: 'default' }))[0] as { map: Record<string, string> } | undefined) ?? { map: {} };
const apiFile = Object.values(import.meta.glob('../app/connectors/components-api.json', { import: 'default' }))[0] as (() => Promise<unknown>) | undefined;

export interface ApiParam {
  name: string;
  type: string | null;
  required: boolean;
  default: string | null;
  /** Passed by position, before the named ones (`Icon(Icons.sort, …)`). */
  positional?: boolean;
  /** `@Deprecated` in the code: still there, not to use in new code. */
  deprecated?: boolean;
}

export interface ApiWidget {
  name: string;
  tier: string;
  /** In a `parts` folder: a private piece of a larger widget. */
  part: boolean;
  file: string;
  summary: string | null;
  constructors: string[];
  params: ApiParam[];
}

export interface Library {
  /** The code version the API was read from ("e0c7f947 2026-10-08"). */
  version: string | null;
  /** The code's component for a simulator component: same name, the name map, or the same name in other casing. */
  widget: (name: string) => ApiWidget | undefined;
}

const NAMES = names.map as Record<string, string>;

let loaded: Library | null = null;
let loading: Promise<Library> | null = null;

function load(): Promise<Library> {
  loading ??= (apiFile ? apiFile() : Promise.resolve({ commit: null, widgets: [] })).then((file) => {
    const api = file as { commit: string | null; widgets: ApiWidget[] };
    // A name the code has twice (a legacy component and its new one): the new one.
    const widgets = new Map((api.widgets as ApiWidget[]).filter((w) => w.tier !== 'legacy').map((w) => [w.name, w]));
    const lower = new Map([...widgets.values()].map((w) => [w.name.toLowerCase(), w]));
    loaded = {
      version: api.commit as string | null,
      widget: (name) => widgets.get(name) ?? widgets.get(NAMES[name] ?? '') ?? lower.get(name.toLowerCase()),
    };
    return loaded;
  });
  return loading;
}

/** The library, loaded (for what isn't a component: the proposal's handoff file, a test). */
export const loadLibrary = (): Promise<Library> => load();

/** The library, or null while it loads (the first time). */
export function useLibrary(): Library | null {
  const [lib, setLib] = useState(loaded);
  useEffect(() => {
    if (!lib) void load().then(setLib);
  }, [lib]);
  return lib;
}
