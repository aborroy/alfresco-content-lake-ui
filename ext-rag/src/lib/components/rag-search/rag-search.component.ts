import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RagApiService } from '../../services/rag-api.service';
import { SearchResultItem, MergedDocument } from '../../models/rag.models';

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
export class RagSearchComponent {

  query = '';
  topK = 5;
  minScore = 0.5;
  loading = false;
  error: string | null = null;
  searchTimeMs = 0;
  documents: MergedDocument[] = [];

  constructor(private ragApi: RagApiService) {}

  runSearch(): void {
    const q = this.query.trim();
    if (!q) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.ragApi.search(q, this.topK, this.minScore).subscribe({
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
      const existing = map.get(nodeId);
      if (existing) {
        existing.score = Math.max(existing.score, item.score);
        existing.chunks.push({ text: item.chunkText, score: item.score });
      } else {
        map.set(nodeId, {
          nodeId,
          name: item.sourceDocument.name,
          path: item.sourceDocument.path,
          score: item.score,
          chunks: [{ text: item.chunkText, score: item.score }]
        });
      }
    }
    return Array.from(map.values());
  }
}
