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
    // The exact selector path is:
    //   state['app']['selection']['file']['entry']
    this.store.select((state: any) => state?.app?.selection?.file)
      .pipe(takeUntil(this.destroy$))
      .subscribe(file => {
        if (file?.entry) {
          this.nodeId = file.entry.id;
          this.nodeName = file.entry.name;
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
