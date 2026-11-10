// A screen drawn by someone else's SDK (a RevenueCat paywall, a Stripe sheet, a system share sheet the app only
// opens): the screen declares it with <ScreenSource>, and its device's header on the canvas shows a small button with
// its logo, beside the device's name, so whoever looks knows that screen isn't the team's own code to change.
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

export interface ScreenSourceInfo {
  /** What draws it, in a few words: "RevenueCat paywall". */
  label: string;
  /** Its logo (a public file's URL); else a generic icon. */
  logo?: string;
  /** More, in the button's tooltip: where it's configured, what it means for the team. */
  note?: string;
  /** Where it's edited (the SDK's dashboard): the button opens it in a new tab. */
  href?: string;
}

type Register = (id: number, info: ScreenSourceInfo | null) => void;
const RegisterCtx = createContext<Register | null>(null);
const InfoCtx = createContext<ScreenSourceInfo | null>(null);
let ids = 0;

/** Declares that the screen showing it is drawn by `label`'s SDK. Renders nothing on the screen itself. */
export function ScreenSource({ label, logo, note, href }: ScreenSourceInfo) {
  const register = useContext(RegisterCtx);
  const [id] = useState(() => ++ids);
  useLayoutEffect(() => {
    register?.(id, { label, logo, note, href });
    return () => register?.(id, null);
  }, [register, id, label, logo, note, href]);
  return null;
}

/**
 * One device on the canvas (its header and its frame): what the screen inside declared, the latest while a leaving
 * screen still shows.
 */
export function ScreenSourceScope({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<[number, ScreenSourceInfo][]>([]);
  const register = useMemo<Register>(
    () => (id, info) =>
      setEntries((prev) => {
        const rest = prev.filter(([k]) => k !== id);
        return info ? [...rest, [id, info]] : rest.length === prev.length ? prev : rest;
      }),
    [],
  );
  const info = entries.at(-1)?.[1] ?? null;
  return (
    <RegisterCtx.Provider value={register}>
      <InfoCtx.Provider value={info}>{children}</InfoCtx.Provider>
    </RegisterCtx.Provider>
  );
}

/** What draws the device's screen, when it isn't the app (the device's header shows it). */
export const useScreenSourceInfo = () => useContext(InfoCtx);
