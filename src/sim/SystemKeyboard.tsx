// The device's system keyboard, drawn per OS: iOS (QuickType bar, globe and mic below), Android (Gboard: toolbar,
// number hints, hide chevron in the nav bar) and iPadOS (bigger keys, return and hide keys). It types into the
// focused field like a real one (letters, numbers and symbols layers, shift / caps lock, delete, space, return), and
// never takes focus itself. A physical keyboard keeps working too.
import { useEffect, useReducer, useRef, useState, type SyntheticEvent } from 'react';
import { hasSymbol, Icon } from '../components/Icon';
import type { DeviceOS } from '../devices/devices';
import styles from './SystemKeyboard.module.css';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Layer = 'letters' | 'numbers' | 'symbols';

/**
 * Rows per OS and layer. Specials are tokens: ⇧ shift, ⌫ delete, ⏎ return, ␣ space, ☺ emoji, 🌐 globe, 🎤 mic,
 * ⌨ hide, →123 / →ABC / →#+= switch layers, ·N indents a row by N key widths.
 */
const ROWS: Record<DeviceOS, Record<Layer, string[][]>> = {
  ios: {
    letters: [[...'qwertyuiop'], ['·0.5', ...'asdfghjkl', '·0.5'], ['⇧', '·0.15', ...'zxcvbnm', '·0.15', '⌫'], ['→123', '☺', '␣', '⏎']],
    numbers: [[...'1234567890'], [...'-/:;()$&@"'], ['→#+=', '·0.15', ...".,?!'", '·0.15', '⌫'], ['→ABC', '☺', '␣', '⏎']],
    symbols: [[...'[]{}#%^*+='], [...'_\\|~<>€£¥•'], ['→123', '·0.15', ...".,?!'", '·0.15', '⌫'], ['→ABC', '☺', '␣', '⏎']],
  },
  android: {
    letters: [[...'qwertyuiop'], ['·0.5', ...'asdfghjkl', '·0.5'], ['⇧', ...'zxcvbnm', '⌫'], ['→123', ',', '☺', '␣', '.', '⏎']],
    numbers: [[...'1234567890'], [...'@#$_&-+()/'], ['→#+=', ...'*"\':;!?', '⌫'], ['→ABC', ',', '☺', '␣', '.', '⏎']],
    symbols: [[...'~`|•√π÷×¶∆'], [...'£¢€¥^°={}\\'], ['→123', ...'%©®™✓[]', '⌫'], ['→ABC', ',', '☺', '␣', '.', '⏎']],
  },
  // iPadOS 26 (measured on an iPad screenshot): delete and return on the right, ", ." with "! ?" above, emoji and
  // dictation beside space, a wider .?123 and the hide key on the right. ʳ marks the right-hand copy of a key.
  ipad: {
    letters: [[...'qwertyuiop', '⌫'], ['·0.29', ...'asdfghjkl', '⏎'], ['⇧', ...'zxcvbnm', ',', '.', '⇧ʳ'], ['→123', '☺', '🎤', '␣', '→123ʳ', '⌨']],
    numbers: [[...'1234567890', '⌫'], ['·0.29', ...'@#$&*()\'"', '⏎'], ['→#+=', ...'%-+=/;:', ',', '.', '→#+=ʳ'], ['→ABC', '☺', '🎤', '␣', '→ABCʳ', '⌨']],
    symbols: [[...'€£¥_^[]{}#', '⌫'], ['·0.29', ...'§|~…\\<>!?', '⏎'], ['→123', ...'•°©®™✓¶', ',', '.', '→123ʳ'], ['→ABC', '☺', '🎤', '␣', '→ABCʳ', '⌨']],
  },
};

