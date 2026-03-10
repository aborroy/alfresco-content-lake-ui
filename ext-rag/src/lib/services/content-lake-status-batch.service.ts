import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '@alfresco/adf-core';
import { Observable, ReplaySubject, catchError, map, of } from 'rxjs';

import { ContentLakeNodeStatus } from '../models/rag.models';

/**
 * Batches individual node-status lookups into a single HTTP request.
 *
 * Badge components call {@link getNodeStatus} independently for each visible
 * document/folder. This service collects every ID requested during the same
 * micro-task (i.e. the same Angular change-detection pass) and resolves them
 * all with one `POST /nodes/status` call.
 *
 * Folder aggregate counts (indexed / pending / failed) are **not** included
 * in the batch call because the server-side aggregation is expensive for
 * large folders. Use {@link getNodeStatusDetailed} when you need the
 * {@link ContentLakeFolderStatusSummary} for a single selected folder
 * (e.g. the Content Lake sidebar).
 */
@Injectable({ providedIn: 'root' })
export class ContentLakeStatusBatchService {
  private readonly statusBaseUrl: string;
  private pending = new Map<string, ReplaySubject<ContentLakeNodeStatus | null>>();
  private flushScheduled = false;

  constructor(
    private readonly http: HttpClient,
    appConfig: AppConfigService
  ) {
    this.statusBaseUrl = appConfig.get<string>('plugins.contentLakeService.baseUrl', '/api/content-lake');
  }

  /**
   * Returns the status for a single node (without folder aggregate counts).
   *
   * The actual HTTP call is deferred until the current micro-task ends so
   * that multiple calls made in the same render cycle are batched together.
   */
  getNodeStatus(nodeId: string): Observable<ContentLakeNodeStatus | null> {
    let subject = this.pending.get(nodeId);
    if (!subject) {
      subject = new ReplaySubject<ContentLakeNodeStatus | null>(1);
      this.pending.set(nodeId, subject);
    }
    this.scheduleFlush();
    return subject.asObservable();
  }

  /**
   * Returns the status for a single node **with** folder aggregate counts.
   *
   * This is a dedicated non-batched call intended for the sidebar where
   * the user explicitly selects a folder and expects detailed ingestion
   * statistics. It is NOT batched because `includeFolderAggregate` is
   * expensive and should only be requested for one node at a time.
   */
  getNodeStatusDetailed(nodeId: string): Observable<ContentLakeNodeStatus | null> {
    return this.http
      .post<Record<string, ContentLakeNodeStatus>>(`${this.statusBaseUrl}/nodes/status`, {
        nodeIds: [nodeId],
        includeFolderAggregate: true
      })
      .pipe(
        map((results) => results[nodeId] ?? null),
        catchError(() => of(null))
      );
  }

  /**
   * Invalidate any in-flight batch so that the next call to
   * {@link getNodeStatus} triggers a fresh request.
   */
  invalidate(nodeId: string): void {
    this.pending.delete(nodeId);
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;

    const batch = new Map(this.pending);
    this.pending.clear();

    const nodeIds = Array.from(batch.keys());
    if (nodeIds.length === 0) {
      return;
    }

    this.http
      .post<Record<string, ContentLakeNodeStatus>>(`${this.statusBaseUrl}/nodes/status`, {
        nodeIds
      })
      .pipe(catchError(() => of({} as Record<string, ContentLakeNodeStatus>)))
      .subscribe((results) => {
        for (const [id, subject] of batch) {
          subject.next(results[id] ?? null);
          subject.complete();
        }
      });
  }
}
