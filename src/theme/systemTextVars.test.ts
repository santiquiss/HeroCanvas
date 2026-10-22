// A text style under the system's text size and Bold Text: its shorthand, its parts and the type scale.
import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_SIZE, TEXT_SIZES } from '../sim/systemText';
import { textVarsFor } from './systemTextVars';

const app = {
  styles: [{ name: '--label-m', weight: 500, size: 15, line: 22, family: 'var(--font)', parts: { size: 'label-m-size', line: 'label-m-line-height', weight: 'label-m-weight' } }],
  sizes: [['--font-size-m', 15]] as const,
  weights: [['--font-weight-regular', 400]] as const,
};
const biggest = TEXT_SIZES.ios[TEXT_SIZES.ios.length - 1].id;

describe('the system’s text settings on the app’s styles', () => {
  it('change nothing at the default size without Bold Text', () => {
    expect(textVarsFor(app, 'ios', DEFAULT_TEXT_SIZE, false)).toEqual({});
  });
  it('grow a style, its parts and the type scale with a larger size, the line height with it', () => {
    const v = textVarsFor(app, 'ios', biggest, false);
    const size = parseFloat(v['--label-m-size']);
    expect(size).toBeGreaterThan(15);
    expect(v['--label-m']).toBe(`500 ${size}px/${v['--label-m-line-height']} var(--font)`);
    expect(parseFloat(v['--font-size-m'])).toBe(size);
    expect(Number(v['--text-scale'])).toBeGreaterThan(1);
  });
  it('make a style and the scale’s weights bolder with Bold Text', () => {
    const v = textVarsFor(app, 'ios', DEFAULT_TEXT_SIZE, true);
    expect(Number(v['--label-m-weight'])).toBeGreaterThan(500);
    expect(Number(v['--font-weight-regular'])).toBeGreaterThan(400);
    expect(v['--label-m']).toMatch(/^\d{3} 15px\/22px var\(--font\)$/);
  });
});