/** Widths in key units; letters are 1. */
const WIDTH: Record<DeviceOS, Record<string, number>> = {
  // iOS 26 at 393pt: letters 32, shift / delete 44, 123 and emoji 42, return 90, space the rest (187).
  ios: { '⇧': 1.375, '⌫': 1.375, '→#+=': 1.375, '→123': 1.31, '→ABC': 1.31, '☺': 1.31, '⏎': 2.81, '␣': 5.84 },
  android: { '⇧': 1.5, '⌫': 1.5, '→#+=': 1.5, '→123': 1.5, '→ABC': 1.5, '☺': 1, '⏎': 1.5, '␣': 4 },
  // iPadOS 26: delete 1.23, return 1.94, right shift 1.23, space 5.5, the right .?123 and hide ≈ 1.7.
  ipad: {
    '⌫': 1.23,
    '⏎': 1.94,
    '⇧': 1,
    '⇧ʳ': 1.23,
    '→#+=': 1,
    '→#+=ʳ': 1.23,
    '→123': 1.08,
    '→ABC': 1.08,
    '→123ʳ': 1.72,
    '→ABCʳ': 1.72,
    '☺': 1.07,
    '🎤': 1.08,
    '⌨': 1.7,
    '␣': 5.5,
  },
};

/** Each glyph as Apple draws it (an SF Symbol) and as Material does (Gboard's, and iOS's when the team has no SF Symbols). */
const GLYPH: Record<string, { sf: string; material: string }> = {
  '⌫': { sf: 'delete.left', material: 'backspace' },
  '☺': { sf: 'face.smiling', material: 'mood' },
  '🌐': { sf: 'globe', material: 'language' },
  '🎤': { sf: 'mic', material: 'mic' },
  '⌨': { sf: 'keyboard.chevron.compact.down', material: 'keyboard_hide' },
  shift: { sf: 'shift', material: 'shift' },
  shiftOnce: { sf: 'shift.fill', material: 'shift' },
  capsLock: { sf: 'capslock.fill', material: 'shift_lock' },
  return: { sf: 'return', material: 'keyboard_return' },
  search: { sf: 'magnifyingglass', material: 'search' },
  done: { sf: 'checkmark', material: 'check' },
  go: { sf: 'arrow.right', material: 'arrow_forward' },
  send: { sf: 'arrow.up', material: 'arrow_upward' },
  undo: { sf: 'arrow.uturn.backward', material: 'undo' },
  redo: { sf: 'arrow.uturn.forward', material: 'redo' },
  paste: { sf: 'clipboard', material: 'content_paste' },
};

/**
 * A key's glyph: on iOS and iPadOS the SF Symbol, at the letters' weight, when the team made HeroCanvas's own
 * (`npm run symbols`); else Material's, lighter than its default so it doesn't stand out bolder than the letters
 * beside it. Android: Material's, as Gboard draws.
 */
function KeyGlyph({ os, g, size, fill }: { os: DeviceOS; g: keyof typeof GLYPH; size: number; fill?: boolean }) {
  const { sf, material } = GLYPH[g];
  if (os !== 'android' && hasSymbol(sf)) return <Icon name={`sf:${sf}`} size={size} />;
  return <Icon name={material} size={size} fill={fill} weight={os === 'android' ? undefined : 300} />;
}

/** Number hints on Android's top letter row. */
const HINTS = '1234567890';

/** iPadOS: the character above each letter (a flick types it); "! ?" sit above ", .". */
const IPAD_HINTS: Record<string, string> = Object.fromEntries(
  [...'qwertyuiop'].map((c, i) => [c, '1234567890'[i]]).concat([...'asdfghjkl'].map((c, i) => [c, '@#$&*()\'"'[i]]), [...'zxcvbnm'].map((c, i) => [c, '%-+=/;:'[i]]), [[',', '!'], ['.', '?']]),
);

/** A key's own token, without the right-hand marker. */
const base = (k: string) => (k.endsWith('ʳ') ? k.slice(0, -1) : k);

const SUGGESTIONS = ['I', 'The', 'I’m'];

/**
 * Number pads, by the field's inputMode (a number / decimal keyboard type): iOS's 3 × 4 pad with the letters
 * under each digit (the decimal point only for decimals), Gboard's 4 × 4 with its specials. iPadOS shows its full
 * keyboard on the numbers layer instead.
 */
const IOS_PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const IOS_PAD_LETTERS: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' };
const ANDROID_PAD = ['1', '2', '3', '-', '4', '5', '6', '␣', '7', '8', '9', '⌫', ',', '0', '.', '⏎'];

/** Email fields: @ and . beside a shorter space (letters layer's last row). */
const EMAIL_ROW: Record<DeviceOS, string[]> = {
  ios: ['→123', '☺', '␣', '@', '.', '⏎'],
  android: ['→123', '@', '☺', '␣', '.', '⏎'],
  ipad: ['→123', '☺', '@', '␣', '.', '→123ʳ', '⌨'],
};

