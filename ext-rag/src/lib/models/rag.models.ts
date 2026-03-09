/**
 * Interfaces for rag-service REST API communication.
 *
 * These models match the endpoints defined in the alfresco-content-lake
 * rag-service module (see issue #6).
 */

/* ------------------------------------------------------------------ */
/*  Semantic Search  –  API response                                  */
/* ------------------------------------------------------------------ */

export interface SemanticSearchRequest {
  query: string;
  topK?: number;
  minScore?: number;
}

export interface SearchResultSourceDocument {
  documentId: string;
  nodeId: string;
  sourceId?: string;
  name: string;
  path: string;
  mimeType: string;
}

export interface SearchResultChunkMetadata {
  embeddingId: string;
  embeddingType: string;
  page: number;
  paragraph: number;
  chunkLength: number;
}

/** A single chunk hit returned by /search/semantic */
export interface SearchResultItem {
  rank: number;
  score: number;
  chunkText: string;
  sourceDocument: SearchResultSourceDocument;
  chunkMetadata: SearchResultChunkMetadata;
}

export interface SemanticSearchResponse {
  query: string;
  model: string;
  vectorDimension: number;
  resultCount: number;
  totalCount: number;
  searchTimeMs: number;
  results: SearchResultItem[];
}

/* ------------------------------------------------------------------ */
/*  RAG Prompt (Q&A)  –  API response                                 */
/* ------------------------------------------------------------------ */

export interface RagPromptRequest {
  question: string;
  nodeId?: string;
}

/** A single source chunk returned by /prompt */
export interface PromptSource {
  documentId: string;
  nodeId: string;
  sourceId?: string;
  name: string;
  path: string;
  chunkText: string;
  score: number;
}

export interface RagPromptResponse {
  answer: string;
  question: string;
  model: string;
  searchTimeMs: number;
  generationTimeMs: number;
  totalTimeMs: number;
  sourcesUsed: number;
  sources: PromptSource[];
}

/* ------------------------------------------------------------------ */
/*  Merged view models  –  chunks grouped by document for the UI      */
/* ------------------------------------------------------------------ */

export interface ChunkSnippet {
  text: string;
  score: number;
}

export interface MergedDocument {
  nodeId: string;
  sourceId?: string;
  name: string;
  path: string;
  score: number;
  chunks: ChunkSnippet[];
}

/* ------------------------------------------------------------------ */
/*  Content Lake node status  –  batch-ingester API                   */
/* ------------------------------------------------------------------ */

export type ContentLakeSyncStatus = 'PENDING' | 'INDEXED' | 'FAILED';

export interface ContentLakeNodeStatus {
  nodeId: string;
  status: ContentLakeSyncStatus | null;
  exists: boolean;
  folder: boolean;
  inScope: boolean;
  excluded: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Chat UI state (local, not persisted)                              */
/* ------------------------------------------------------------------ */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  // Only present for assistant messages
  model?: string;
  totalMs?: number;
  searchTimeMs?: number;
  generationTimeMs?: number;
  sources?: MergedDocument[];
  loading?: boolean;
  error?: string;
}
