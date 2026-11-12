// App Store Assets' two panels: at the left, every asset each store takes for a listing (screenshots by device, the
// icon, the feature graphic…) with how far along each is; at the right, what the chosen one must be (sizes, count,
// format, rules) and the store's advice.
import { Icon } from '../components/Icon';
import { t } from '../i18n/ui';
import { LayersList } from './LayerPanels';
import { useSelection, useStoreAsset } from './route';
import { shotsOf, useShotSets } from './shots';
import { storeOf, type StoreAsset } from './sizes';
import styles from './StoreAssets.module.css';

const REQUIRED_LABEL: Record<StoreAsset['required'], string> = {
  yes: t('Required'),
  conditional: t('Required if…'),
  no: t('Optional'),
};


/**
 * The left panel: with a screenshot open on the canvas, its layers; before, how to open one (the store's sizes are the
 * canvas's rows; the toolbar picks the store).
 */
export function StoreAssetsPanel() {
  const [asset] = useStoreAsset();
  const sets = useShotSets();
  const { shot } = useSelection();
  if (shot && shotsOf(sets, asset.id).some((s) => s.id === shot)) return <LayersList />;
  return (
    <div className={styles.panel}>
      <div className={styles.emptyPanel}>
        <Icon name="layers" size={22} />
        <strong>{t('Layers')}</strong>
        <span>{t('Click a screenshot on the canvas: its layers show here. The layout is the same in every size; each draws it with its own device.')}</span>
      </div>
    </div>
  );
}

/** The right panel: the chosen asset's requirements, then its store's advice and where it comes from. */
export function StoreGuidePanel() {
  const [asset] = useStoreAsset();
  const store = storeOf(asset);
  const sizes = asset.sizes.map(([w, h]) => `${w} × ${h}`);
  return (
    <div className={styles.panel}>
      <section className={styles.guide}>
        <h3 className={styles.guideTitle}>{asset.label}</h3>
        <span className={`${styles.badge} ${styles[`badge_${asset.required}`]}`}>{REQUIRED_LABEL[asset.required]}</span>
        {asset.requiredNote && <p className={styles.guideText}>{asset.requiredNote}</p>}
        <dl className={styles.facts}>
          <dt>{t('Sizes')}</dt>
          <dd>
            {sizes.map((s) => (
              <span key={s} className={styles.mono}>
                {s} px
              </span>
            ))}
          </dd>
          {asset.kind === 'screenshot' && (
            <>
              <dt>{t('How many')}</dt>
              <dd>{asset.min > 0 ? t('{min} to {max}, per language', { min: asset.min, max: asset.max }) : t('Up to {max}, per language', { max: asset.max })}</dd>
            </>
          )}
          <dt>{t('Format')}</dt>
          <dd>{asset.format}</dd>
        </dl>
        {asset.rules.length > 0 && (
          <ul className={styles.rules}>
            {asset.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {asset.kind !== 'screenshot' && <p className={styles.soon}>{t('Made outside HeroCanvas for now: listed so the set is complete.')}</p>}
      </section>
      <section className={styles.guide}>
        <h3 className={styles.guideTitle}>{t('{store}: advice', { store: store.name })}</h3>
        <ul className={styles.rules}>
          {store.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className={styles.sources}>
          {store.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          ))}
        </p>
      </section>
    </div>
  );
}
