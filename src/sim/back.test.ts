import { describe, expect, it, vi } from 'vitest';
import { createBackDispatcher, registerBackTarget, systemBack } from './back';

describe('the system back', () => {
  it('goes to the handler added last, else the fallback', () => {
    const fallback = vi.fn(() => true);
    const d = createBackDispatcher(fallback);
    const a = vi.fn();
    const b = vi.fn();
    const offA = d.add({ order: 1, onBack: a });
    const offB = d.add({ order: 2, onBack: b });
    expect(d.back()).toBe(true);
    expect(b).toHaveBeenCalledOnce();
    offB();
    d.back();
    expect(a).toHaveBeenCalledOnce();
    offA();
    d.back();
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('answers false when there is nothing to go back to', () => {
    expect(createBackDispatcher().back()).toBe(false);
  });

  it('sends it to the primary screen, else the first', () => {
    const copy = vi.fn(() => true);
    const main = vi.fn(() => true);
    const offCopy = registerBackTarget(copy, false);
    const offMain = registerBackTarget(main, true);
    systemBack();
    expect(main).toHaveBeenCalledOnce();
    expect(copy).not.toHaveBeenCalled();
    offMain();
    systemBack();
    expect(copy).toHaveBeenCalledOnce();
    offCopy();
    expect(systemBack()).toBe(false);
  });
});
