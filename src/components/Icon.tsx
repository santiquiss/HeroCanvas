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
 * Material Symbols Rounded glyph. `fill` toggles the selected state. The designer's own UI draws its icons with it, and
 * so do the sample app and the kit (src/app, src/kit); a connected app can draw its own icon component through it.
 */
export function Icon({ name, size = 24, box, fill, weight, color, style, ...rest }: IconProps) {
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
