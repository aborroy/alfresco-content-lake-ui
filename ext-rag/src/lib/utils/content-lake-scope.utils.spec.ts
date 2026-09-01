import {
  asNode,
  canUpdateNode,
  CONTENT_LAKE_EXCLUDE_PROPERTY,
  CONTENT_LAKE_EXCLUDE_PROPERTY_QNAME,
  CONTENT_LAKE_INDEXED_ASPECT,
  CONTENT_LAKE_INDEXED_ASPECT_QNAME,
  hasIndexedAncestor,
  hasIndexedAspect,
  isContentLakeEnabled,
  isExcludedFromLake
} from './content-lake-scope.utils';

describe('content-lake-scope.utils', () => {
  describe('asNode', () => {
    it('unwraps a NodeEntry', () => {
      expect(asNode({ entry: { id: 'n1' } } as any)).toEqual({ id: 'n1' } as any);
    });
    it('returns a bare node as-is and null for nullish', () => {
      expect(asNode({ id: 'n2' } as any)).toEqual({ id: 'n2' } as any);
      expect(asNode(null)).toBeNull();
    });
  });

  describe('hasIndexedAspect', () => {
    it('matches the short QName', () => {
      expect(hasIndexedAspect({ aspectNames: [CONTENT_LAKE_INDEXED_ASPECT] } as any)).toBeTrue();
    });
    it('matches the full QName', () => {
      expect(hasIndexedAspect({ aspectNames: [CONTENT_LAKE_INDEXED_ASPECT_QNAME] } as any)).toBeTrue();
    });
    it('is false when absent', () => {
      expect(hasIndexedAspect({ aspectNames: [] } as any)).toBeFalse();
    });
  });

  describe('isExcludedFromLake', () => {
    it('accepts boolean true and string "true" under either QName', () => {
      expect(isExcludedFromLake({ properties: { [CONTENT_LAKE_EXCLUDE_PROPERTY]: true } } as any)).toBeTrue();
      expect(isExcludedFromLake({ properties: { [CONTENT_LAKE_EXCLUDE_PROPERTY_QNAME]: 'true' } } as any)).toBeTrue();
    });
    it('is false otherwise', () => {
      expect(isExcludedFromLake({ properties: { [CONTENT_LAKE_EXCLUDE_PROPERTY]: false } } as any)).toBeFalse();
      expect(isExcludedFromLake({ properties: {} } as any)).toBeFalse();
    });
  });

  describe('hasIndexedAncestor', () => {
    it('finds an indexed path element', () => {
      const node = { path: { elements: [{ name: 'Home' }, { name: 'Fin', aspectNames: [CONTENT_LAKE_INDEXED_ASPECT] }] } } as any;
      expect(hasIndexedAncestor(node)).toBeTrue();
    });
    it('is false with no indexed ancestor', () => {
      expect(hasIndexedAncestor({ path: { elements: [{ name: 'Home' }] } } as any)).toBeFalse();
    });
  });

  describe('isContentLakeEnabled', () => {
    it('is true for a folder carrying the indexed aspect', () => {
      expect(isContentLakeEnabled({ isFolder: true, aspectNames: [CONTENT_LAKE_INDEXED_ASPECT] } as any)).toBeTrue();
    });
    it('is true for a file under an indexed ancestor', () => {
      const file = { isFile: true, path: { elements: [{ name: 'Fin', aspectNames: [CONTENT_LAKE_INDEXED_ASPECT] }] } } as any;
      expect(isContentLakeEnabled(file)).toBeTrue();
    });
    it('is false when excluded even under an indexed ancestor', () => {
      const file = {
        isFile: true,
        properties: { [CONTENT_LAKE_EXCLUDE_PROPERTY]: 'true' },
        path: { elements: [{ name: 'Fin', aspectNames: [CONTENT_LAKE_INDEXED_ASPECT] }] }
      } as any;
      expect(isContentLakeEnabled(file)).toBeFalse();
    });
  });

  describe('canUpdateNode', () => {
    it('allows when update is permitted or operations are unknown', () => {
      expect(canUpdateNode({ allowableOperations: ['update'] } as any)).toBeTrue();
      expect(canUpdateNode({ allowableOperations: [] } as any)).toBeTrue();
    });
    it('denies when operations exist without update', () => {
      expect(canUpdateNode({ allowableOperations: ['delete'] } as any)).toBeFalse();
    });
  });
});
