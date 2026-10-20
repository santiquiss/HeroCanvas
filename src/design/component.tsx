// Component instrumentation for the Inspect and Layers tools.
//
// A component marks its root element with `{...useComponent('ListTile', props)}` (or renders `<Component>`), so the
// designer can find it in the DOM, name it after the code's component and show the props it got.
// Names not in the component catalog are fine: they show as "local".
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

export type ComponentProps = Record<string, unknown>;

interface Instance {
  name: string;
  props: ComponentProps;
  /** The component that registered it (a remount at the same place gets the same id). */
  owner: object;
}

/** Live instances by id (the `data-hc` attribute). Written on render, removed on unmount. */
const INSTANCES = new Map<string, Instance>();

export function componentInstance(id: string | undefined): Instance | undefined {
  return id ? INSTANCES.get(id) : undefined;
}

export function useComponent(name: string, props: ComponentProps = {}): { 'data-hc': string } {
  const id = 'hc' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const owner = useRef({}).current;
  const entry = { name, props, owner };
  // Written on render (the latest props) and on mount: React may unmount and remount an effect without rendering
  // again (StrictMode in development), which would leave the instance out.
  INSTANCES.set(id, entry);
  const latest = useRef(entry);
  latest.current = entry;
  useEffect(() => {
    INSTANCES.set(id, latest.current);
    // Removed on unmount, unless a component mounted at the same place (same id) has taken it over meanwhile: a page
    // remounting renders the new instance before the old one's cleanup runs.
    return () => {
      if (INSTANCES.get(id)?.owner === owner) INSTANCES.delete(id);
    };
  }, [id, owner]);
  return { 'data-hc': id };
}

interface ComponentElementProps extends HTMLAttributes<HTMLElement>, Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'type'> {
  /** The code's component name. */
  name: string;
  /** Props as the code's component would receive them (shown in Inspect and the code snippet). */
  props?: ComponentProps;
  as?: 'div' | 'span' | 'button' | 'header' | 'section';
  style?: CSSProperties;
  children?: ReactNode;
}

/** An element that is also a named component instance. For markup that has no component of its own. */
export function Component({ name, props, as: Tag = 'div', children, ...rest }: ComponentElementProps) {
  const attrs = useComponent(name, props);
  return (
    <Tag {...rest} {...attrs}>
      {children}
    </Tag>
  );
}

/** Short human hint for an instance (its title / label / series…), shown next to the name in Layers. */
export function componentHint(props: ComponentProps): string | undefined {
  for (const k of ['title', 'label', 'series', 'name', 'icon', 'variant']) {
    const v = props[k];
    // An icon by its name alone (`sort`, not `Symbols.sort`).
    if (typeof v === 'string' && v) return v.replace(/^(Symbols|Icons)\./, '');
  }
  return undefined;
}

/** Nearest instrumented element at or above `el`, inside `root`. */
export function closestComponent(el: Element | null, root: Element | null): HTMLElement | null {
  const hit = el?.closest('[data-hc]') as HTMLElement | null;
  return hit && root?.contains(hit) ? hit : null;
}

/** Instrumented ancestor of an instrumented element. */
export function parentComponent(el: HTMLElement, root: Element | null): HTMLElement | null {
  return closestComponent(el.parentElement, root);
}
