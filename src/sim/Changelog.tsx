// The version in the toolbar: a button that opens CHANGELOG.md (the file itself, imported raw) in a panel under it.
// Closes on a click outside or Esc.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import changelog from '../../CHANGELOG.md?raw';
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

/** The changelog's blocks: each version (`## ` heading) with its paragraphs and bullet lists. */
function render(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(' '))}</p>);
    if (list.length)
      out.push(
        <ul key={out.length}>
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const line of md.split('\n')) {
    if (line.startsWith('# ')) continue;
    if (line.startsWith('## ')) {
      flush();
      out.push(<h3 key={out.length}>{inline(line.slice(3))}</h3>);
    } else if (line.startsWith('- ')) {
      if (para.length) flush();
      list.push(line.slice(2));
    } else if (/^\s+\S/.test(line) && list.length) list[list.length - 1] += ' ' + line.trim();
    else if (!line.trim()) flush();
    else para.push(line.trim());
  }
  flush();
  return out;
}

// From the first version: the file's intro (how versions are numbered) is for the repo, not the panel.
const BODY = render(changelog.slice(changelog.indexOf('\n## ') + 1));

export function VersionButton() {
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
      <button className={`${styles.version} ${open ? styles.versionOn : ''}`} title="What's new (CHANGELOG.md)" aria-expanded={open} onClick={() => setOpen(!open)}>
        v{__APP_VERSION__}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Changelog">
          <div className={styles.head}>
            <span>Changelog</span>
            <button className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className={styles.body}>{BODY}</div>
        </div>
      )}
    </span>
  );
}
