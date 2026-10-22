// About (#/about, the rail's ⓘ): HeroCanvas itself, apart from the app it shows. Its version (src/version.json),
// who made it, its license, and its changelog (src/CHANGELOG.md), as a page of its own.
import { useNavigate } from 'react-router';
import hcChangelog from '../CHANGELOG.md?raw';
import { Icon } from '../components/Icon';
import { changelogBody } from './Changelog';
import { useSetMode } from './modes';
import styles from './About.module.css';

const REPO = 'https://github.com/santiquiss/HeroCanvas';
/** The app HeroCanvas was first made for (README, The story). */
const MACROSFIRST = 'https://macrosfirst.com';
const LICENSE = 'https://www.apache.org/licenses/LICENSE-2.0';
/** Who made it, with their GitHub profiles. */
const AUTHORS = [
  { name: 'Santiago Quiss', url: 'https://github.com/santiquiss' },
  { name: 'Agustina Salas', url: 'https://github.com/salasagustina-ds' },
];
const BODY = changelogBody(hcChangelog);

export function About() {
  const navigate = useNavigate();
  const setMode = useSetMode();
  // Back where it was opened from; opened from a link (nothing before it here), to the prototype.
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : setMode('prototype'));
  return (
    <div className={styles.scroll}>
      <button className={styles.back} onClick={back} aria-label="Back" title="Back">
        <Icon name="arrow_back" size={20} />
      </button>
      <article className={styles.page}>
        {/* The app icon at 192px (made from the logo by scripts/vite/brand.ts): sharp at this size on any screen. */}
        <header className={styles.head}>
          <img src={`${import.meta.env.BASE_URL}pwa/icon-192.png`} alt="" width={96} height={96} className={styles.logo} />
          <h1 className={styles.title}>HeroCanvas</h1>
          <p className={styles.tagline}>Superpowers for Designers</p>
          <span className={styles.version}>Version {__HC_VERSION__}</span>
        </header>
        <section className={styles.credits}>
          <p>
            Made by{' '}
            {AUTHORS.map((a, i) => (
              <span key={a.url}>
                {i > 0 && ' and '}
                <a href={a.url} target="_blank" rel="noreferrer">
                  {a.name}
                </a>
              </span>
            ))}
            , in collaboration with the{' '}
            <a href={MACROSFIRST} target="_blank" rel="noreferrer">
              MacrosFirst
            </a>{' '}
            team ·{' '}
            <a href={REPO} target="_blank" rel="noreferrer">
              github.com/santiquiss/HeroCanvas
            </a>
          </p>
          <p>
            Open source under the{' '}
            <a href={LICENSE} target="_blank" rel="noreferrer">
              Apache License 2.0
            </a>
            : free to use, change and share, commercial uses included. Any copy or project built from it keeps its
            NOTICE, which names its creators.
          </p>
        </section>
        <h2 className={styles.section}>Changelog</h2>
        <div className={styles.changelog}>{BODY}</div>
      </article>
    </div>
  );
}
