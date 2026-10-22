// An app's own token catalog (app/connectors/tokens.json): its groups and names, the values from its stylesheets.
import { describe, expect, it } from 'vitest';
import { fromConnector } from './tokenCatalog';

describe('a tokens connector', () => {
  it('builds the app’s groups, with each token’s design-file and code names and its value', () => {
    const [colors, space] = fromConnector({
      version: 'abc123',
      groups: [
        { id: 'brand', title: 'Brand', section: 'Colors', codeAccess: 'Theme.colors', codeOnly: ['Theme.colors.legacy'], tokens: [{ name: 'app-primary', figma: 'brand/primary', code: 'Theme.colors.primary', sub: 'brand' }] },
        { id: 'space', title: 'Space', section: 'Dimensions', tokens: [{ name: 'app-space-m' }] },
      ],
    });
    const primary = colors.tokens[0];
    expect(primary).toMatchObject({ name: 'app-primary', figma: 'brand/primary', code: 'Theme.colors.primary', kind: 'color' });
    expect(primary.base).toMatch(/^#|^rgb/);
    expect(colors.sub(primary)).toBe('brand');
    expect(colors.codeOnly).toEqual(['Theme.colors.legacy']);
    expect(space.tokens[0]).toMatchObject({ figma: 'app-space-m', code: null, kind: 'number' });
  });
});
