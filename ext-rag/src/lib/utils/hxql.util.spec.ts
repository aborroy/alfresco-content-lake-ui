import { combineFilters, escapeHxqlLiteral, sourceIdClause } from './hxql.util';

describe('hxql.util', () => {

  it('escapesSingleQuotesByDoubling', () => {
    expect(escapeHxqlLiteral("O'Brien")).toBe("O''Brien");
    expect(escapeHxqlLiteral('plain')).toBe('plain');
  });

  it('parenthesisesWhenCombiningSoAnOrCannotSwallowTheOtherClause', () => {
    // Without the parentheses this reads as `a = '1' OR (b = '2' AND c = '3')`, which is a different
    // query: the facet panel builds OR groups.
    expect(combineFilters("a = '1' OR b = '2'", "c = '3'"))
      .toBe("(a = '1' OR b = '2') AND (c = '3')");
  });

  it('returnsWhicheverSideIsPresent', () => {
    expect(combineFilters("a = '1'", undefined)).toBe("a = '1'");
    expect(combineFilters(undefined, "b = '2'")).toBe("b = '2'");
    expect(combineFilters(undefined, undefined)).toBeUndefined();
    expect(combineFilters('', '   ')).toBeUndefined();
  });

  it('pinsOneSourceWithAnEqualityClauseOnTheFullKey', () => {
    // Equality on the whole `<sourceType>:<sourceId>` value, because cin_sourceId is a keyword field
    // and HXQL rejects LIKE on those. rag-service reads this clause to scope the permission filter too.
    expect(sourceIdClause('cmis:docmgr')).toBe("cin_sourceId = 'cmis:docmgr'");
    expect(sourceIdClause("weird:o'ne")).toBe("cin_sourceId = 'weird:o''ne'");
  });
});