/**
 * A field's Continue action (the text field's continue input action, UIReturnKeyType .continue): the return key
 * reads Continue, at the keyboard's bottom right, so the step's button lives in the keyboard while it's up.
 *   iOS: the return key, a blue pill, as in Apple's iOS 26 keyboard with a typed return key (123 · space · . ·
 *   Continue; emoji and dictation below). The iOS number pad has no return key (Apple only allows a bar above it), so a
 *   number field with an action opens the numbers-and-punctuation keyboard instead (a signed
 *   number keyboard type): the digits on top and Continue at the bottom right.
 *   Android: Gboard's action key (bottom right on letters and on the number pad), wider for the label.
 *   iPadOS: its return key, where Apple keeps it (the right end of the middle row).
 */
const ACTION_LABEL = 'Continue';
const ACTION_W: Record<DeviceOS, Record<string, number>> = {
  // Measured on the iOS 26 keyboard with a Continue key, in letter-key widths.
  ios: { '→123': 1.83, '→ABC': 1.83, '␣': 4.88, '.': 1.48, '@': 1.48, '⏎': 3.48 },
  android: { '⏎': 2.6, '␣': 2.9 },
  ipad: { '⏎': 1.94 },
};
/** iOS with a typed return key: the bottom row (emoji moves below, beside dictation). */
const IOS_ACTION_ROW: Record<Layer | 'email', string[]> = {
  letters: ['→123', '␣', '.', '⏎'],
  numbers: ['→ABC', '␣', '.', '⏎'],
  symbols: ['→ABC', '␣', '.', '⏎'],
  email: ['→123', '␣', '@', '.', '⏎'],
};

/** The keyboard designs a display can have of its own (devices.ts `keyboard`). */
export type KeyboardDesign = 'duo-outer' | 'duo-inner';

/**
 * The iPhone Duo's keyboard (iOS and iPadOS 27 Figma, iPhone Duo › Keyboard): an iPhone keyboard, at each display's
 * size, on both of them (the inner one's iPadOS too): the QuickType bar, no number pad (a number field opens the
 * numbers layer), and emoji and dictation in the bottom row (the outer display upright), below the keys (the inner one
 * upright) or in columns of their own beside them (either one turned). Measured on the Figma frames, in points.
 */
interface DuoGeometry {
  keyH: number;
  gap: number;
  rowGap: number;
  /** The keys' inset from the keyboard's sides. */
  padX: number;
  /** Where the keys start (under the QuickType bar) and the room under them. */
  top: number;
  bottom: number;
  /** The middle letter row's inset at each end. */
  row2: number;
  /** Shift and delete (and #+=, 123 on that row): their width and the room before the letters. */
  side: number;
  sideGap: number;
  /** 123 / ABC and return on the bottom row. */
  switchW: number;
  /** The bottom row's own inset (the inner display turned). */
  row4?: number;
  /** Emoji and dictation: in the bottom row (42 square), below the keys, or in a column each beside them. */
  extras: { at: 'row'; w: number } | { at: 'below'; top: number; x: number; h: number; bottom: number } | { at: 'sides'; x: number; w: number };
  radius: number;
  char: number;
  special: number;
  corner: number;
}
const DUO: Record<`${KeyboardDesign}-${'port' | 'land'}`, DuoGeometry> = {
  'duo-outer-port': { keyH: 42, gap: 6, rowGap: 10.67, padX: 17.67, top: 47, bottom: 39, row2: 21.33, side: 50.67, sideGap: 14.67, switchW: 81, extras: { at: 'row', w: 42 }, radius: 10, char: 26, special: 20, corner: 27 },
  'duo-outer-land': { keyH: 33.33, gap: 6.67, rowGap: 9, padX: 82, top: 49, bottom: 20, row2: 26, side: 60.33, sideGap: 17.67, switchW: 98, extras: { at: 'sides', x: 10, w: 68 }, radius: 8, char: 21, special: 17, corner: 27 },
  'duo-inner-port': { keyH: 49.67, gap: 9, rowGap: 14, padX: 17.67, top: 47, bottom: 0, row2: 33, side: 74.33, sideGap: 22, switchW: 151.67, extras: { at: 'below', top: 17, x: 63, h: 42, bottom: 16 }, radius: 12, char: 31, special: 24, corner: 32 },
  'duo-inner-land': { keyH: 42.33, gap: 10, rowGap: 13, padX: 85, top: 47, bottom: 20, row2: 39.67, side: 92.67, sideGap: 26, switchW: 148.33, row4: 23.67, extras: { at: 'sides', x: 12, w: 68 }, radius: 10, char: 27, special: 20, corner: 32 },
};
/** Its rows: iOS 27's, the bottom row by where emoji and dictation go. */
function duoRows(layer: Layer, email: boolean, inRow: boolean): string[][] {
  const sw = layer === 'letters' ? '→123' : '→ABC';
  const bottom = [sw, '␣', ...(email ? ['@', '.'] : []), '⏎'];
  const last = inRow ? ['☺', ...bottom, '🎤'] : bottom;
  if (layer === 'letters') return [[...'qwertyuiop'], [...'asdfghjkl'], ['⇧', ...'zxcvbnm', '⌫'], last];
  if (layer === 'numbers') return [[...'1234567890'], [...'-/:;()$&@"'], ['→#+=', ...".,?!'", '⌫'], last];
  return [[...'[]{}#%^*+='], [...'_\\|~<>€£¥•'], ['→123', ...".,?!'", '⌫'], last];
}

