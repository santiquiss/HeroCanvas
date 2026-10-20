// How much a proposal changes, as the toolbar's changes chip and the Proposal panel's tab show it: a dot in the
// color of each kind of change (design/changes: new, changed, removed) with its count. One place counts
// (`changeCounts`) and one draws, so the two always agree.
import { componentKind } from '../gallery/route';
import { BASE_PAGES } from '../nav/pages';
import { findProposal, proposalChanges, VARIANT_PARAM, type ProposalChanges } from '../proposals';
import { useUrlParams } from '../sim/SimContext';
import { CHANGE, type ChangeKind } from './changes';
import styles from './ChangeCounts.module.css';

/** The order changes are listed and counted in: new first, then changed, then removed. */
export const CHANGE_ORDER: ChangeKind[] = ['new', 'changed', 'removed'];

/** How many pages and components a proposal's version adds, changes and removes. */
export function changeCounts(c: ProposalChanges): Record<ChangeKind, number> {
  const count: Record<ChangeKind, number> = { changed: 0, new: 0, removed: 0 };
  for (const cm of c.components) count[cm.scope === 'added' ? 'new' : componentKind(cm.name)]++;
  for (const pg of c.pages) count[pg.kind]++;
  return count;
}

/** A kind without changes is left out. Nothing at all without any. */
export function ChangeCounts({ counts, compact = false }: { counts: Record<ChangeKind, number>; /** Tighter, for a panel's tab. */ compact?: boolean }) {
  const kinds = CHANGE_ORDER.filter((k) => counts[k]);
  if (!kinds.length) return null;
  return (
    <span className={`${styles.counts} ${compact ? styles.compact : ''}`}>
      {kinds.map((k) => (
        <span key={k} className={styles.count} title={`${counts[k]} ${CHANGE[k].label.toLowerCase()}`}>
          <span className={styles.dot} style={{ background: CHANGE[k].color }} />
          {counts[k]}
        </span>
      ))}
    </span>
  );
}

/** The counts of the proposal and version in the URL: a panel tab's badge (tools/registry). Nothing in Live. */
export function ProposalChangeCounts() {
  const get = useUrlParams();
  const p = findProposal(get('proposal'));
  return p ? <ChangeCounts compact counts={changeCounts(proposalChanges(p, get(VARIANT_PARAM), BASE_PAGES))} /> : null;
}
