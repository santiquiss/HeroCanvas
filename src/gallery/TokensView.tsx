// Components › Tokens › a group: its tokens as tables — what each looks like, its three names (the Figma variable,
// the CSS variable, how the app's code reads it), each copyable, and its value with the primitive it points to. A
// table has Light and Dark columns only when its tokens change with the theme. A token the code doesn't have is
// marked: that's a change to ask for.
import { NO_APP } from '../nav/noApp';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { CODE_TOKENS_COMMIT, findTokenGroup, groupSize, TOKEN_GROUPS, type ElevationToken, type Mode, type TextStyleToken, type Token, type TokenGroup } from '../design/tokenCatalog';
import type { CodeTextStyle } from '../design/textStyles';
import styles from './TokensView.module.css';

const MODES: Mode[] = ['light', 'dark'];

export function TokensView({ group: id }: { group: string }) {
  const group = findTokenGroup(id) ?? TOKEN_GROUPS[0];
  const [search] = useSearchParams();
  const marked = search.get('token');
  // The marked token (from the search) scrolls into view.
  useEffect(() => {
    if (!marked) return;
    document.querySelector(`[data-token="${CSS.escape(marked)}"]`)?.scrollIntoView({ block: 'center' });
  }, [marked, group.id]);

  const subgroups = useMemo(() => {
    const out = new Map<string, Token[]>();
    for (const t of group.tokens) out.set(group.sub(t), [...(out.get(group.sub(t)) ?? []), t]);
    return [...out.entries()];
  }, [group]);
  const system = isSystem(group);
  const missing = group.tokens.filter((t) => system && !t.code).length;

  return (
    <div className={styles.ground}>
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>{group.title}</h1>
          <span className={styles.count}>{groupSize(group)}</span>
        </div>
        <p className={styles.note}>
          {group.note}.{' '}
          {!CODE_LINKED && (NO_APP ? 'HeroCanvas’s own, for its tour: local tokens, not an app’s.' : 'Not linked to the code yet: a code connector shows how the code names each one.')}
          {system && CODE_LINKED && (
            <>
              In the code: <span className={styles.mono}>{group.codeAccess}.<i>name</i></span>
              {CODE_TOKENS_COMMIT ? ` (${CODE_TOKENS_COMMIT})` : ''}
              {missing > 0 && <span className={styles.missingNote}> · {missing} not in the code</span>}.
            </>
          )}
        </p>

        {group.codeTextStyles && <CodeTextStyleTable list={group.codeTextStyles} marked={marked} />}
        {group.textStyles && <TextStyleTable list={group.textStyles} marked={marked} />}
        {group.elevations && <ElevationTable levels={group.elevations} marked={marked} />}
        {subgroups.map(([sub, tokens]) => (
          <TokenTable key={sub} title={sub && sub[0].toUpperCase() + sub.slice(1)} tokens={tokens} group={group} marked={marked} />
        ))}
        {!!group.codeOnly?.length && (
          <Table title="Only in the code · no Figma variable" head={['Code']}>
            {group.codeOnly.map((f) => (
              <tr key={f}>
                <td>
                  <Copy text={f} label={member(f)} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

/** Groups of the system (the code has a name for each): the palette, the type scale and Other don't. */
/** Whether a code connector says how the code names the tokens: until one does, no token is "not in the code". */
const CODE_LINKED = TOKEN_GROUPS.some((g) => !!g.codeAccess || g.tokens.some((t) => t.code !== null));

/**
 * A token's name in the code. With a connector, it or "Not in the code"; without one, the tour's are Local (HeroCanvas's
 * own) and an app's unknown yet.
 */
function CodeCell({ code }: { code: string | null }) {
  if (code)
    return (
      <td>
        <Copy text={code} label={member(code)} />
      </td>
    );
  if (CODE_LINKED)
    return (
      <td>
        <span className={styles.missing}>Not in the code</span>
      </td>
    );
  return <td>{NO_APP ? <span className={styles.local}>Local</span> : <span className={styles.local} title="No code connector yet">—</span>}</td>;
}

const isSystem = (g: TokenGroup) => !['palette', 'type-scale', 'other'].includes(g.id);

/** A titled table with its column headers and widths (fixed, so a group's tables line up; the rest share what's left). */
function Table({ title, head, widths = [], children }: { title?: string; head: string[]; widths?: (string | undefined)[]; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {title && <h2 className={styles.sub}>{title}</h2>}
      <table className={styles.table}>
        <colgroup>
          {head.map((_, i) => (
            <col key={i} style={{ width: widths[i] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

function TokenTable({ title, tokens, group, marked }: { title: string; tokens: Token[]; group: TokenGroup; marked: string | null }) {
  // Light and Dark columns only when a token here changes with the theme.
  const themed = tokens.some((t) => t.value.light !== t.value.dark || t.alias.light !== t.alias.dark);
  const modes = themed ? MODES : (['light'] as Mode[]);
  const system = isSystem(group);
  const color = tokens[0]?.kind === 'color';
  const head = ['', 'Token', ...(system ? ['Code'] : []), ...(themed ? ['Light', 'Dark'] : ['Value'])];
  const widths = ['96px', system ? '42%' : '50%', system ? '24%' : undefined];
  return (
    <Table title={title} head={head} widths={widths}>
      {tokens.map((t) => (
        <tr key={t.name} className={t.name === marked ? styles.marked : ''} data-token={t.name}>
          <td className={styles.preview}>
            {color ? (
              <span className={styles.swatches}>
                {modes.map((m) => (
                  <span key={m} className={styles.swatch} style={{ background: t.value[m] }} title={`${m === 'light' ? 'Light' : 'Dark'}: ${t.value[m]}`} />
                ))}
              </span>
            ) : (
              <Visual t={t} group={group} />
            )}
          </td>
          <td>
            <Name figma={t.figma} css={`var(--${t.name})`} />
          </td>
          {system && <CodeCell code={t.code} />}
          {modes.map((m) => (
            <td key={m} className={styles.valueCell}>
              <span className={styles.mono}>{show(t.value[m], t.kind)}</span>
              {t.alias[m] && <span className={styles.alias}>{t.alias[m]!.replace(/-/g, '/')}</span>}
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

/** The Figma variable, and the CSS one to copy under it. */
function Name({ figma, css }: { figma: string; css?: string }) {
  return (
    <span className={styles.names}>
      <span className={styles.figma}>{figma}</span>
      {css && <Copy text={css} />}
    </span>
  );
}

/** What a length looks like: a bar, a radius on a box's corner, a stroke. */
function Visual({ t, group }: { t: Token; group: TokenGroup }) {
  const n = Number(t.value.light);
  if (group.id === 'spacing') return <span className={styles.bar} style={{ width: Math.max(1, Math.min(n, 64)) }} />;
  if (group.id === 'radius') return <span className={styles.radius} style={{ borderTopLeftRadius: Math.min(n, 28) }} />;
  if (group.id === 'borders') return <span className={styles.stroke} style={{ height: n }} />;
  return null;
}

/** The code's text styles: a sample in the style itself (its font shorthand), its names and its values. */
function CodeTextStyleTable({ list, marked }: { list: CodeTextStyle[]; marked: string | null }) {
  return (
    <Table title="The code's text styles" head={['Sample', 'Code', 'Figma', 'Size', 'Line height', 'Weight']} widths={['24%', '22%', '16%']}>
      {list.map((s) => (
        <tr key={s.name} className={s.name === marked ? styles.marked : ''} data-token={s.name}>
          <td className={styles.sample} style={{ font: `var(--${s.name})` }}>
            The quick brown fox
          </td>
          <td>
            <Copy text={`${s.widget}('')`} label={s.widget} />
            <span className={styles.alias}>{s.code.replace(/^context\./, '')}</span>
          </td>
          <td>
            <Name figma={s.figma} css={`var(--${s.name})`} />
          </td>
          {[s.size, s.line, s.weight].map((v, i) => (
            <td key={i} className={styles.valueCell}>
              <span className={styles.mono}>{v}</span>
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

function TextStyleTable({ list, marked }: { list: TextStyleToken[]; marked: string | null }) {
  const css = (t?: Token) => (t ? `var(--${t.name})` : undefined);
  const px = (t?: Token) => (t ? `calc(${css(t)} * 1px)` : undefined);
  const cell = (t?: Token) => (
    <td className={styles.valueCell}>
      {t && <span className={styles.mono}>{t.value.light.replace(/"/g, '')}</span>}
      {t?.alias.light && <span className={styles.alias}>{t.alias.light.replace(/-/g, '/')}</span>}
    </td>
  );
  return (
    <Table title="Figma export · text style variables" head={['Sample', 'Style', 'Code', 'Size', 'Line height', 'Weight']} widths={['24%', '18%', '28%']}>
      {list.map((s) => {
        const p = s.props;
        return (
          <tr key={s.name} className={s.name === marked ? styles.marked : ''} data-token={s.name}>
            <td className={styles.sample} style={{ fontFamily: css(p.family), fontSize: px(p.size), fontWeight: weight(p.weight), lineHeight: px(p.lineHeight), letterSpacing: px(p.letterSpacing) }}>
              The quick brown fox
            </td>
            <td>
              <Name figma={s.figma} />
            </td>
            <CodeCell code={s.code} />
            {cell(p.size)}
            {cell(p.lineHeight)}
            {cell(p.weight)}
          </tr>
        );
      })}
    </Table>
  );
}

function ElevationTable({ levels, marked }: { levels: ElevationToken[]; marked: string | null }) {
  const themed = levels.some((e) => e.shadows.light !== e.shadows.dark);
  const modes = themed ? MODES : (['light'] as Mode[]);
  return (
    <Table head={[...(themed ? ['Light', 'Dark'] : ['']), 'Level', 'Code', 'Shadow']} widths={[...modes.map(() => '80px'), '18%', '34%']}>
      {levels.map((e) => (
        <tr key={e.name} className={e.name === marked ? styles.marked : ''} data-token={e.name}>
          {modes.map((m) => (
            <td key={m} className={styles.preview}>
              <span className={`${styles.shadowBox} ${m === 'dark' ? styles.shadowDark : ''}`} style={{ boxShadow: e.shadows[m] }} />
            </td>
          ))}
          <td>
            <Name figma={e.figma} />
          </td>
          <CodeCell code={e.code} />
          <td className={styles.valueCell}>
            {/* One shadow per line (the commas inside rgba() aren't separators). */}
            {e.shadows.light.split(/,\s*(?![^(]*\))/).map((s, i) => (
              <span key={i} className={styles.mono}>
                {s}
              </span>
            ))}
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Figma's weights are names ("Regular", "Bold"); CSS wants numbers. */
const WEIGHTS: Record<string, number> = { thin: 100, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
const weight = (t?: Token) => (t ? (WEIGHTS[t.value.light.replace(/["'\s-]/g, '').toLowerCase()] ?? 400) : undefined);

/** The Code column shows the member (`accentBrand`); the group's path is in the note, and Copy copies it all. */
const member = (code: string) => code.slice(code.lastIndexOf('.') + 1);

/** A name to reference (or a shorter `label` for it): click copies it. */
function Copy({ text, label = text }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const copy = () => {
    void navigator.clipboard?.writeText(text);
    setDone(true);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setDone(false), 1200);
  };
  return (
    <button className={styles.copy} title={`Copy ${text}`} onClick={copy}>
      <span className={styles.mono}>{label}</span>
      <Icon name={done ? 'check' : 'content_copy'} size={13} />
    </button>
  );
}

/** A value as designers read it: colors in hex (with alpha when there's one), numbers as they are. */
function show(v: string, kind: Token['kind']): string {
  if (kind !== 'color') return v;
  const m = v.match(/^rgba?\(([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\)$/);
  if (!m) return v;
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const a = m[4] != null ? Number(m[4]) : 1;
  return `#${hex(+m[1])}${hex(+m[2])}${hex(+m[3])}`.toUpperCase() + (a < 1 ? ` · ${Math.round(a * 100)}%` : '');
}
