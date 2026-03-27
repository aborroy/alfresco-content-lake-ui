import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DiscoveryApiService } from '@alfresco/adf-content-services';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take } from 'rxjs/operators';

import { RagApiService } from '../../services/rag-api.service';
import { ContentSourceType, SearchResultItem, MergedDocument } from '../../models/rag.models';

@Component({
  selector: 'ext-rag-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './rag-search.component.html',
  styleUrls: ['./rag-search.component.css']
})
export class RagSearchComponent implements OnInit {

  query = '';
  topK = 5;
  minScore = 0.5;
  selectedSourceType: ContentSourceType | '' = '';
  loading = false;
  error: string | null = null;
  searchTimeMs = 0;
  documents: MergedDocument[] = [];
  currentRepositoryId: string | null = null;
  repositoryResolved = false;

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

  runSearch(): void {
    const q = this.query.trim();
    if (!q) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.ragApi.search(q, this.topK, this.minScore, this.selectedSourceType || undefined).subscribe({
      next: (res) => {
        this.searchTimeMs = res.searchTimeMs;
        this.documents = this.mergeResults(res.results);
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'Search request failed';
        this.loading = false;
      }
    });
  }

  private mergeResults(results: SearchResultItem[]): MergedDocument[] {
    const map = new Map<string, MergedDocument>();
    for (const item of results) {
      const nodeId = item.sourceDocument.nodeId;
      const sourceId = item.sourceDocument.sourceId;
      const existing = map.get(this.documentKey(nodeId, sourceId));
      if (existing) {
        existing.score = Math.max(existing.score, item.score);
        existing.chunks.push({ text: item.chunkText, score: item.score });
      } else {
        map.set(this.documentKey(nodeId, sourceId), {
          nodeId,
          sourceId,
          sourceType: item.sourceDocument.sourceType,
          name: item.sourceDocument.name,
          path: item.sourceDocument.path,
          score: item.score,
          chunks: [{ text: item.chunkText, score: item.score }],
          openInSourceUrl: item.sourceDocument.openInSourceUrl
        });
      }
    }
    return Array.from(map.values());
  }

  canOpenInRepository(doc: MergedDocument): boolean {
    const currentSourceId = this.currentAlfrescoSourceId();
    return this.repositoryResolved
      && !!doc.nodeId
      && doc.sourceType === 'alfresco'
      && !!currentSourceId
      && doc.sourceId === currentSourceId;
  }

  canOpenInSource(doc: MergedDocument): boolean {
    return !!doc.openInSourceUrl && !this.canOpenInRepository(doc);
  }

  openSourceLabel(doc: MergedDocument): string {
    return `Open in ${this.sourceSystemLabel(doc)}`;
  }

  openLinkHint(doc: MergedDocument): string {
    if (!this.repositoryResolved) {
      return 'Resolving current repository';
    }
    if (this.canOpenInRepository(doc)) {
      return 'Open in Alfresco';
    }
    if (this.canOpenInSource(doc)) {
      return this.openSourceLabel(doc);
    }
    return `No open link available for ${this.sourceSummary(doc)}`;
  }

  sourceSummary(doc: MergedDocument): string {
    if (doc.sourceType && doc.sourceId) {
      return `${this.sourceSystemLabel(doc)} · ${doc.sourceId}`;
    }
    if (doc.sourceType) {
      return this.sourceSystemLabel(doc);
    }
    return doc.sourceId ?? 'Unknown source';
  }

  private documentKey(nodeId: string, sourceId?: string): string {
    return `${sourceId ?? ''}::${nodeId}`;
  }

  private currentAlfrescoSourceId(): string | null {
    const repositoryId = this.currentRepositoryId?.trim();
    if (!repositoryId) {
      return null;
    }
    return repositoryId.startsWith('alfresco:') ? repositoryId : `alfresco:${repositoryId}`;
  }

  private sourceSystemLabel(doc: MergedDocument): string {
    switch (doc.sourceType) {
      case 'alfresco':
        return 'Alfresco';
      case 'nuxeo':
        return 'Nuxeo';
      default:
        return 'source system';
    }
  }

  private resolveRepositoryId(repository: unknown): string | null {
    return (repository as { id?: string } | null)?.id ?? null;
  }
}
