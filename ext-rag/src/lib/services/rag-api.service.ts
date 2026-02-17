import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '@alfresco/adf-core';
import { Observable } from 'rxjs';

import {
  SemanticSearchRequest,
  SemanticSearchResponse,
  RagPromptRequest,
  RagPromptResponse
} from '../models/rag.models';

/**
 * Client for the alfresco-content-lake rag-service REST API.
 *
 * All paths are read from `app.config.json`:
 *
 *   "plugins": {
 *     "ragService": {
 *       "baseUrl":    "/api/rag",
 *       "searchPath": "/search/semantic",
 *       "promptPath": "/prompt"
 *     }
 *   }
 *
 * Authentication is handled by `RagAuthInterceptor`, which attaches
 * the Alfresco ticket to every `/api/rag` request automatically.
 */
@Injectable({ providedIn: 'root' })
export class RagApiService {

  private baseUrl: string;
  private searchPath: string;
  private promptPath: string;

  constructor(
    private http: HttpClient,
    private appConfig: AppConfigService
  ) {
    this.baseUrl    = this.appConfig.get<string>('plugins.ragService.baseUrl',    '/api/rag');
    this.searchPath = this.appConfig.get<string>('plugins.ragService.searchPath', '/search/semantic');
    this.promptPath = this.appConfig.get<string>('plugins.ragService.promptPath', '/prompt');
  }

  /**
   * Semantic search across indexed content-lake chunks.
   */
  search(query: string, topK = 5, minScore = 0.5): Observable<SemanticSearchResponse> {
    const body: SemanticSearchRequest = { query, topK, minScore };
    return this.http.post<SemanticSearchResponse>(
      `${this.baseUrl}${this.searchPath}`,
      body
    );
  }

  /**
   * RAG question-answering.  Optionally scoped to a single document.
   */
  prompt(question: string, nodeId?: string): Observable<RagPromptResponse> {
    const body: RagPromptRequest = { question, ...(nodeId && { nodeId }) };
    return this.http.post<RagPromptResponse>(
      `${this.baseUrl}${this.promptPath}`,
      body
    );
  }
}
