import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useDesign } from '../design/DesignContext';
import type { Mode } from './modes';
import { activeVariant, PROPOSALS, VARIANT_PARAM } from '../proposals';
import { ChangesMenu, HighlightButton } from './ChangesMenu';
import { useUrlState } from './SimContext';
import { useProposalParam } from '../tools/ProposalPanel';
import { ProposalMenu } from './ProposalMenu';
import { VersionButton } from './Changelog';
import { useCommentsUi } from '../comments';
import { t } from '../i18n/ui';
import { useGalleryRoute } from '../gallery/route';
import { ShareMenu } from '../share/ShareMenu';
import { ViewBadge } from '../share/ViewBadge';
import { can } from '../share/view';
import { toolsOn } from '../tools/PanelHost';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  mode: Mode;
}

function Chip({ active, onClick, title, tour, children }: { active?: boolean; onClick: () => void; title?: string; /** What the tour points at it by (data-tour). */ tour?: string; children: React.ReactNode }) {
  return (
    <button className={`${styles.chip} ${active ? styles.active : ''}`} onClick={onClick} title={title} data-tour={tour}>
      {children}
    </button>
  );
}

export function Toolbar(props: ToolbarProps) {
  const { inspect, setInspect } = useDesign();
  const { commenting, setCommenting } = useCommentsUi();
  const [proposalId] = useProposalParam();
  // Capture keeps the canvas to the device: no picking or commenting on it.
  const [search] = useSearchParams();
  const capture = props.mode === 'prototype' && search.get('capture') === '1';
  // In Components, a component's examples take comments (not the overview).
  const gallery = useGalleryRoute().name;
  useEffect(() => {
    if (!capture) return;
    setInspect(false);
    setCommenting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);
  return (
    <div className={styles.toolbar}>
      {/* Each panel's toggle at its own edge, as in Figma. */}
      {/* No panel on the left in this view (a guest's link without Pages): no toggle for it. */}
      {toolsOn('left', props.mode).length > 0 && (
        <button className={styles.panelBtn} title={t('Toggle left panel')} onClick={props.onToggleLeft}>
          <Icon name={props.leftOpen ? 'left_panel_close' : 'left_panel_open'} size={18} />
        </button>
      )}
      {/* The logo, the modes and HeroCanvas's own version are the rail's (ModeRail); this copy's version stays here,
          opening its changelog. */}
      {can('about') && <VersionButton />}
      {can('proposals') && (
        <>
          <ProposalMenu />
          <VariantPicker />
          <ChangesMenu proposalId={proposalId} />
          {/* With the proposal it outlines: the changes chip, then Highlight changes. */}
          <HighlightButton proposalId={proposalId} />
        </>
      )}
      {/* A guest's view (until when it lasts), or one being tried (and the way back). */}
      <ViewBadge />
      {/* View controls (device, orientation, theme) float at the bottom of the canvas: ViewBar. */}
      <div className={styles.spacer} />
      {/* The actions on the right, closer together than the bar's own spacing. */}
      <div className={styles.actions}>
      {props.mode !== 'flow' && props.mode !== 'tokens' && !capture && can('inspect') && (
        <Chip active={inspect} onClick={() => setInspect(!inspect)} title={t('Inspect components (I)')} tour="inspect">
          <Icon name="ads_click" size={18} />
          {t('Inspect')}
        </Chip>
      )}
      {(props.mode === 'prototype' || (props.mode === 'components' && gallery)) && !capture && can('comments') && (
        <Chip
          active={commenting}
          onClick={() => setCommenting(!commenting)}
          title={props.mode === 'components' ? t('Comment: click on the component to leave one (C)') : t('Comment: click on the screen to leave one (C)')}
          tour="comment"
        >
          <Icon name="add_comment" size={18} />
          {t('Comment')}
        </Chip>
      )}
      {/* Capture is in the mode rail (ModeRail). */}
      {/* Capture's picture is exported, not linked: a link here wouldn't bring it. */}
      {!capture && can('share') && <ShareMenu />}
      {/* No panel on the right in this view (a guest's): no toggle for it. */}
      {toolsOn('right', props.mode).length > 0 && (
        <button className={styles.panelBtn} title={t('Toggle right panel')} onClick={props.onToggleRight}>
          <Icon name={props.rightOpen ? 'right_panel_close' : 'right_panel_open'} size={18} />
        </button>
      )}
      </div>
    </div>
  );
}

/** The active proposal's versions (A, B, C…), when it has some: `?variant=`. A dropdown, so any number fits. */
function VariantPicker() {
  const [current] = useProposalParam();
  const p = PROPOSALS.find((x) => x.id === current);
  const [variant, setVariant] = useUrlState<string>(VARIANT_PARAM, '');
  if (!p?.variants.length) return null;
  const on = activeVariant(p, variant)!;
  return (
    <label className={styles.select} title={on.description ? `${on.label}: ${on.description}` : t('Version of the proposal')}>
      <span className={styles.variantKey}>{on.id.toUpperCase()}</span>
      <span>{on.label}</span>
      {/* The first is the default: the unset param. */}
      <select value={on.id} onChange={(e) => setVariant(e.target.value === p.variants[0].id ? null : e.target.value)} aria-label={t('Version')}>
        {p.variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.id.toUpperCase()} · {v.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" size={18} />
    </label>
  );
}


