import { describe, expect, it } from 'vitest';
import type { Manifest } from './stack';
import type { PageDef } from './types';
import { pageGroups } from './pageGroups';

const page = (level: PageDef['level'], extra: Partial<PageDef> = {}): PageDef => ({ path: '/x', level, title: 'x', component: () => null, ...extra });

describe('pageGroups', () => {
  it('without groups: boot pages, then App (tabs first, then other roots)', () => {
    const pages: Manifest = { settings: page('push'), splash: page('boot'), home: page('tab'), detail: page('push', { parent: 'home' }), more: page('tab') };
    expect(pageGroups(pages)).toEqual([
      { key: 'boot', roots: ['splash'] },
      { key: 'app', roots: ['home', 'more', 'settings'] },
    ]);
  });

  it("an app's section goes where its first page is: before the first tab, above App", () => {
    const pages: Manifest = {
      login: page('cover', { group: 'Cuenta' }),
      onboarding: page('cover', { group: 'Cuenta' }),
      home: page('tab'),
      help: page('cover', { group: 'Ayuda' }),
      settings: page('push'),
    };
    expect(pageGroups(pages)).toEqual([
      { key: 'Cuenta', roots: ['login', 'onboarding'] },
      { key: 'app', roots: ['home', 'settings'] },
      { key: 'Ayuda', roots: ['help'] },
    ]);
  });

  it('a tab is always App’s; a child page follows its parent, whatever its group', () => {
    const pages: Manifest = { home: page('tab', { group: 'Otra' }), step: page('push', { parent: 'home', group: 'Otra' }) };
    expect(pageGroups(pages)).toEqual([{ key: 'app', roots: ['home'] }]);
  });
});
