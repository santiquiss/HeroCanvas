// This copy's version in the toolbar (package.json): a button that opens its CHANGELOG.md, the team's record of their
// mirror and proposals, in a panel under it (a click outside or Esc closes it). HeroCanvas's own version and
// changelog have their page (About, the rail's ⓘ); the markdown reading here serves both.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import styles from './Changelog.module.css';

/** Inline markdown: **bold**, `code` and [links](url). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    return part;
  });
}

/** The changelog's blocks: each version (`## ` heading) with its paragraphs and bullet lists (one level nested). */
function render(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { text: string; sub: string[] }[] = [];
  const flush = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(' '))}</p>);
    if (list.length)
      out.push(
        <ul key={out.length}>
          {list.map((li, i) => (
            <li key={i}>
              {inline(li.text)}
              {li.sub.length > 0 && (
                <ul>
                  {li.sub.map((s, j) => (
                    <li key={j}>{inline(s)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const line of md.split('\n')) {
    const last = list[list.length - 1];
    if (line.startsWith('# ')) continue;
    if (line.startsWith('## ')) {
      flush();
      out.push(<h3 key={out.length}>{inline(line.slice(3))}</h3>);
    } else if (line.startsWith('- ')) {
      if (para.length) flush();
      list.push({ text: line.slice(2), sub: [] });
    } else if (/^\s+- /.test(line) && last) last.sub.push(line.trim().slice(2));
    else if (/^\s+\S/.test(line) && last) {
      // A wrapped line: it continues the last item, or its last nested one.
      if (last.sub.length) last.sub[last.sub.length - 1] += ' ' + line.trim();
      else last.text += ' ' + line.trim();
    } else if (!line.trim()) flush();
    else para.push(line.trim());
  }
  flush();
  return out;
}

// The team's changelog, at the project's root: optional (a copy may not keep one).
const appChangelog = Object.values(import.meta.glob<string>('/CHANGELOG.md', { eager: true, query: '?raw', import: 'default' }))[0];

/** A changelog from its first version: the file's intro (how versions are numbered) is for the repo, not the page. */
export const changelogBody = (md: string) => render(md.slice(md.indexOf('\n## ') + 1));

const APP_BODY = appChangelog ? changelogBody(appChangelog) : null;

/** A toolbar button with its panel under it. */
function Popup({ label, title, panelTitle, children }: { label: ReactNode; title: string; panelTitle: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={box} className={styles.wrap}>
      <button className={`${styles.version} ${open ? styles.versionOn : ''}`} title={title} aria-label={title} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label={panelTitle}>
          <div className={styles.head}>
            <span>{panelTitle}</span>
            <button className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </span>
  );
}

/** This copy's version: the team's changelog. */
export function VersionButton() {
  return (
    <Popup label={`v${__APP_VERSION__}`} title="This copy's changes (CHANGELOG.md)" panelTitle="Changelog">
      {APP_BODY ?? <p>No CHANGELOG.md at the project's root: start one to keep track of your mirror and proposals.</p>}
    </Popup>
  );
}
