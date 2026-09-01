import { resolveNodePath } from './node-path.util';

describe('resolveNodePath', () => {
  it('joins path elements with the node name', () => {
    const node = {
      name: 'Budget.xlsx',
      path: { elements: [{ name: 'Company Home' }, { name: 'Sites' }, { name: 'finance' }] }
    };
    expect(resolveNodePath(node)).toBe('/Company Home/Sites/finance/Budget.xlsx');
  });

  it('trims blank/whitespace segments', () => {
    const node = { name: '  Doc  ', path: { elements: [{ name: ' Home ' }, { name: '' }, {}] } };
    expect(resolveNodePath(node)).toBe('/Home/Doc');
  });

  it('returns null when there are no usable segments', () => {
    expect(resolveNodePath({})).toBeNull();
    expect(resolveNodePath({ path: { elements: [] } })).toBeNull();
    expect(resolveNodePath(null)).toBeNull();
  });

  it('handles a node name with no path elements', () => {
    expect(resolveNodePath({ name: 'Solo' })).toBe('/Solo');
  });
});
