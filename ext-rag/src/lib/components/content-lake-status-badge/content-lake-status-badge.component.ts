import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Node, NodeEntry } from '@alfresco/js-api';
import { Subscription, catchError, of } from 'rxjs';

import { ContentLakeFolderStatusSummary, ContentLakeSyncStatus } from '../../models/rag.models';
import { ContentLakeStatusBatchService } from '../../services/content-lake-status-batch.service';
import { asNode } from '../../utils/content-lake-scope.utils';

type DocumentStatus = ContentLakeSyncStatus | 'NOT_APPLICABLE' | 'NOT_AVAILABLE';

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

  private status: DocumentStatus = 'NOT_AVAILABLE';
  private statusError: string | null = null;
  private folderSummary: ContentLakeFolderStatusSummary | null = null;

  ngOnChanges(): void {
    this.refreshStatus();
  }

  ngOnDestroy(): void {
    this.statusRequest?.unsubscribe();
  }

  get statusIcon(): string {
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
    switch (this.status) {
      case 'PENDING':
        return this.appendFolderSummary('Content Lake status: Pending');
      case 'INDEXED':
        return this.appendFolderSummary('Content Lake status: Indexed');
      case 'FAILED':
        return this.appendFolderSummary(
          this.statusError?.trim() ? `Content Lake status: Error (${this.statusError})` : 'Content Lake status: Error'
        );
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
    this.folderSummary = null;

    if (!node?.id || (!node.isFile && !node.isFolder)) {
      this.status = 'NOT_APPLICABLE';
      this.cdr.markForCheck();
      return;
    }

    this.statusRequest = this.batchService
      .getNodeStatus(node.id)
      .pipe(catchError(() => of(null)))
      .subscribe((nodeStatus) => {
        if (!nodeStatus) {
          this.status = 'NOT_AVAILABLE';
          this.statusError = null;
          this.folderSummary = null;
          this.cdr.markForCheck();
          return;
        }

        if (!nodeStatus.inScope) {
          this.status = 'NOT_APPLICABLE';
          this.statusError = null;
          this.folderSummary = null;
          this.cdr.markForCheck();
          return;
        }

        if (nodeStatus.folder && !nodeStatus.folderSummary && nodeStatus.status === null) {
          this.status = 'NOT_AVAILABLE';
          this.statusError = null;
          this.folderSummary = null;
          this.cdr.markForCheck();
          return;
        }

        this.status = nodeStatus.status ?? 'PENDING';
        this.statusError = nodeStatus.error ?? null;
        this.folderSummary = nodeStatus.folderSummary ?? null;
        this.cdr.markForCheck();
      });
  }

  private appendFolderSummary(base: string): string {
    if (!this.folderSummary) {
      return base;
    }

    return `${base} · ${this.folderSummary.totalDocuments} docs (${this.folderSummary.indexedDocuments} indexed, ${this.folderSummary.pendingDocuments} pending, ${this.folderSummary.failedDocuments} failed)`;
  }
}
