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
import { RagChatSessionService, RagChatSessionSummary } from '../../services/rag-chat-session.service';
import { ChatMessage, MergedDocument, PromptSource, RagPromptOptions, RagPromptResponse } from '../../models/rag.models';

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
  @Input() scopedNodeIsFolder = false;
  @Input() scopedNodePath: string | null = null;

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  sessionSummaries: RagChatSessionSummary[] = [];
  currentQuestion = '';
  thinking = false;
  currentRepositoryId: string | null = null;
  repositoryResolved = false;
  activeSessionId: string | null = null;

  private shouldScroll = false;
  private autoScrollEnabled = true;
  private streamRawContent = new Map<string, string>();

  constructor(
    private ragApi: RagApiService,
    private discoveryApi: DiscoveryApiService,
    private chatSessions: RagChatSessionService
  ) {}

  ngOnInit(): void {
    this.initializeConversationState();

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
    const sessionId = this.activeSessionId ?? this.chatSessions.ensureActiveSession();
    const isFirstTurn = this.messages.length === 0;
    this.activeSessionId = sessionId;
    const scopeOptions = this.buildScopeOptions();

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
    this.persistMessages();

    this.streamAssistantResponse(q, sessionId, isFirstTurn, assistantMsg, scopeOptions);
  }

  newConversation(): void {
    if (this.thinking) {
      return;
    }
    this.activeSessionId = this.chatSessions.createSession();
    this.messages = [];
    this.currentQuestion = '';
    this.autoScrollEnabled = true;
    this.refreshSessionSummaries();
    this.shouldScroll = true;
  }

  openConversation(sessionId: string): void {
    if (this.thinking || sessionId === this.activeSessionId) {
      return;
    }
    this.activeSessionId = sessionId;
    this.chatSessions.activateSession(sessionId);
    this.messages = this.chatSessions.getMessages(sessionId);
    this.autoScrollEnabled = true;
    this.refreshSessionSummaries();
    this.shouldScroll = true;
  }

  onMessagesScroll(): void {
    const el = this.messagesContainer?.nativeElement as HTMLElement | undefined;
    if (!el) {
      return;
    }
    this.autoScrollEnabled = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 96);
  }

  clearScope(): void {
    this.scopedNodeId = null;
    this.scopedNodeName = null;
    this.scopedNodeIsFolder = false;
    this.scopedNodePath = null;
  }

  scopeLabel(): string {
    return this.scopedNodeName?.trim() || 'All content';
  }

  scopeIcon(): string {
    if (!this.scopedNodeId) {
      return 'travel_explore';
    }
    return this.scopedNodeIsFolder ? 'folder' : 'description';
  }

  trackSession(_index: number, session: RagChatSessionSummary): string {
    return session.sessionId;
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

  private initializeConversationState(): void {
    this.activeSessionId = this.chatSessions.ensureActiveSession();
    this.messages = this.chatSessions.getMessages(this.activeSessionId);
    this.refreshSessionSummaries();
    this.shouldScroll = true;
  }

  private refreshSessionSummaries(): void {
    this.sessionSummaries = this.chatSessions.listSessions();
  }

  private persistMessages(): void {
    if (!this.activeSessionId) {
      return;
    }
    this.chatSessions.saveMessages(this.activeSessionId, this.messages);
    this.refreshSessionSummaries();
  }

  private streamAssistantResponse(
    question: string,
    sessionId: string,
    isFirstTurn: boolean,
    assistantMsg: ChatMessage,
    scopeOptions: Pick<RagPromptOptions, 'nodeId' | 'filter'>
  ): void {
    this.ragApi.streamPrompt(question, {
      ...scopeOptions,
      sessionId,
      resetSession: isFirstTurn
    }).subscribe({
      next: (event) => {
        if (event.type === 'token') {
          const raw = `${this.streamRawContent.get(assistantMsg.id) ?? ''}${event.token}`;
          this.streamRawContent.set(assistantMsg.id, raw);
          assistantMsg.content = this.toPlainText(raw);
          this.shouldScroll = this.autoScrollEnabled;
          this.persistMessages();
          return;
        }

        if (event.type === 'metadata') {
          this.applyPromptResponse(assistantMsg, event.response);
          this.finishAssistantMessage(assistantMsg);
          this.persistMessages();
          return;
        }

        this.finishAssistantMessage(assistantMsg);
        this.persistMessages();
      },
      error: (err) => {
        if (this.isStreamEndpointUnavailable(err)) {
          this.fallbackToPrompt(question, sessionId, isFirstTurn, assistantMsg, scopeOptions);
          return;
        }

        this.streamRawContent.delete(assistantMsg.id);
        assistantMsg.loading = false;
        assistantMsg.error = err?.error?.message || err?.message || 'Request failed';
        this.thinking = false;
        this.shouldScroll = this.autoScrollEnabled;
        this.persistMessages();
      }
    });
  }

  private fallbackToPrompt(
    question: string,
    sessionId: string,
    isFirstTurn: boolean,
    assistantMsg: ChatMessage,
    scopeOptions: Pick<RagPromptOptions, 'nodeId' | 'filter'>
  ): void {
    this.ragApi.prompt(question, {
      ...scopeOptions,
      sessionId,
      resetSession: isFirstTurn
    }).subscribe({
      next: (response) => {
        this.applyPromptResponse(assistantMsg, response);
        this.finishAssistantMessage(assistantMsg);
        this.persistMessages();
      },
      error: (err) => {
        this.streamRawContent.delete(assistantMsg.id);
        assistantMsg.loading = false;
        assistantMsg.error = err?.error?.message || err?.message || 'Request failed';
        this.thinking = false;
        this.shouldScroll = this.autoScrollEnabled;
        this.persistMessages();
      }
    });
  }

  private applyPromptResponse(assistantMsg: ChatMessage, response: RagPromptResponse): void {
    if (response.sessionId) {
      this.activeSessionId = response.sessionId;
    }
    if (response.answer) {
      assistantMsg.content = this.toPlainText(response.answer);
      this.streamRawContent.delete(assistantMsg.id);
    }
    assistantMsg.model = response.model;
    assistantMsg.tokenCount = response.tokenCount;
    assistantMsg.totalMs = response.totalTimeMs;
    assistantMsg.searchTimeMs = response.searchTimeMs;
    assistantMsg.generationTimeMs = response.generationTimeMs;
    assistantMsg.sources = this.mergeSources(response.sources ?? []);
    assistantMsg.error = undefined;
  }

  private finishAssistantMessage(assistantMsg: ChatMessage): void {
    this.streamRawContent.delete(assistantMsg.id);
    assistantMsg.loading = false;
    this.thinking = false;
    this.shouldScroll = this.autoScrollEnabled;
  }

  private isStreamEndpointUnavailable(error: any): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    return message.includes('stream request failed (404)')
      || message.includes('stream request failed (405)');
  }

  private buildScopeOptions(): Pick<RagPromptOptions, 'nodeId' | 'filter'> {
    const nodeId = this.scopedNodeId?.trim();
    if (!nodeId) {
      return {};
    }

    if (!this.scopedNodeIsFolder) {
      return { nodeId };
    }

    const pathPrefix = this.scopedNodePath?.trim();
    if (!pathPrefix) {
      return { nodeId };
    }

    return {
      nodeId,
      filter: `cin_ingestProperties.alfresco_path LIKE '${this.escapeHxql(pathPrefix)}%'`
    };
  }

  private escapeHxql(value: string): string {
    return value.replace(/'/g, "''");
  }

  private toPlainText(value: string): string {
    let text = value.replace(/\r\n?/g, '\n');

    text = text
      .replace(/```[^\n]*\n?/g, '')
      .replace(/```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '- ')
      .replace(/^\s*(\d+)\.\s+/gm, '$1. ')
      .replace(/(\*\*|__)([^*_]+)\1/g, '$2')
      .replace(/(\*|_)([^*_]+)\1/g, '$2')
      .replace(/~~([^~]+)~~/g, '$1');

    text = text
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }
}
