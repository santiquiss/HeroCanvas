// Args from Inspect or a link fitted to a story's selects (storyArgs.ts).
import { describe, expect, it } from 'vitest';
import { fitArgs, fitOption } from './storyArgs';

const mod = { controls: { displayMode: { type: 'select' as const, options: ['', 'base', 'compact'] }, label: { type: 'text' as const } } };

describe('fitArgs', () => {
  it('turns an enum as the code writes it into the select’s option', () => {
    expect(fitArgs(mod, { displayMode: 'ProgressRingMode.compact', label: '25' })).toEqual({ displayMode: 'compact', label: '25' });
  });
  it('keeps a listed option and drops one the select doesn’t list', () => {
    expect(fitArgs(mod, { displayMode: 'base' })).toEqual({ displayMode: 'base' });
    expect(fitArgs(mod, { displayMode: 'ProgressRingMode.huge', label: 'x' })).toEqual({ label: 'x' });
  });
  it('leaves other controls alone', () => {
    expect(fitOption(['a.b'], 'a.b')).toBe('a.b');
    expect(fitArgs({}, { anything: 'Enum.x' })).toEqual({ anything: 'Enum.x' });
  });
});
