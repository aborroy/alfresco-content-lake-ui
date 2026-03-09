import { Node, NodeEntry, PathElement } from '@alfresco/js-api';

export const CONTENT_LAKE_NAMESPACE_URI = 'http://www.alfresco.org/model/contentlake/1.0';
export const CONTENT_LAKE_INDEXED_ASPECT = 'cl:indexed';
export const CONTENT_LAKE_INDEXED_ASPECT_QNAME = `{${CONTENT_LAKE_NAMESPACE_URI}}indexed`;
export const CONTENT_LAKE_FILE_SCOPE_ASPECT = 'cl:fileScope';
export const CONTENT_LAKE_FILE_SCOPE_ASPECT_QNAME = `{${CONTENT_LAKE_NAMESPACE_URI}}fileScope`;
export const CONTENT_LAKE_EXCLUDE_PROPERTY = 'cl:excludeFromLake';
export const CONTENT_LAKE_EXCLUDE_PROPERTY_QNAME = `{${CONTENT_LAKE_NAMESPACE_URI}}excludeFromLake`;

export type ContentLakeNodeLike = NodeEntry | Node | { entry?: Node } | null | undefined;

export function asNode(nodeLike: ContentLakeNodeLike): Node | null {
  if (!nodeLike) {
    return null;
  }
  if ((nodeLike as NodeEntry).entry) {
    return (nodeLike as NodeEntry).entry;
  }
  return nodeLike as Node;
}

export function hasIndexedAspect(nodeLike: ContentLakeNodeLike): boolean {
  const node = asNode(nodeLike);
  return containsAspect(node?.aspectNames, CONTENT_LAKE_INDEXED_ASPECT, CONTENT_LAKE_INDEXED_ASPECT_QNAME);
}

export function isExcludedFromLake(nodeLike: ContentLakeNodeLike): boolean {
  const node = asNode(nodeLike);
  const value = getPropertyValue(node?.properties, CONTENT_LAKE_EXCLUDE_PROPERTY, CONTENT_LAKE_EXCLUDE_PROPERTY_QNAME);
  return value === true || value === 'true';
}

export function findIndexedAncestor(nodeLike: ContentLakeNodeLike): PathElement | null {
  const node = asNode(nodeLike);
  const elements = node?.path?.elements ?? [];

  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (containsAspect(element?.aspectNames, CONTENT_LAKE_INDEXED_ASPECT, CONTENT_LAKE_INDEXED_ASPECT_QNAME)) {
      return element;
    }
  }

  return null;
}

export function hasIndexedAncestor(nodeLike: ContentLakeNodeLike): boolean {
  return !!findIndexedAncestor(nodeLike);
}

export function isContentLakeEnabled(nodeLike: ContentLakeNodeLike): boolean {
  const node = asNode(nodeLike);
  if (!node || isExcludedFromLake(node)) {
    return false;
  }

  if (node.isFolder) {
    return hasIndexedAspect(node) || hasIndexedAncestor(node);
  }

  if (node.isFile) {
    return hasIndexedAncestor(node);
  }

  return false;
}

export function canManageExcludeOverride(nodeLike: ContentLakeNodeLike): boolean {
  const node = asNode(nodeLike);
  if (!node) {
    return false;
  }

  if (node.isFile) {
    return hasIndexedAncestor(node) || isExcludedFromLake(node);
  }

  if (node.isFolder) {
    return canManageFolderExclude(node);
  }

  return false;
}

export function canManageFolderExclude(nodeLike: ContentLakeNodeLike): boolean {
  const node = asNode(nodeLike);
  if (!node?.isFolder) {
    return false;
  }

  // A folder that IS the indexed root can be toggled via cl:indexed.
  // Only non-root folders inheriting scope can be excluded.
  if (hasIndexedAspect(node)) {
    return isExcludedFromLake(node);
  }

  return hasIndexedAncestor(node) || isExcludedFromLake(node);
}

export function canUpdateNode(nodeLike: ContentLakeNodeLike): boolean {
  const node = asNode(nodeLike);
  const allowableOperations = node?.allowableOperations ?? [];
  return allowableOperations.length === 0 || allowableOperations.includes('update');
}

function containsAspect(aspectNames: string[] | undefined, shortQName: string, fullQName: string): boolean {
  return !!aspectNames?.includes(shortQName) || !!aspectNames?.includes(fullQName);
}

function getPropertyValue(
  properties: Record<string, any> | undefined,
  shortQName: string,
  fullQName: string
): any {
  if (!properties) {
    return undefined;
  }

  if (fullQName in properties) {
    return properties[fullQName];
  }

  return properties[shortQName];
}
