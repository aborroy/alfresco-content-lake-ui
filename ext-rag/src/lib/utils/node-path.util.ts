/**
 * Builds a human-readable repository path for a node from its `path.elements`
 * plus its own name, e.g. `/Company Home/Sites/finance/Budget.xlsx`.
 *
 * Returns null when no usable segments are present.
 */
export function resolveNodePath(node: any): string | null {
  const elements = Array.isArray(node?.path?.elements) ? node.path.elements : [];
  const segments: string[] = [];

  for (const element of elements) {
    const name = element?.name;
    if (typeof name === 'string' && name.trim()) {
      segments.push(name.trim());
    }
  }

  if (typeof node?.name === 'string' && node.name.trim()) {
    segments.push(node.name.trim());
  }

  if (segments.length === 0) {
    return null;
  }

  return `/${segments.join('/')}`;
}
