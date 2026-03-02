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

  private destroy$ = new Subject<void>();

  constructor(private store: Store<any>) {}

  ngOnInit(): void {
    // ACA/ADW expose the selection state in the root store.
    // The `first` selection covers both the document list and search rows.
    this.store.select((state: any) => state?.app?.selection?.first?.entry ?? state?.app?.selection?.file?.entry)
      .pipe(takeUntil(this.destroy$))
      .subscribe((node) => {
        if (node?.id && node?.isFile) {
          this.nodeId = node.id;
          this.nodeName = node.name;
        } else {
          this.nodeId = null;
          this.nodeName = null;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
