// Real mode's only control (sim/RealShell): a panel with the few things worth changing with the device in hand — the
// page, the theme, the persona, the proposal and its version — and the way back to the designer. Nothing of it is on
// screen until it's asked for: taps on an element the app marks, its hidden developer gesture
// (sim/developerHidden). Everything it sets is in the URL, as from the designer.
import { useSearchParams } from "react-router";
import { Icon } from "../components/Icon";
import { PERSONA_PARAM, PERSONAS, findPersona } from "./persona";
import { useNavRoot } from "../nav/context";
import {
  findProposal,
  listedProposals,
  proposalLabel,
  VARIANT_PARAM,
} from "../proposals";
import { useProposalParam } from "../tools/ProposalPanel";
import { REAL_PARAM } from "./realDevice";
import styles from "./RealShell.module.css";

export function RealControls({
  info,
  open,
  onClose,
}: {
  info: string;
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useSearchParams();
  const nav = useNavRoot();
  const [proposalId, setProposal] = useProposalParam();

  const set = (key: string, value: string | null) =>
    setSearch(
      (prev) => {
        const q = new URLSearchParams(prev);
        if (value == null) q.delete(key);
        else q.set(key, value);
        return q;
      },
      { replace: true },
    );

  if (!open) return null;
  const top = nav.stack[nav.stack.length - 1];
  // Pages that open without being told which (no path params, or defaults for them).
  const pages = Object.entries(nav.pages).filter(
    ([, d]) => !d.path.includes(":") || d.defaults,
  );
  const proposal = findProposal(proposalId);
  const dark = search.get("theme") === "dark";
  return (
    <>
      <div className={styles.shim} onClick={() => onClose()} />
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Designer controls"
      >
        <div className={styles.head}>
          <span>HeroCanvas</span>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => onClose()}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className={styles.info}>{info}</div>
        <label className={styles.row}>
          <span>Page</span>
          <select
            className={styles.select}
            value={pages.some(([id]) => id === top.id) ? top.id : ""}
            onChange={(e) => {
              if (e.target.value) nav.open(e.target.value);
              onClose();
            }}
          >
            <option value="" disabled>
              {nav.title(top)}
            </option>
            {pages.map(([id, d]) => (
              <option key={id} value={id}>
                {d.name ?? (typeof d.title === "string" ? d.title : id)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.row}>
          <span>Theme</span>
          <span className={styles.seg}>
            <button aria-pressed={!dark} onClick={() => set("theme", null)}>
              Light
            </button>
            <button aria-pressed={dark} onClick={() => set("theme", "dark")}>
              Dark
            </button>
          </span>
        </div>
        {PERSONAS.length > 0 && <label className={styles.row}>
          <span>Persona</span>
          <select
            className={styles.select}
            value={findPersona(search.get(PERSONA_PARAM))?.id}
            onChange={(e) => set(PERSONA_PARAM, e.target.value)}
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>}
        <label className={styles.row}>
          <span>Design</span>
          <select
            className={styles.select}
            value={proposal?.id ?? ""}
            onChange={(e) => setProposal(e.target.value || null)}
          >
            <option value="">Live</option>
            {listedProposals(proposal?.id).map((p) => (
              <option key={p.id} value={p.id}>
                {proposalLabel(p)}
              </option>
            ))}
          </select>
        </label>
        {proposal && proposal.variants.length > 1 && (
          <label className={styles.row}>
            <span>Version</span>
            <select
              className={styles.select}
              value={search.get(VARIANT_PARAM) ?? proposal.variants[0].id}
              onChange={(e) => set(VARIANT_PARAM, e.target.value)}
            >
              {proposal.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id.toUpperCase()} · {v.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button className={styles.btn} onClick={() => set(REAL_PARAM, "0")}>
            Open the designer
          </button>
        </div>
      </div>
    </>
  );
}
