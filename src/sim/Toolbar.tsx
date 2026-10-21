import { useEffect, useState } from 'react';
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
import styles from './Toolbar.module.css';

interface ToolbarProps {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  mode: Mode;
}

function Chip({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button className={`${styles.chip} ${active ? styles.active : ''}`} onClick={onClick} title={title}>
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
  useEffect(() => {
    if (!capture) return;
    setInspect(false);
    setCommenting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);
  return (
    <div className={styles.toolbar}>
      {/* Each panel's toggle at its own edge, as in Figma. */}
      <button className={styles.panelBtn} title="Toggle left panel" onClick={props.onToggleLeft}>
        <Icon name={props.leftOpen ? 'left_panel_close' : 'left_panel_open'} size={18} />
      </button>
      {/* The logo, the modes and HeroCanvas's own version are the rail's (ModeRail); this copy's version stays here,
          opening its changelog. */}
      <VersionButton />
      <ProposalMenu />
      <VariantPicker />
      <ChangesMenu proposalId={proposalId} />
      {/* With the proposal it outlines: the changes chip, then Highlight changes. */}
      <HighlightButton proposalId={proposalId} />
      {/* View controls (device, orientation, theme) float at the bottom of the canvas: ViewBar. */}
      <div className={styles.spacer} />
      {/* The actions on the right, closer together than the bar's own spacing. */}
      <div className={styles.actions}>
      {props.mode !== 'flow' && props.mode !== 'tokens' && !capture && (
        <Chip active={inspect} onClick={() => setInspect(!inspect)} title="Inspect components (I)">
          <Icon name="ads_click" size={18} />
          Inspect
        </Chip>
      )}
      {props.mode === 'prototype' && !capture && (
        <Chip active={commenting} onClick={() => setCommenting(!commenting)} title="Comment: click on the screen to leave one (C)">
          <Icon name="add_comment" size={18} />
          Comment
        </Chip>
      )}
      {/* Capture is in the mode rail (ModeRail). */}
      {/* Capture's picture is exported, not linked: a link here wouldn't bring it. */}
      {!capture && <ShareButton />}
      <button className={styles.panelBtn} title="Toggle right panel" onClick={props.onToggleRight}>
        <Icon name={props.rightOpen ? 'right_panel_close' : 'right_panel_open'} size={18} />
      </button>
      </div>
    </div>
  );
}

/**
 * Copies a link to what's on screen: every state is in the URL (page, stack, device, theme, persona, proposal,
 * scenario controls), so the link opens the same view. What's logged while trying the prototype isn't in it.
 */
function ShareButton() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const share = () => navigator.clipboard.writeText(window.location.href).then(() => setCopied(true));
  return (
    <button className={styles.share} onClick={share} title="Copy a link to this view">
      <Icon name={copied ? 'check' : 'link'} size={18} />
      {copied ? 'Link copied' : 'Share'}
    </button>
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
    <label className={styles.select} title={on.description ? `${on.label}: ${on.description}` : 'Version of the proposal'}>
      <span className={styles.variantKey}>{on.id.toUpperCase()}</span>
      <span>{on.label}</span>
      {/* The first is the default: the unset param. */}
      <select value={on.id} onChange={(e) => setVariant(e.target.value === p.variants[0].id ? null : e.target.value)} aria-label="Version">
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


