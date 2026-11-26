// The designer's multi-select: a button that opens a list of options, each with a checkbox (and, optionally, a dot of
// its color and a count). None checked means all: the button says so. ui-sdk's Select with `multiple`
// (try-ui-library): opening, closing, the keyboard (typing an option's name), toggling with the list kept open and
// focus are its; the rows and their look are ours. Designer UI (not an app component): e.g. the Components list's state
// filter.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@ui-sdk/react/select";
import { Icon } from "../components/Icon";
import styles from "./CheckDropdown.module.css";
import { t } from "../i18n/ui";

export interface CheckOption<V extends string> {
  value: V;
  label: string;
  /** A dot before the label, in this color. */
  color?: string;
  /** A number at the end of the row (how many there are). */
  count?: number;
}

export interface CheckDropdownProps<V extends string> {
  /** What it filters, before the choice on the button ("State"). */
  label: string;
  options: CheckOption<V>[];
  /** The checked values; none: all. */
  selected: V[];
  onChange: (selected: V[]) => void;
  /** The button's text when none is checked. Default "All". */
  allLabel?: string;
}

export function CheckDropdown<V extends string>({
  label,
  options,
  selected,
  onChange,
  allLabel = t("All"),
}: CheckDropdownProps<V>) {
  const picked = options.filter((o) => selected.includes(o.value));
  const summary = !picked.length
    ? allLabel
    : picked.length === 1
      ? picked[0].label
      : t("{count} selected", { count: picked.length });

  // Its own box, as before: the rows it sits in size their first child, and Select also renders a hidden form field.
  return (
    <div className={styles.root}>
      <Select
        multiple
        value={selected}
        onValueChange={(v) => Array.isArray(v) && onChange(v as V[])}
      >
        <SelectTrigger
          className={styles.trigger}
          aria-label={`${label}: ${summary}`}
        >
          <span className={styles.label}>{label}</span>
          {picked.some((o) => o.color) && (
            <span className={styles.dots}>
              {picked.map(
                (o) =>
                  o.color && (
                    <span
                      key={o.value}
                      className={styles.dot}
                      style={{ background: o.color }}
                    />
                  ),
              )}
            </span>
          )}
          <span className={styles.summary}>{summary}</span>
          <Icon name="unfold_more" size={16} color="var(--ui-text-muted)" />
        </SelectTrigger>
        <SelectContent className={styles.menu} sideOffset={4} align="start">
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              label={o.label}
              className={styles.option}
            >
              <span className={styles.box} aria-hidden>
                <Icon name="check" size={12} color="currentColor" />
              </span>
              {o.color && (
                <span className={styles.dot} style={{ background: o.color }} />
              )}
              <span className={styles.optionLabel}>{o.label}</span>
              {o.count != null && (
                <span className={styles.count}>{o.count}</span>
              )}
            </SelectItem>
          ))}
          <button
            className={styles.clear}
            disabled={!selected.length}
            onClick={() => onChange([])}
          >
            <span>{t("Show all")}</span>
          </button>
        </SelectContent>
      </Select>
    </div>
  );
}
