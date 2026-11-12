// How much the store needs a size or graphic, one badge wherever it's listed (the canvas's rows, the export's picker):
// Required, Recommended (not required, but worth making), Required if… (on a platform, from a date); its reason on
// hover. Nothing for one that's only optional.
import { t } from '../i18n/ui';
import type { StoreAsset } from './sizes';
import styles from './StoreAssets.module.css';

export function RequiredBadge({ asset }: { asset: Pick<StoreAsset, 'required' | 'requiredNote' | 'recommended'> }) {
  const [kind, label, why] =
    asset.required === 'yes'
      ? (['yes', t('Required'), asset.requiredNote] as const)
      : asset.recommended
        ? (['recommended', t('Recommended'), asset.recommended] as const)
        : asset.required === 'conditional'
          ? (['conditional', t('Required if…'), asset.requiredNote] as const)
          : [null, '', undefined];
  if (!kind) return null;
  return (
    <span className={`${styles.badge} ${styles[`badge_${kind}`]}`} title={why}>
      {label}
    </span>
  );
}
