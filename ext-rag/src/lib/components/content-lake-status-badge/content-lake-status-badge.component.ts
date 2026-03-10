import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Node, NodeEntry } from '@alfresco/js-api';
import { Subscription, catchError, of } from 'rxjs';

import { ContentLakeSyncStatus } from '../../models/rag.models';
import { ContentLakeStatusBatchService } from '../../services/content-lake-status-batch.service';
import { asNode, isContentLakeEnabled, isExcludedFromLake } from '../../utils/content-lake-scope.utils';

type DocumentStatus = ContentLakeSyncStatus | 'NOT_APPLICABLE' | 'NOT_AVAILABLE';

/**
 * Folder-specific scope indicator shown instead of aggregated ingestion
 * status (which is expensive). The full breakdown is available in the
 * Content Lake sidebar when the user selects the folder.
 */
type FolderScope = 'IN_SCOPE' | 'EXCLUDED' | 'OUT_OF_SCOPE';

@Component({
  selector: 'ext-rag-content-lake-status-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './content-lake-status-badge.component.html',
  styleUrl: './content-lake-status-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentLakeStatusBadgeComponent implements OnChanges, OnDestroy {
  @Input() data?: { node?: NodeEntry | Node };

  private readonly batchService = inject(ContentLakeStatusBatchService);
  private readonly cdr = inject(ChangeDetectorRef);
  private statusRequest?: Subscription;

  private isFolder = false;
  private status: DocumentStatus = 'NOT_AVAILABLE';
  private statusError: string | null = null;
  private folderScope: FolderScope = 'OUT_OF_SCOPE';

  ngOnChanges(): void {
    this.refreshStatus();
  }

  ngOnDestroy(): void {
    this.statusRequest?.unsubscribe();
  }

  get statusIcon(): string {
    if (this.isFolder) {
      switch (this.folderScope) {
        case 'IN_SCOPE':
          return 'check_circle';
        case 'EXCLUDED':
          return 'block';
        default:
          return 'remove_circle_outline';
      }
    }

    switch (this.status) {
      case 'PENDING':
        return 'schedule';
      case 'INDEXED':
        return 'check_circle';
      case 'FAILED':
        return 'error';
      case 'NOT_APPLICABLE':
        return 'remove_circle_outline';
      default:
        return 'help_outline';
    }
  }

  get statusClass(): string {
    if (this.isFolder) {
      switch (this.folderScope) {
        case 'IN_SCOPE':
          return 'ext-rag-status-badge--in-scope';
        case 'EXCLUDED':
          return 'ext-rag-status-badge--excluded';
        default:
          return 'ext-rag-status-badge--default';
      }
    }

    switch (this.status) {
      case 'PENDING':
        return 'ext-rag-status-badge--pending';
      case 'INDEXED':
        return 'ext-rag-status-badge--indexed';
      case 'FAILED':
        return 'ext-rag-status-badge--failed';
      default:
        return 'ext-rag-status-badge--default';
    }
  }

  get statusTooltip(): string {
    if (this.isFolder) {
      switch (this.folderScope) {
        case 'IN_SCOPE':
          return 'Content Lake: In scope';
        case 'EXCLUDED':
          return 'Content Lake: Excluded';
        default:
          return 'Content Lake: Not in scope';
      }
    }

    switch (this.status) {
      case 'PENDING':
        return 'Content Lake status: Pending';
      case 'INDEXED':
        return 'Content Lake status: Indexed';
      case 'FAILED':
        return this.statusError?.trim() ? `Content Lake status: Error (${this.statusError})` : 'Content Lake status: Error';
      case 'NOT_APPLICABLE':
        return 'Content Lake status: Not applicable';
      default:
        return 'Content Lake status: Not available';
    }
  }

  private refreshStatus(): void {
    const node = asNode(this.data?.node);
    this.statusRequest?.unsubscribe();
    this.statusError = null;
    this.isFolder = !!node?.isFolder;

    if (!node?.id || (!node.isFile && !node.isFolder)) {
      this.status = 'NOT_APPLICABLE';
      this.folderScope = 'OUT_OF_SCOPE';
      this.cdr.markForCheck();
      return;
    }

    // Folders: derive scope from node aspects (no server call needed).
    // Detailed ingestion status is available in the Content Lake sidebar.
    if (node.isFolder) {
      if (isExcludedFromLake(node)) {
        this.folderScope = 'EXCLUDED';
      } else if (isContentLakeEnabled(node)) {
        this.folderScope = 'IN_SCOPE';
      } else {
        this.folderScope = 'OUT_OF_SCOPE';
      }
      this.cdr.markForCheck();
      return;
    }

    // Files: use the batch service for per-document ingestion status.
    this.statusRequest = this.batchService
      .getNodeStatus(node.id)
      .pipe(catchError(() => of(null)))
      .subscribe((nodeStatus) => {
        if (!nodeStatus) {
          this.status = 'NOT_AVAILABLE';
          this.statusError = null;
          this.cdr.markForCheck();
          return;
        }

        if (!nodeStatus.inScope) {
          this.status = 'NOT_APPLICABLE';
          this.statusError = null;
          this.cdr.markForCheck();
          return;
        }

        this.status = nodeStatus.status ?? 'PENDING';
        this.statusError = nodeStatus.error ?? null;
        this.cdr.markForCheck();
      });
  }
}
