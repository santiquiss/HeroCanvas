// A sheet opened on one screen of the canvas hangs from the same control on the others, though their layouts differ.
import { describe, expect, it } from 'vitest';
import { boxInScreen, counterpartIn } from './anchor';

const screen = (html: string) => {
  const el = document.createElement('div');
  el.setAttribute('data-device-screen', '');
  el.innerHTML = html;
  document.body.append(el);
  return el;
};

describe('counterpartIn', () => {
  it('finds the control by its name across layouts', () => {
    // A phone: its rows, then its tab bar. A tablet: its rail first, the rows in another wrapper.
    const phone = screen('<main><button title="Breakfast options">⋯</button><button title="Lunch options">⋯</button></main><nav><button>Journal</button></nav>');
    const tablet = screen('<nav><button>Journal</button></nav><div><main><section><button title="Breakfast options">⋯</button><button title="Lunch options">⋯</button></section></main></div>');
    const lunch = phone.querySelector<HTMLElement>('[title="Lunch options"]')!;
    expect(counterpartIn(lunch, tablet)).toBe(tablet.querySelector('[title="Lunch options"]'));
  });

  it('keeps the order among controls of the same name', () => {
    const a = screen('<button>Remove</button><button>Remove</button>');
    const b = screen('<div><button>Remove</button></div><div><button>Remove</button></div>');
    expect(counterpartIn(a.querySelectorAll<HTMLElement>('button')[1], b)).toBe(b.querySelectorAll('button')[1]);
  });

  it('falls back to the same place in the tree, and to none', () => {
    const a = screen('<div><span><i></i></span></div>');
    const b = screen('<div><span><i></i></span></div>');
    expect(counterpartIn(a.querySelector('i')!, b)).toBe(b.querySelector('i'));
    const c = screen('<p></p>');
    expect(counterpartIn(a.querySelector('i')!, c)).toBeNull();
  });
});

describe('boxInScreen', () => {
  it('takes off how far the page has scrolled', () => {
    const root = document.createElement('div');
    root.setAttribute('data-theme', 'light');
    root.innerHTML = '<div class="page"><button>Snack options</button></div>';
    document.body.append(root);
    const page = root.querySelector<HTMLElement>('.page')!;
    const button = root.querySelector('button')!;
    const at = (el: HTMLElement, top: number, parent: Element | null) => {
      Object.defineProperty(el, 'offsetTop', { value: top, configurable: true });
      Object.defineProperty(el, 'offsetLeft', { value: 0, configurable: true });
      Object.defineProperty(el, 'offsetParent', { value: parent, configurable: true });
    };
    at(button, 900, page);
    at(page, 0, root);
    Object.defineProperty(page, 'scrollTop', { value: 600, configurable: true });
    expect(boxInScreen(button)?.y).toBe(300);
  });
});
