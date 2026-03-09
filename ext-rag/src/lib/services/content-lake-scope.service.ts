import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DocumentListService, AlfrescoApiService, NodesApiService } from '@alfresco/adf-content-services';
import { Node, NodeBodyUpdate, NodeEntry, NodesApi } from '@alfresco/js-api';
import { AppConfigService, NotificationService } from '@alfresco/adf-core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { ContentLakeNodeStatus } from '../models/rag.models';
import {
  asNode,
  CONTENT_LAKE_EXCLUDE_PROPERTY_QNAME,
  CONTENT_LAKE_FILE_SCOPE_ASPECT,
  CONTENT_LAKE_FILE_SCOPE_ASPECT_QNAME,
  CONTENT_LAKE_INDEXED_ASPECT,
  CONTENT_LAKE_INDEXED_ASPECT_QNAME,
  ContentLakeNodeLike
} from '../utils/content-lake-scope.utils';

@Injectable({ providedIn: 'root' })
export class ContentLakeScopeService {
  private nodesApiInstance: NodesApi | null = null;
  private readonly statusBaseUrl: string;

  constructor(
    private readonly alfrescoApi: AlfrescoApiService,
    private readonly nodesApiService: NodesApiService,
    private readonly documentListService: DocumentListService,
    private readonly notifications: NotificationService,
    private readonly http: HttpClient,
    appConfig: AppConfigService
  ) {
    this.statusBaseUrl = appConfig.get<string>('plugins.contentLakeService.baseUrl', '/api/content-lake');
  }

  getNode(nodeId: string): Observable<NodeEntry> {
    return from(this.nodesApi.getNode(nodeId, { include: ['path', 'properties', 'allowableOperations', 'permissions', 'aspectNames'] }));
  }

  getNodeStatus(nodeId: string): Observable<ContentLakeNodeStatus> {
    return this.http.get<ContentLakeNodeStatus>(`${this.statusBaseUrl}/nodes/${nodeId}/status`);
  }

  setFolderIndexed(nodeLike: ContentLakeNodeLike, indexed: boolean): Observable<NodeEntry> {
    const node = this.requireNode(nodeLike);
    return this.getNode(node.id).pipe(
      switchMap((nodeEntry) => {
        const aspectNames = this.copyAspectNames(nodeEntry.entry);

        if (indexed) {
          aspectNames.add(CONTENT_LAKE_INDEXED_ASPECT_QNAME);
        } else {
          this.removeAspect(aspectNames, CONTENT_LAKE_INDEXED_ASPECT, CONTENT_LAKE_INDEXED_ASPECT_QNAME);
        }

        return this.updateNode(node.id, {
          aspectNames: Array.from(aspectNames)
        });
      }),
      tap(() =>
        this.notifications.showInfo(
          indexed ? 'Content Lake enabled for folder subtree' : 'Content Lake disabled for folder subtree'
        )
      )
    );
  }

  setNodeExcluded(nodeLike: ContentLakeNodeLike, excluded: boolean): Observable<NodeEntry> {
    const node = this.requireNode(nodeLike);
    const isFolder = !!node.isFolder;
    return this.getNode(node.id).pipe(
      switchMap((nodeEntry) => {
        const aspectNames = this.copyAspectNames(nodeEntry.entry);
        const update: NodeBodyUpdate = {
          aspectNames: Array.from(aspectNames)
        };

        if (excluded) {
          aspectNames.add(CONTENT_LAKE_FILE_SCOPE_ASPECT_QNAME);
          update.properties = {
            [CONTENT_LAKE_EXCLUDE_PROPERTY_QNAME]: 'true'
          };
        } else {
          this.removeAspect(aspectNames, CONTENT_LAKE_FILE_SCOPE_ASPECT, CONTENT_LAKE_FILE_SCOPE_ASPECT_QNAME);
        }

        update.aspectNames = Array.from(aspectNames);
        return this.updateNode(node.id, update);
      }),
      tap(() =>
        this.notifications.showInfo(
          excluded
            ? (isFolder ? 'Folder subtree excluded from Content Lake' : 'Document excluded from Content Lake')
            : (isFolder ? 'Folder subtree restored to inherited scope' : 'Document restored to inherited scope')
        )
      )
    );
  }

  private updateNode(nodeId: string, update: NodeBodyUpdate): Observable<NodeEntry> {
    return from(this.nodesApi.updateNode(nodeId, update, { include: ['path', 'properties', 'allowableOperations', 'permissions', 'aspectNames'] })).pipe(
      tap((updatedNode) => {
        this.nodesApiService.nodeUpdated.next(updatedNode.entry);
        this.documentListService.reload();
      }),
      catchError((error) => {
        this.notifications.showError(this.getUpdateErrorMessage(error));
        return throwError(() => error);
      })
    );
  }

  private get nodesApi(): NodesApi {
    this.nodesApiInstance = this.nodesApiInstance ?? new NodesApi(this.alfrescoApi.getInstance());
    return this.nodesApiInstance;
  }

  private requireNode(nodeLike: ContentLakeNodeLike): Node {
    const node = asNode(nodeLike);
    if (!node?.id) {
      throw new Error('A valid Alfresco node is required');
    }
    return node;
  }

  private copyAspectNames(node: Node): Set<string> {
    return new Set((node.aspectNames ?? []).map((aspectName) => {
      if (aspectName === CONTENT_LAKE_INDEXED_ASPECT) {
        return CONTENT_LAKE_INDEXED_ASPECT_QNAME;
      }
      if (aspectName === CONTENT_LAKE_FILE_SCOPE_ASPECT) {
        return CONTENT_LAKE_FILE_SCOPE_ASPECT_QNAME;
      }
      return aspectName;
    }));
  }

  private removeAspect(aspectNames: Set<string>, shortQName: string, fullQName: string): void {
    aspectNames.delete(shortQName);
    aspectNames.delete(fullQName);
  }

  private getUpdateErrorMessage(error: any): string {
    const details = this.extractErrorDetails(error);

    if (
      details.includes('namespace prefix cl is not mapped') ||
      details.includes("cl:indexed isn't a valid qname") ||
      details.includes("cl:excludefromlake isn't a valid qname")
    ) {
      return 'Content Lake model is not deployed in Alfresco. Install content-lake-repo-model and restart the repository.';
    }

    return 'Unable to update Content Lake scope';
  }

  private extractErrorDetails(error: any): string {
    return [
      error?.error?.error?.briefSummary,
      error?.error?.error?.description,
      error?.error?.briefSummary,
      error?.error?.message,
      error?.message
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();
  }
}
