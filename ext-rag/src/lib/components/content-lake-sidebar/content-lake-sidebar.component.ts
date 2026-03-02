import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NodesApiService } from '@alfresco/adf-content-services';
import { Node, NodeEntry } from '@alfresco/js-api';
import { catchError, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ContentLakeScopeService } from '../../services/content-lake-scope.service';
import {
  asNode,
  canManageExcludeOverride,
  canUpdateNode,
  findIndexedAncestor,
  hasIndexedAspect,
  isContentLakeEnabled,
  isExcludedFromLake
} from '../../utils/content-lake-scope.utils';

@Component({
  selector: 'ext-rag-content-lake-sidebar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSlideToggleModule],
  templateUrl: './content-lake-sidebar.component.html',
  styleUrl: './content-lake-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentLakeSidebarComponent {
  private readonly destroyRef = inject(DestroyRef);

  nodeEntry: NodeEntry | null = null;
  loading = false;
  saving = false;

  constructor(
    private readonly store: Store<any>,
    private readonly scopeService: ContentLakeScopeService,
    private readonly nodesApiService: NodesApiService
  ) {
    this.store
      .select((state: any) => state?.app?.selection?.first?.entry ?? state?.app?.selection?.file?.entry ?? state?.app?.selection?.folder?.entry ?? null)
      .pipe(
        distinctUntilChanged((previous: Node | null, current: Node | null) => previous?.id === current?.id),
        switchMap((node: Node | null) => {
          if (!node?.id) {
            this.nodeEntry = null;
            return of(null);
          }

          this.loading = true;
          return this.scopeService.getNode(node.id).pipe(
            catchError(() => of({ entry: node } as NodeEntry)),
            finalize(() => {
              this.loading = false;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((nodeEntry) => {
        this.nodeEntry = nodeEntry;
      });

    this.nodesApiService.nodeUpdated
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((node: Node) => {
        if (this.node?.id === node?.id) {
          this.nodeEntry = { entry: node } as NodeEntry;
        }
      });
  }

  get node(): Node | null {
    return asNode(this.nodeEntry);
  }

  get isFolder(): boolean {
    return !!this.node?.isFolder;
  }

  get isFile(): boolean {
    return !!this.node?.isFile;
  }

  get folderIndexed(): boolean {
    return hasIndexedAspect(this.node);
  }

  get documentExcluded(): boolean {
    return isExcludedFromLake(this.node);
  }

  get contentLakeEnabled(): boolean {
    return isContentLakeEnabled(this.node);
  }

  get statusIcon(): string {
    if (this.documentExcluded) {
      return 'block';
    }

    return this.contentLakeEnabled ? 'offline_bolt' : 'hide_source';
  }

  get folderToggleEnabled(): boolean {
    return this.isFolder && canUpdateNode(this.node) && !this.saving;
  }

  get documentToggleEnabled(): boolean {
    return this.isFile && canUpdateNode(this.node) && canManageExcludeOverride(this.node) && !this.saving;
  }

  get currentStatus(): string {
    const node = this.node;
    if (!node) {
      return 'Select a folder or document to manage Content Lake scope.';
    }

    const indexedAncestor = findIndexedAncestor(node);
    if (node.isFolder) {
      if (hasIndexedAspect(node)) {
        return 'This folder is a Content Lake scope root.';
      }
      if (indexedAncestor) {
        return `This folder inherits Content Lake scope from "${indexedAncestor.name}".`;
      }
      return 'This folder is outside Content Lake scope.';
    }

    if (isExcludedFromLake(node)) {
      return 'This document is explicitly excluded from Content Lake.';
    }
    if (this.contentLakeEnabled && indexedAncestor) {
      return `This document is included through "${indexedAncestor.name}".`;
    }
    return 'This document is outside Content Lake scope.';
  }

  onFolderIndexedChange(event: MatSlideToggleChange): void {
    if (!this.node) {
      return;
    }

    this.saving = true;
    this.scopeService
      .setFolderIndexed(this.node, event.checked)
      .pipe(
        finalize(() => {
          this.saving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((updatedNode) => {
        this.nodeEntry = updatedNode;
      });
  }

  onDocumentExcludedChange(event: MatSlideToggleChange): void {
    if (!this.node) {
      return;
    }

    this.saving = true;
    this.scopeService
      .setDocumentExcluded(this.node, event.checked)
      .pipe(
        finalize(() => {
          this.saving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((updatedNode) => {
        this.nodeEntry = updatedNode;
      });
  }
}
