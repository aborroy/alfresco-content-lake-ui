import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';

import { RagChatComponent } from '../rag-chat/rag-chat.component';

/**
 * Wrapper that injects the compact chat panel into the ACA/ADW sidebar.
 *
 * It subscribes to the application store to read the currently selected
 * node, so every question is automatically scoped to that document.
 */
@Component({
  selector: 'ext-rag-sidebar',
  standalone: true,
  imports: [CommonModule, RagChatComponent],
  templateUrl: './rag-sidebar.component.html'
})
export class RagSidebarComponent implements OnInit, OnDestroy {

  nodeId: string | null = null;
  nodeName: string | null = null;
  nodeIsFolder = false;
  nodePath: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private store: Store<any>) {}

  ngOnInit(): void {
    // ACA/ADW expose the selection state in the root store.
    // The `first` selection covers both the document list and search rows.
    this.store.select((state: any) =>
      state?.app?.selection?.first?.entry
      ?? state?.app?.selection?.file?.entry
      ?? state?.app?.selection?.folder?.entry
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe((node) => {
        if (node?.id && (node?.isFile || node?.isFolder)) {
          this.nodeId = node.id;
          this.nodeName = node.name;
          this.nodeIsFolder = !!node.isFolder;
          this.nodePath = this.resolveNodePath(node);
        } else {
          this.nodeId = null;
          this.nodeName = null;
          this.nodeIsFolder = false;
          this.nodePath = null;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resolveNodePath(node: any): string | null {
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
}
