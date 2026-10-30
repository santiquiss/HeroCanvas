// Types of chrome.mjs, for the dev server's TypeScript (scripts/vite/screenCache.ts).
export interface Cdp {
  send(method: string, params?: object, session?: string): Promise<any>;
  once(method: string, session?: string): Promise<any>;
  close(): void;
}
export interface ShotPage {
  eval(expr: string): Promise<any>;
  goto(url: string): Promise<void>;
  waitFor(expr: string, timeout?: number, what?: string): Promise<void>;
  viewport(width: number, height: number, scale: number): Promise<unknown>;
  transparent(): Promise<unknown>;
  reducedMotion(): Promise<unknown>;
  png(clip: { x: number; y: number; width: number; height: number }, opts?: { inView?: boolean }): Promise<Buffer>;
}
export function findChrome(): string;
export function launch(): Promise<{ cdp: Cdp; close(): Promise<void> }>;
export function newPage(cdp: Cdp): Promise<ShotPage>;
