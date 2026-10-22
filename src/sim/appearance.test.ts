// The app's appearance setting (appConfig.appearance) over the designer's switch, the system's.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@app/config', () => ({ appConfig: { name: 'App', home: 'home', appearance: { system: 'Auto', light: 'Light', dark: 'Dark' } } }));

const { appearanceIn, schemeIn } = await import('./appThemes');
const params = (q: string) => (k: string) => new URLSearchParams(q).get(k);

describe('appearance', () => {
  it('follows the system by default', () => {
    expect(appearanceIn(params(''))).toBe('system');
    expect(schemeIn(params('theme=dark'))).toBe('dark');
    expect(schemeIn(params(''))).toBe('light');
  });
  it('the app’s light or dark overrides the system’s', () => {
    expect(schemeIn(params('appearance=dark'))).toBe('dark');
    expect(schemeIn(params('appearance=light&theme=dark'))).toBe('light');
  });
  it('ignores what it doesn’t know', () => {
    expect(appearanceIn(params('appearance=sepia'))).toBe('system');
  });
});
