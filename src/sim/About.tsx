// About (#/about, the rail's ⓘ): HeroCanvas itself, apart from the app it shows. Its version (src/version.json),
// who made it, its license, and its changelog (src/CHANGELOG.md), as a page of its own.
import hcChangelog from '../CHANGELOG.md?raw';
import { changelogBody } from './Changelog';
import styles from './About.module.css';

const REPO = 'https://github.com/santiquiss/HeroCanvas';
const LICENSE = 'https://polyformproject.org/licenses/shield/1.0.0';
/** Who made it, with their GitHub profiles. */
const AUTHORS = [
  { name: 'Santiago Quiss', url: 'https://github.com/santiquiss' },
  { name: 'Agus Salas', url: 'https://github.com/salasagustina-ds' },
];
const BODY = changelogBody(hcChangelog);

export function About() {
  return (
    <div className={styles.scroll}>
      <article className={styles.page}>
        <header className={styles.head}>
          <img src="/assets/logo-64.png" alt="" width={56} height={56} className={styles.logo} />
          <div>
            <h1 className={styles.title}>HeroCanvas</h1>
            <span className={styles.version}>Version {__HC_VERSION__}</span>
          </div>
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
            ))}{' '}
            ·{' '}
            <a href={REPO} target="_blank" rel="noreferrer">
              github.com/santiquiss/HeroCanvas
            </a>
          </p>
          <p>
            Free to use, change and share under the{' '}
            <a href={LICENSE} target="_blank" rel="noreferrer">
              PolyForm Shield License 1.0.0
            </a>
            , for any app, commercial ones included, except to offer a product that competes with HeroCanvas. Keep its
            copyright notice with any copy.
          </p>
        </section>
        <h2 className={styles.section}>Changelog</h2>
        <div className={styles.changelog}>{BODY}</div>
      </article>
    </div>
  );
}
