// "In Figma" block on a gallery page: mapping status, Figma link, the component's options, differences and to-dos.
import { Icon } from '../components/Icon';
import { figmaComponent, STATUS_LABEL, type FigmaComponent, type FigmaProp, type MapEntry } from '../design/figma';
import styles from './Gallery.module.css';
import { plural, t } from '../i18n/ui';

export function FigmaInfo({ entries, figmaOnly }: { entries: MapEntry[]; figmaOnly?: FigmaComponent }) {
  if (figmaOnly) return <div className={styles.figmaList}><FigmaCard title={figmaOnly.name} component={figmaOnly} /></div>;
  if (!entries.length) return null;
  return (
    <div className={styles.figmaList}>
      {entries.map((m) => (
        <FigmaCard key={m.code} title={m.code} entry={m} component={figmaComponent(m.figma)} />
      ))}
    </div>
  );
}

function FigmaCard({ title, entry, component }: { title: string; entry?: MapEntry; component?: FigmaComponent }) {
  const st = entry ? STATUS_LABEL[entry.status] : null;
  return (
    <div className={styles.figma}>
      <div className={styles.figmaHead}>
        <Icon name="design_services" size={16} />
        <span className={styles.figmaTitle}>{entry ? `${title} → ${entry.figma ?? t('not in Figma')}` : t('{name} · in Figma', { name: title })}</span>
        {st && (
          <span className={styles.status} style={{ background: st.color }}>
            {st.label}
          </span>
        )}
        {component && (
          <a className={styles.link} href={component.figmaUrl} target="_blank" rel="noreferrer">
            {t('Open in Figma')}
            <Icon name="open_in_new" size={14} />
          </a>
        )}
      </div>
      {component && (
        <div className={styles.props}>
          {compress(component.props).map((p) => (
            <div key={p.name} className={styles.prop}>
              <span className={styles.propName}>{p.name}</span>
              <span className={styles.propOptions}>
                {p.type === 'variant' ? (
                  p.options!.map((o) => (
                    <span key={o} className={styles.chip}>
                      {o}
                    </span>
                  ))
                ) : (
                  <span className={styles.dim}>{p.type === 'bool' ? t('on / off') : p.type === 'text' ? (p.default ? t('text · “{value}”', { value: String(p.default) }) : t('text')) : p.type}</span>
                )}
              </span>
            </div>
          ))}
          {component.variants && <span className={styles.dim}>{plural(component.variants.length, '{n} variant', '{n} variants')}</span>}
        </div>
      )}
      {entry?.diff && <p className={styles.figmaDiff}>{entry.diff}</p>}
      {!!entry?.todo.length && (
        <ul className={styles.todo}>
          {entry.todo.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Show Row 02 … Show Row 15" → one entry. */
export function compress(props: FigmaProp[]): FigmaProp[] {
  const out: (FigmaProp & { series?: string; first?: string })[] = [];
  for (const p of props) {
    const m = p.type === 'bool' ? p.name.match(/^(.*?)\s*(\d+)$/) : null;
    const prev = out[out.length - 1];
    if (m && prev?.series === m[1]) {
      prev.name = `${m[1]} ${prev.first}–${m[2]}`;
      continue;
    }
    out.push(m ? { ...p, series: m[1], first: m[2] } : p);
  }
  return out;
}
