// A story file's format: `<Name>.stories.tsx` beside its component exports `stories({...})`. Part of the public API
// (`herocanvas`); the registry that loads every story file is design/stories.ts, apart, so a story importing this
// never loads the registry (which loads the story).
import type { ReactNode } from 'react';

export type Control =
  | { type: 'text' }
  | { type: 'number'; min?: number; max?: number; step?: number }
  | { type: 'boolean' }
  | { type: 'select'; options: string[] }
  | { type: 'color' };

export type Args = Record<string, unknown>;

/** Frame width: px, the device content width, one grid cell of the device, or the component's own width. */
export type FrameWidth = number | 'content' | 'cell' | 'auto';

export interface StoryContext<A extends Args> {
  /** Callback that reports an action in the gallery, e.g. `onPressed={ctx.action('onPressed')}`. */
  action: (name: string) => (...values: unknown[]) => void;
  /** Change this story's args (interactive stories: a switch that switches). */
  update: (patch: Partial<A>) => void;
}

export interface Story<A extends Args> {
  name: string;
  args?: Partial<A>;
  width?: FrameWidth;
  note?: string;
}

export interface StoryModule<A extends Args> {
  /** The code's component name (or a local name). */
  component: string;
  /** Default args, merged under every story's args. */
  args: A;
  /** Controls per arg. Strings, numbers and booleans get one automatically. */
  controls?: Partial<Record<keyof A & string, Control>>;
  render: (args: A, ctx: StoryContext<A>) => ReactNode;
  stories: Story<A>[];
  width?: FrameWidth;
  note?: string;
}

export function stories<A extends Args>(m: StoryModule<A>): StoryModule<A> {
  return m;
}

