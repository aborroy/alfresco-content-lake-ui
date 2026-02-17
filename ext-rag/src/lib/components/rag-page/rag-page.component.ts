import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { RagSearchComponent } from '../rag-search/rag-search.component';
import { RagChatComponent } from '../rag-chat/rag-chat.component';

/**
 * Full-page wrapper that hosts both the chat and semantic-search panels
 * inside a tab group.
 *
 * When navigated to with `?nodeId=xxx&name=yyy` query params (triggered
 * by the RAG_ASK_ABOUT effect), the chat panel is pre-scoped to that
 * document.
 */
@Component({
  selector: 'ext-rag-page',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    RagSearchComponent,
    RagChatComponent
  ],
  templateUrl: './rag-page.component.html',
  styleUrls: ['./rag-page.component.css']
})
export class RagPageComponent implements OnInit {

  prefilledNodeId: string | null = null;
  prefilledNodeName: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.prefilledNodeId = params['nodeId'] || null;
      this.prefilledNodeName = params['name'] || null;
    });
  }
}
