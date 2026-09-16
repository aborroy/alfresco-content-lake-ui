import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

import { RagApiService } from './rag-api.service';
import { sourceKeyLabel, sourceTypeLabel, splitSourceKey } from '../utils/source-label.util';
import { combineFilters, sourceIdClause } from '../utils/hxql.util';

/** One selectable source: a whole type, or one repository within a type. */
export interface ContentSourceOption {
  /** The control's value: a bare source type, or the full `<sourceType>:<sourceId>` key. */
  key: string;
  level: 'type' | 'id';
  sourceType: string;
  sourceId?: string;
  label: string;
  /** Documents this option covers, as reported by `/api/status`. */
  count: number;
}

/** The request fields that scope a search to a selected source. */
export interface SourceScope {
  sourceType?: string;
  filter?: string;
}

/**
 * What sources the index holds, and how to scope a search to one of them (#16).
 *
 * The list is derived from `GET /api/status`'s `sourceCounts`, whose keys are the stored `cin_sourceId`
 * values (`<sourceType>:<sourceId>`). That is the set of sources the index actually holds, so a source
 * type this build has never heard of - a CMIS repository, a plugin connector, a filesystem tree - is
 * offered without any change here. Two properties of that map shape this service:
 *
 * - it covers the whole index rather than what the caller may read, which is fine for an option list;
 * - `StatusController` populates it only while hxpr is UP, so a hxpr blip returns it empty.
 *
 * Hence {@link FALLBACK_TYPES}: Alfresco and Nuxeo are always offered, so an empty or failed status
 * response leaves the filter no worse than the two hardcoded options it replaced.
 */
@Injectable({ providedIn: 'root' })
export class ContentSourceCatalogService {

  /** Always offered, because a fresh index has no documents and these two are the expected sources. */
  static readonly FALLBACK_TYPES: readonly string[] = ['alfresco', 'nuxeo'];

  /** The "every source" option's value. */
  static readonly ALL_SOURCES = '';

  private ragApi = inject(RagApiService);

  private cached?: Observable<ContentSourceOption[]>;

  /**
   * The options to offer, one per source type, plus one per source id where a type has several.
   *
   * Cached for the lifetime of the app: `sourceCounts` changes only when a new source is ingested into,
   * and the search page, the chat page and the status page all read it.
   */
  options(): Observable<ContentSourceOption[]> {
    if (!this.cached) {
      this.cached = this.ragApi.getStatus().pipe(
        map((status) => this.derive(status?.sourceCounts ?? {})),
        catchError(() => of(this.derive({}))),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.cached;
  }

  /** Drops the cache so the next `options()` call re-reads `/api/status`. */
  refresh(): void {
    this.cached = undefined;
  }

  /**
   * Turns a selected option into the request fields that scope a search to it, ANDed with whatever
   * filter the caller already had.
   *
   * A type-level option uses the published `sourceType` field, which is what the three original options
   * did and keeps their behaviour byte-identical. An id-level option cannot: the request models carry no
   * `sourceId`, so it goes through the filter as an equality clause on `cin_sourceId`, which rag-service
   * treats as naming one source.
   */
  scope(option: ContentSourceOption | undefined, existingFilter?: string): SourceScope {
    if (!option || option.key === ContentSourceCatalogService.ALL_SOURCES) {
      return { filter: combineFilters(existingFilter, undefined) };
    }
    if (option.level === 'type') {
      return { sourceType: option.sourceType, filter: combineFilters(existingFilter, undefined) };
    }
    return { filter: combineFilters(existingFilter, sourceIdClause(option.key)) };
  }

  /** Finds an option by the key held in a form control. */
  find(options: readonly ContentSourceOption[], key: string): ContentSourceOption | undefined {
    return options.find((option) => option.key === key);
  }

  private derive(sourceCounts: Record<string, number>): ContentSourceOption[] {
    const idsByType = new Map<string, { sourceId: string; key: string; count: number }[]>();

    for (const [key, count] of Object.entries(sourceCounts ?? {})) {
      const { sourceType, sourceId } = splitSourceKey(key);
      if (!sourceType) {
        continue;
      }
      const ids = idsByType.get(sourceType) ?? [];
      ids.push({ sourceId, key, count: count ?? 0 });
      idsByType.set(sourceType, ids);
    }

    for (const type of ContentSourceCatalogService.FALLBACK_TYPES) {
      if (!idsByType.has(type)) {
        idsByType.set(type, []);
      }
    }

    const options: ContentSourceOption[] = [];
    const types = [...idsByType.keys()].sort(byFallbackFirstThenName);

    for (const sourceType of types) {
      const ids = idsByType.get(sourceType) ?? [];
      options.push({
        key: sourceType,
        level: 'type',
        sourceType,
        label: sourceTypeLabel(sourceType),
        count: ids.reduce((total, id) => total + id.count, 0)
      });

      // Only worth distinguishing when the type has more than one repository behind it.
      if (ids.length > 1) {
        for (const id of [...ids].sort((a, b) => b.count - a.count)) {
          options.push({
            key: id.key,
            level: 'id',
            sourceType,
            sourceId: id.sourceId,
            label: sourceKeyLabel(id.key),
            count: id.count
          });
        }
      }
    }

    return options;
  }
}

function byFallbackFirstThenName(a: string, b: string): number {
  const rank = (type: string) => {
    const idx = ContentSourceCatalogService.FALLBACK_TYPES.indexOf(type);
    return idx < 0 ? ContentSourceCatalogService.FALLBACK_TYPES.length : idx;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}
