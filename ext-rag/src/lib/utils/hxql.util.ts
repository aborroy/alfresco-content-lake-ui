/**
 * The HXQL string operations the extension needs.
 *
 * Kept in one place because the facet panel and the source filter both build clauses that end up in the
 * same `filter` field, and they have to escape and combine them the same way.
 */

/** Escapes a value for an HXQL single-quoted literal. */
export function escapeHxqlLiteral(value: string): string {
  return (value ?? '').replace(/'/g, "''");
}

/**
 * ANDs two optional filters, parenthesising each so a clause containing `OR` cannot swallow the other.
 * Returns undefined when both are empty.
 */
export function combineFilters(a?: string, b?: string): string | undefined {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (left && right) {
    return `(${left}) AND (${right})`;
  }
  return left || right || undefined;
}

/**
 * The clause that pins a search to exactly one source.
 *
 * `cin_sourceId` holds `<sourceType>:<sourceId>`, and rag-service treats an equality clause on it in the
 * caller's own filter as the caller naming one source: `PermissionSourceCatalog.resolve` gives it
 * precedence over the `sourceType` request field and over the operator's pinned source ids, so this
 * narrows the permission filter as well as the query. It must be `=` with the full value, because
 * `cin_sourceId` is a keyword field and HXQL rejects `LIKE` on those.
 */
export function sourceIdClause(sourceKey: string): string {
  return `cin_sourceId = '${escapeHxqlLiteral(sourceKey)}'`;
}
