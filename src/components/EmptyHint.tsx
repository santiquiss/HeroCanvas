// A part of the designer with nothing to show yet (no app connected): what it's for, so its place in the interface
// makes sense before it fills in. Centered, quiet: an icon, a name, a line or two.
import type { ReactNode } from 'react';
import surface from '../theme/surface.module.css';
import { Icon } from './Icon';

export function EmptyHint({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className={surface.empty}>
      <span className={surface.emptyIcon}>
        <Icon name={icon} size={24} />
      </span>
      <span className={surface.emptyTitle}>{title}</span>
      <span className={surface.emptyBody}>{children}</span>
    </div>
  );
}
