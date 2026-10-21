import type { CSSProperties, HTMLAttributes } from 'react';

interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  name: string;
  size?: number;
  /** Width of the glyph box; the reference clips some icons narrower than their size. */
  box?: number;
  fill?: boolean;
  weight?: number;
  color?: string;
  style?: CSSProperties;
}

/**
 * An icon: a Material Symbols Rounded glyph by its name, or an SF Symbol (or the app's own symbol) as `sf:<name>`, made
 * with `npm run symbols`. Material Symbols Rounded glyph. `fill` toggles the selected state. The designer's own UI draws its icons with it, and
 * so do the sample app and the kit (app, src/kit); a connected app can draw its own icon component through it.
 */
/** The SF Symbols and app symbols the team made (`npm run symbols`, app/symbols.json): name → file and size in points. */
const SYMBOLS = Object.values(import.meta.glob('@app/symbols.json', { eager: true, import: 'default' }))[0] as Record<string, { file: string; w: number; h: number }> | undefined;

const SF_WEIGHTS: [number, string][] = [[150, 'ultralight'], [250, 'thin'], [350, 'light'], [450, 'regular'], [550, 'medium'], [650, 'semibold'], [750, 'bold'], [850, 'heavy'], [1000, 'black']];

/**
 * An SF Symbol (or an app's own symbol), `sf:<name>`: its rendered mask, in the text's color, scaled from the 32
 * points it was made at to `size` as Material's glyphs sit in theirs. `fill` takes its `.fill` variant, `weight` its
 * weight, when they were made; else the regular one. Missing: an empty box and a hint in the console.
 */
function SfSymbol({ name, size, box, fill, weight, color, style, rest }: { name: string; size: number; box?: number; fill?: boolean; weight?: number; color?: string; style?: CSSProperties; rest: HTMLAttributes<HTMLSpanElement> }) {
  const base = fill && SYMBOLS?.[`${name}.fill`] ? `${name}.fill` : name;
  const w = weight ? SF_WEIGHTS.find(([max]) => weight < max)?.[1] : undefined;
  const sym = (w && SYMBOLS?.[`${base}:${w}`]) || SYMBOLS?.[base];
  if (!sym && typeof console !== 'undefined') console.warn(`No symbol "${base}": run npm run symbols -- ${base}`);
  // From its 32 points to `size`, a little inside as Material's glyphs sit; then smaller still if it's wider than its box.
  const k = sym ? (size / 32) * 0.8 * Math.min(1, (box ?? size) / ((sym.w * size) / 32) / 0.8, 1) : 0;
  const mask = sym ? `${(sym.w * k).toFixed(2)}px ${(sym.h * k).toFixed(2)}px` : undefined;
  const url = sym ? `url(${import.meta.env.BASE_URL}symbols/${sym.file})` : undefined;
  return (
    <span
      aria-hidden
      {...rest}
      style={{
        display: 'inline-block',
        flex: 'none',
        width: box ?? size,
        height: size,
        backgroundColor: url ? (color ?? 'currentColor') : undefined,
        maskImage: url,
        WebkitMaskImage: url,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskSize: mask,
        WebkitMaskSize: mask,
        ...style,
      }}
    />
  );
}

export function Icon({ name, size = 24, box, fill, weight, color, style, ...rest }: IconProps) {
  if (name.startsWith('sf:')) return <SfSymbol name={name.slice(3)} size={size} box={box} fill={fill} weight={weight} color={color} style={style} rest={rest} />;
  const vars = [`'FILL' ${fill ? 1 : 0}`];
  if (weight) vars.push(`'wght' ${weight}`);
  return (
    <span
      aria-hidden
      {...rest}
      style={{
        fontFamily: "'Material Symbols Rounded'",
        fontSize: size,
        lineHeight: `${size}px`,
        width: box ?? size,
        overflow: 'hidden',
        flex: 'none',
        display: 'inline-block',
        fontVariationSettings: vars.join(', '),
        color,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
