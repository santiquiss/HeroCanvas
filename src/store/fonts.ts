// Google Fonts for a store screenshot's texts (TextLayer `font: 'google'`): each family's stylesheet added to the page
// once, the first time a text in it is drawn, with every weight and its italics.
import { useEffect } from 'react';

const loaded = new Set<string>();

/**
 * A family's stylesheet URL: its weights 400 to 800, upright and italic; or the axes it names itself after a colon,
 * as Google Fonts writes them (`Fraunces:opsz,wght@9..144,400..700`, a serif drawn for its size).
 */
export function googleFontUrl(family: string): string {
  const [name, axes] = family.trim().split(/:(.*)/s);
  const spec = axes || 'ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800';
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.trim()).replace(/%20/g, '+')}:${spec}&display=swap`;
}

/** The family's name alone, as CSS names it (`Fraunces`), without the axes it's loaded with. */
export const familyName = (family: string) => family.split(':')[0].trim();

export function loadGoogleFont(family: string | undefined) {
  const name = family?.trim();
  if (!name || !familyName(name) || loaded.has(name) || typeof document === 'undefined') return;
  loaded.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = googleFontUrl(name);
  document.head.appendChild(link);
}

export function useGoogleFont(family: string | undefined) {
  useEffect(() => loadGoogleFont(family), [family]);
}

/** A family's name as CSS writes it, with a fallback while it loads. */
export const googleFontStack = (family: string) => `"${familyName(family).replace(/"/g, '')}", system-ui, sans-serif`;
