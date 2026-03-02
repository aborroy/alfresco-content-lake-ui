import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DiscoveryApiService } from '@alfresco/adf-content-services';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take } from 'rxjs/operators';

import { RagApiService } from '../../services/rag-api.service';
import { ChatMessage, MergedDocument, PromptSource } from '../../models/rag.models';

let _nextId = 0;

@Component({
  selector: 'ext-rag-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './rag-chat.component.html',
  styleUrls: ['./rag-chat.component.css']
})
export class RagChatComponent implements AfterViewChecked, OnInit {

  /** When true the layout is narrower (sidebar mode). */
  @Input() compact = false;

  /** Pre-scope all questions to a specific document. */
  @Input() scopedNodeId: string | null = null;
  @Input() scopedNodeName: string | null = null;

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  currentQuestion = '';
  thinking = false;
  currentRepositoryId: string | null = null;
  repositoryResolved = false;

  private shouldScroll = false;

  constructor(
    private ragApi: RagApiService,
    private discoveryApi: DiscoveryApiService
  ) {}

  ngOnInit(): void {
    this.discoveryApi.getEcmProductInfo()
      .pipe(take(1))
      .subscribe({
        next: (repository) => {
          this.currentRepositoryId = this.resolveRepositoryId(repository);
          this.repositoryResolved = true;
        },
        error: () => {
          this.repositoryResolved = true;
        }
      });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ask(): void {
    const q = this.currentQuestion.trim();
    if (!q || this.thinking) {
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${_nextId++}`,
      role: 'user',
      content: q,
      timestamp: new Date()
    };
    this.messages.push(userMsg);

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: `msg-${_nextId++}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true
    };
    this.messages.push(assistantMsg);

    this.currentQuestion = '';
    this.thinking = true;
    this.shouldScroll = true;

    this.ragApi.prompt(q, this.scopedNodeId ?? undefined).subscribe({
      next: (res) => {
        assistantMsg.content = res.answer;
        assistantMsg.model = res.model;
        assistantMsg.totalMs = res.totalTimeMs;
        assistantMsg.searchTimeMs = res.searchTimeMs;
        assistantMsg.generationTimeMs = res.generationTimeMs;
        assistantMsg.sources = this.mergeSources(res.sources);
        assistantMsg.loading = false;
        this.thinking = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        assistantMsg.loading = false;
        assistantMsg.error = err?.error?.message || err?.message || 'Request failed';
        this.thinking = false;
        this.shouldScroll = true;
      }
    });
  }

  clearScope(): void {
    this.scopedNodeId = null;
    this.scopedNodeName = null;
  }

  private mergeSources(sources: PromptSource[]): MergedDocument[] {
    const map = new Map<string, MergedDocument>();
    for (const src of sources) {
      const existing = map.get(this.documentKey(src.nodeId, src.sourceId));
      if (existing) {
        existing.chunks.push({ text: src.chunkText, score: src.score });
      } else {
        map.set(this.documentKey(src.nodeId, src.sourceId), {
          nodeId: src.nodeId,
          sourceId: src.sourceId,
          name: src.name,
          path: src.path,
          score: src.score,
          chunks: [{ text: src.chunkText, score: src.score }]
        });
      }
    }
    return Array.from(map.values());
  }

  canOpenInRepository(doc: MergedDocument): boolean {
    return this.repositoryResolved
      && !!doc.nodeId
      && (!doc.sourceId || doc.sourceId === this.currentRepositoryId);
  }

  openLinkHint(doc: MergedDocument): string {
    if (!this.repositoryResolved) {
      return 'Resolving current repository';
    }
    if (!doc.sourceId || doc.sourceId === this.currentRepositoryId) {
      return 'Open in repository';
    }
    return `Stored in source repository ${doc.sourceId}`;
  }

  private documentKey(nodeId: string, sourceId?: string): string {
    return `${sourceId ?? ''}::${nodeId}`;
  }

  private resolveRepositoryId(repository: unknown): string | null {
    return (repository as { id?: string } | null)?.id ?? null;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {
      // ignore
    }
  }
}
