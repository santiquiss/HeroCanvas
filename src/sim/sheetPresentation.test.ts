import { describe, expect, it } from 'vitest';
import { sheetPresentation, type SheetRuleInput } from './sheetPresentation';

const large = (s: Partial<SheetRuleInput>): SheetRuleInput => ({ hasAnchor: true, floats: true, ...s });
const phone = (s: Partial<SheetRuleInput>): SheetRuleInput => ({ hasAnchor: true, floats: false, ...s });

describe('a sheet takes the shape of what it holds on large screens', () => {
  it('hangs actions from their control as a drop-down', () => {
    expect(sheetPresentation(large({ kind: 'actions' }))).toBe('dropdown');
  });

  it('points content at its control in a popover', () => {
    expect(sheetPresentation(large({ kind: 'content' }))).toBe('popover');
  });

  it('puts a task in a dialog, even from a control', () => {
    expect(sheetPresentation(large({ kind: 'task' }))).toBe('dialog');
  });

  it('with no control: content in a dialog, actions stay a sheet', () => {
    expect(sheetPresentation(large({ kind: 'content', hasAnchor: false }))).toBe('dialog');
    expect(sheetPresentation(large({ kind: 'actions', hasAnchor: false }))).toBe('sheet');
  });

  it('keeps sheets on phones', () => {
    for (const kind of ['actions', 'content', 'task'] as const) expect(sheetPresentation(phone({ kind }))).toBe('sheet');
  });

  it('keeps a sheet whose opener chose where it sits (Top Content) as it is', () => {
    expect(sheetPresentation(large({ kind: 'content', layout: 'topContent' }))).toBe('sheet');
    expect(sheetPresentation(large({ kind: 'task', layout: 'topContent' }))).toBe('sheet');
    expect(sheetPresentation(large({ kind: 'content', layout: 'bottomContent' }))).toBe('popover');
  });

  it('moves a sheet that rises from the bottom taking the screen (Bottom Expanded): a task is a dialog, on phones a sheet', () => {
    expect(sheetPresentation(large({ kind: 'task', layout: 'bottomExpanded' }))).toBe('dialog');
    expect(sheetPresentation(phone({ kind: 'task', layout: 'bottomExpanded' }))).toBe('sheet');
  });

  it('keeps a sheet that doesn’t say what it holds', () => {
    expect(sheetPresentation(large({}))).toBe('sheet');
  });
});
