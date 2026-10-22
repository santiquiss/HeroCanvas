// The steps of an agent's shot (shotActions.ts): finding what a step names, typing as React reads it, scrolling.
import { describe, expect, it, vi } from 'vitest';
import { findTarget, fingerprint, runStep } from './shotActions';

function screen(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

describe('findTarget', () => {
  it('prefers the text that can be tapped, and taps its button', () => {
    const root = screen('<h1>Delete account</h1><div><button id="b"><span>Delete account</span></button></div>');
    expect(findTarget(root, 'Delete account')?.id).toBe('b');
  });
  it('falls back to the smallest element containing the text, and takes a selector', () => {
    const root = screen('<section><p id="p">Hello <b>big</b> world</p></section><input class="f">');
    expect(findTarget(root, 'big world')?.id).toBe('p');
    expect(findTarget(root, 'css:input.f')?.tagName).toBe('INPUT');
    expect(findTarget(root, 'nothing')).toBeNull();
  });
});

describe('runStep', () => {
  it('types into the first field with an input event, and taps', () => {
    const root = screen('<input id="a"><button>Ok</button>');
    const onInput = vi.fn();
    const onClick = vi.fn();
    root.querySelector('input')!.addEventListener('input', onInput);
    root.querySelector('button')!.addEventListener('click', onClick);
    runStep(root, { fill: 'Groceries' });
    runStep(root, { click: 'Ok' });
    expect(root.querySelector('input')!.value).toBe('Groceries');
    expect(onInput).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('presses a key in the field', () => {
    const root = screen('<input id="k">');
    const onKey = vi.fn((e: KeyboardEvent) => e.key);
    root.querySelector('input')!.addEventListener('keydown', onKey);
    runStep(root, { press: 'Enter' });
    expect(onKey).toHaveReturnedWith('Enter');
  });
  it('says what it could not find', () => {
    const root = screen('<p>x</p>');
    expect(() => runStep(root, { click: 'Save' })).toThrow('Save');
    expect(() => runStep(root, { fill: 'x' })).toThrow('field');
  });
});

describe('fingerprint', () => {
  it('changes with what the frame shows', () => {
    const root = screen('<p>a</p>');
    const before = fingerprint(root);
    root.innerHTML = '<p>b</p>';
    expect(fingerprint(root)).not.toBe(before);
  });
});