interface Props {
  os: DeviceOS;
  /** The display's own keyboard (the iPhone Duo's), instead of its OS's. */
  design?: KeyboardDesign;
  land: boolean;
  open: boolean;
  /** The focused field, or the last one while the keyboard slides away. */
  field: Field | null;
  /** Home indicator / nav bar inset below the keys. */
  bottomInset: number;
  /** Screen size: iPadOS sizes its keys from it. */
  width: number;
  height: number;
  onHeight: (h: number) => void;
}

export function SystemKeyboard({ os: deviceOS, design, land, open, field, bottomInset, width, height, onHeight }: Props) {
  // The Duo's keyboard is an iPhone's (its keys, glyphs and colors), at its own geometry.
  const duo = design ? DUO[`${design}-${land ? 'land' : 'port'}`] : null;
  const os: DeviceOS = duo ? 'ios' : deviceOS;
  const [layer, setLayer] = useState<Layer>('letters');
  const [shift, setShift] = useState<'off' | 'once' | 'lock'>('off');
  const lastShift = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  // Report the height (it changes with the OS, orientation and layer only through the layout).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);
  // The field's action can turn on and off while typing (a valid name, an age in range): follow its attribute.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!field) return;
    const mo = new MutationObserver(refresh);
    mo.observe(field, { attributes: true, attributeFilter: ['data-action-disabled', 'data-action'] });
    return () => mo.disconnect();
  }, [field]);
  const action = field?.dataset.action === 'continueAction';
  const actionOff = action && field?.dataset.actionDisabled === 'true';
  const mode = field?.inputMode;
  const numeric = mode === 'numeric' || mode === 'decimal';
  // A number pad on phones; iPadOS keeps its keyboard, on numbers. iOS with an action: numbers and punctuation.
  const pad = numeric && !duo && os !== 'ipad' && !(os === 'ios' && action);
  // Each time it opens: letters, lower case (numbers for a number field on iPadOS).
  useEffect(() => {
    if (open) {
      setLayer(numeric ? 'numbers' : 'letters');
      setShift('off');
    }
  }, [open, field, numeric]);

  const hint = field?.enterKeyHint || (field instanceof HTMLTextAreaElement ? 'enter' : '');
  const blueReturn = hint === 'search' || hint === 'done' || hint === 'go' || hint === 'send';

  const insert = (text: string) => {
    if (!field) return;
    field.focus({ preventScroll: true });
    // execCommand keeps the field's undo stack and fires the input event React listens to.
    if (!document.execCommand('insertText', false, text)) field.value += text;
  };
  const press = (k: string) => {
    if (!field) return;
    const key = base(k);
    if (key === '⌫') {
      field.focus({ preventScroll: true });
      document.execCommand('delete');
    } else if (key === '⇧') {
      const now = performance.now();
      setShift(shift === 'off' ? (now - lastShift.current < 300 ? 'lock' : 'once') : shift === 'once' && now - lastShift.current < 300 ? 'lock' : 'off');
      lastShift.current = now;
    } else if (key.startsWith('→')) {
      setLayer(key === '→ABC' ? 'letters' : key === '→#+=' ? 'symbols' : 'numbers');
    } else if (key === '␣') {
      insert(' ');
    } else if (key === '⏎' && action) {
      // The step moves on (and its next field, if any, takes the focus): the keyboard stays up meanwhile.
      if (!actionOff) field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else if (key === '⏎') {
      if (field instanceof HTMLTextAreaElement && !blueReturn) insert('\n');
      else {
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        // Sending (a chat) keeps typing; search / done / go put the keyboard away.
        if (hint !== 'send') field.blur();
      }
    } else if (key === '⌨') {
      field.blur();
    } else if (key.length && !['☺', '🌐', '🎤'].includes(key)) {
      insert(shift !== 'off' && layer === 'letters' ? key.toUpperCase() : key);
      if (shift === 'once') setShift('off');
    }
  };
  // Keys never take focus: the field keeps it (and its caret) while typing.
  const keep = (e: SyntheticEvent) => e.preventDefault();

  const email = mode === 'email' && layer === 'letters';
  const rows = duo
    ? duoRows(layer, email, duo.extras.at === 'row')
    : os === 'ios' && action
      ? [...ROWS.ios[layer].slice(0, -1), IOS_ACTION_ROW[email ? 'email' : layer]]
      : email
        ? [...ROWS[os].letters.slice(0, -1), EMAIL_ROW[os]]
        : ROWS[os][layer];
  const upper = shift !== 'off' && layer === 'letters';
  const label = (key: string) => {
    const k = base(key);
    // iOS 26 glyphs are bigger than the others' (shift, delete and emoji ≈ 26pt).
    const glyph = duo ? Math.round(duo.char * 0.8) : os === 'android' ? 22 : os === 'ipad' ? 24 : 26;
    if (k === '⇧') return <KeyGlyph os={os} g={shift === 'lock' ? 'capsLock' : shift === 'once' ? 'shiftOnce' : 'shift'} fill={shift !== 'off'} size={glyph} />;
    if (k === '⏎' && action) return ACTION_LABEL;
    if (k === '⏎') {
      // A glyph on every OS (iOS and iPadOS 26, Android).
      const g = hint === 'search' || hint === 'done' || hint === 'go' || hint === 'send' ? hint : 'return';
      return <KeyGlyph os={os} g={g} size={duo ? Math.round(duo.char * 0.85) : os === 'android' ? 22 : 28} />;
    }
    if (GLYPH[k]) return <KeyGlyph os={os} g={k} size={glyph} />;
    if (k === '␣') return '';
    if (k.startsWith('→')) {
      const to = k.slice(1);
      if (os === 'android') return to === '123' ? '?123' : to === '#+=' ? '=\\<' : 'ABC';
      if (os === 'ipad') return to === '123' ? '.?123' : to;
      return to;
    }
    return upper ? k.toUpperCase() : k;
  };
  const kind = (key: string) => {
    const k = base(key);
    return k.length === 1 && !'⇧⌫⏎␣☺🌐🎤⌨'.includes(k) ? 'char' : k === '␣' ? 'space' : k === '⏎' ? 'return' : 'special';
  };
  // iPadOS sizes everything from the screen (key 6.9% of the width, gap 1.35%, row gap 1.05%, radius 1.05%), capped
  // by its height on screens wider than the 4:3 reference (key 9.25% of the height), so it never takes over the page.
  const s = Math.min(width, height * 1.34);
  const ipadVars =
    os === 'ipad'
      ? ({
          '--kb-key-h': `${Math.round(s * 0.069)}px`,
          '--kb-gap': `${s * 0.0135}px`,
          '--kb-row-gap': `${s * 0.0105}px`,
          '--kb-pad-x': `${width * 0.006}px`,
          '--kb-radius': `${s * 0.0105}px`,
          '--kb-bar-h': `${Math.round(s * 0.06)}px`,
        } as React.CSSProperties)
      : undefined;
  const duoVars = duo
    ? ({
        '--kb-key-h': `${duo.keyH}px`,
        '--kb-gap': `${duo.gap}px`,
        '--kb-row-gap': `${duo.rowGap}px`,
        '--kb-pad-top': '0px',
        '--kb-pad-x': `${duo.padX}px`,
        '--kb-pad-bottom': `${duo.extras.at === 'below' ? 0 : Math.max(duo.bottom, bottomInset)}px`,
        '--kb-radius': `${duo.radius}px`,
        '--kb-char-size': `${duo.char}px`,
        '--kb-special-size': `${duo.special}px`,
        '--kb-bar-h': `${duo.top}px`,
        borderRadius: `${duo.corner}px ${duo.corner}px 0 0`,
      } as React.CSSProperties)
    : undefined;
  /** A Duo key's own width (the fixed ones beside the letters and on the bottom row); a letter's flex otherwise. */
  const duoKey = (k: string, r: number, i: number, n: number): React.CSSProperties | undefined => {
    if (!duo) return undefined;
    const kb = base(k);
    const last = r === rows.length - 1;
    if (kb === '☺' || kb === '🎤') return { flex: `0 0 ${duo.extras.at === 'row' ? duo.extras.w : 0}px` };
    // With a typed return key (Continue) it widens for its label, as iOS's does, the space giving the room.
    if (last && kb === '⏎') return { flex: `0 0 ${action ? Math.round(duo.switchW * 1.3) : duo.switchW}px` };
    if (last && kb.startsWith('→')) return { flex: `0 0 ${duo.switchW}px` };
    // Shift and delete (#+= and 123 on the other layers), a wider gap between them and the letters.
    if (r === 2 && (i === 0 || i === n - 1)) return { flex: `0 0 ${duo.side}px`, [i === 0 ? 'marginRight' : 'marginLeft']: duo.sideGap - duo.gap };
    return undefined;
  };
  const sides = duo?.extras.at === 'sides' ? duo.extras : null;
  const duoRowPad = (r: number): React.CSSProperties | undefined => {
    if (!duo) return undefined;
    if (r === 1 && layer === 'letters') return { padding: `0 ${duo.row2}px` };
    if (r === rows.length - 1 && duo.row4) return { padding: `0 ${duo.row4}px` };
    return undefined;
  };

  return (
    <div
      ref={ref}
      className={`${styles.kb} ${styles[os]} ${land ? styles.land : ''} ${duo ? styles.duo : ''} ${pad ? styles.padPanel : ''} ${open ? styles.open : ''}`}
      style={{ paddingBottom: os === 'ios' ? 0 : bottomInset, ...ipadVars, ...duoVars }}
      onPointerDown={keep}
      onMouseDown={keep}
      aria-hidden={!open}
    >
      {pad ? null : os === 'ios' && !duo ? null : os === 'android' ? (
        <div className={styles.toolbar}>
          {['apps', 'sentiment_satisfied', 'content_paste', 'settings', 'palette', 'mic'].map((ic) => (
            <span key={ic} className={styles.tool}>
              <Icon name={ic} size={22} />
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.suggest}>
          {os === 'ipad' && (
            <span className={styles.shortcuts}>
              <KeyGlyph os={os} g="undo" size={24} />
              <KeyGlyph os={os} g="redo" size={24} />
              <KeyGlyph os={os} g="paste" size={24} />
            </span>
          )}
          {SUGGESTIONS.map((s, i) => (
            <span key={s} className={styles.suggestion} style={i === 1 ? { color: 'var(--kb-tx)' } : undefined}>
              {s}
            </span>
          ))}
          {os === 'ipad' && <span className={styles.shortcuts} />}
        </div>
      )}

      {pad ? (
        <div className={`${styles.pad} ${os === 'android' ? styles.padAndroid : ''}`}>
          {(os === 'android' ? ANDROID_PAD : IOS_PAD).map((k, i) => {
            // iOS: the point only on a decimal pad; otherwise an empty slot.
            if (os !== 'android' && k === '.' && mode !== 'decimal') return <span key={i} />;
            const kd = kind(k);
            const digit = /\d/.test(k);
            const cls = [styles.key, styles.padKey, digit ? styles.char : os === 'android' ? styles.special : styles.padBare];
            if (kd === 'return') cls.push(styles.blue);
            if (kd === 'return' && action) cls.push(styles.action, actionOff ? styles.actionOff : '');
            return (
              <button key={i} tabIndex={-1} className={cls.join(' ')} onClick={() => press(k)}>
                {kd === 'char' ? k : label(k)}
                {os !== 'android' && IOS_PAD_LETTERS[k] && <small>{IOS_PAD_LETTERS[k]}</small>}
              </button>
            );
          })}
        </div>
      ) : (
      <div className={styles.rows}>
        {rows.map((row, r) => (
          <div key={`${layer}${r}`} className={styles.row} style={duoRowPad(r)}>
            {row.map((k, i) => {
              if (k.startsWith('·')) return <span key={i} style={{ flex: `${Number(k.slice(1))} 1 0` }} />;
              const w = (action && r === rows.length - 1 && ACTION_W[os][k]) || (k.length === 1 && kind(k) === 'char' ? 1 : (WIDTH[os][k] ?? 1));
              const kd = kind(k);
              const cls = [styles.key, kd === 'char' ? styles.char : kd === 'space' ? styles.space : kd === 'return' ? styles.ret : styles.special];
              if (kd === 'return' && (blueReturn || action)) cls.push(styles.blue);
              if (kd === 'return' && action) cls.push(styles.action, actionOff ? styles.actionOff : '');
              if (base(k) === '⇧' && shift !== 'off') cls.push(styles.on);
              // The Duo's emoji and dictation in the bottom row: bare glyphs, no key.
              if (duo && (base(k) === '☺' || base(k) === '🎤')) cls.push(styles.bare);
              return (
                <button
                  key={i}
                  tabIndex={-1}
                  className={cls.join(' ')}
                  style={duoKey(k, r, i, row.length) ?? { flex: `${w} 1 0` }}
                  data-pop={kd === 'char' && os !== 'ipad' ? (upper ? k.toUpperCase() : k) : undefined}
                  onClick={() => press(k)}
                >
                  {os === 'android' && layer === 'letters' && r === 0 && <span className={styles.hint}>{HINTS[i]}</span>}
                  {os === 'ipad' && layer === 'letters' && IPAD_HINTS[k] && <span className={styles.ipadHint}>{IPAD_HINTS[k]}</span>}
                  {label(k)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      )}

      {/* iOS 26's pad: ~40 under its last row before the home indicator's band. */}
      {os === 'ios' && pad && <div style={{ height: land ? Math.max(bottomInset, 16) : Math.max(bottomInset + 40, 56) }} />}
      {duo && duo.extras.at === 'below' && (
        <div className={styles.below} style={{ height: 'auto', padding: `${duo.extras.top}px ${duo.extras.x}px ${Math.max(duo.extras.bottom, bottomInset)}px` }}>
          <span style={{ height: duo.extras.h, display: 'flex', alignItems: 'center' }}><KeyGlyph os={os} g="☺" size={30} /></span>
          <span style={{ height: duo.extras.h, display: 'flex', alignItems: 'center' }}><KeyGlyph os={os} g="🎤" size={30} /></span>
        </div>
      )}
      {duo && sides && (
        // Turned, emoji and dictation in a column each beside the keys, level with the bottom row.
        <>
          {(['☺', '🎤'] as const).map((g, i) => (
            <span key={g} className={styles.duoSide} style={{ [i ? 'right' : 'left']: sides.x, width: sides.w, bottom: Math.max(duo.bottom, bottomInset), height: duo.keyH }}>
              <KeyGlyph os={os} g={g} size={Math.round(duo.char * 1.1)} />
            </span>
          ))}
        </>
      )}
      {os === 'ios' && !pad && !duo && (
        // Globe (emoji, with a typed return key) and dictation below the keys, in the home indicator's band.
        <div className={styles.below} style={{ height: land ? Math.max(bottomInset + 8, 40) : Math.max(bottomInset + 37, 71) }}>
          <KeyGlyph os={os} g={action ? '☺' : '🌐'} size={27} />
          <KeyGlyph os={os} g="🎤" size={27} />
        </div>
      )}
      {os === 'android' && (
        // The nav bar while a keyboard is up: a chevron that hides it.
        <button tabIndex={-1} className={styles.hide} style={{ bottom: Math.max(0, bottomInset / 2 - 12) }} onClick={() => field?.blur()} aria-label="Hide keyboard">
          <Icon name="keyboard_arrow_down" size={24} />
        </button>
      )}
    </div>
  );
}
