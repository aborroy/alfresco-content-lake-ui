import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RagApiService } from '../../services/rag-api.service';
import { StatusResponse } from '../../models/rag.models';

/**
 * Operational status dashboard (#12): renders the rag-service `/api/status`
 * snapshot - hxpr connectivity, indexed document counts (total and per source),
 * and embedding-model reachability.
 */
@Component({
  selector: 'ext-rag-status',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './rag-status.component.html',
  styleUrls: ['./rag-status.component.css']
})
export class RagStatusComponent implements OnInit {

  private ragApi = inject(RagApiService);

  status: StatusResponse | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    this.ragApi.getStatus().subscribe({
      next: (status) => {
        this.status = status;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'Failed to load status';
        this.loading = false;
      }
    });
  }

  get sourceEntries(): { key: string; count: number }[] {
    if (!this.status?.sourceCounts) {
      return [];
    }
    return Object.entries(this.status.sourceCounts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }

  isUp(value?: string): boolean {
    return (value ?? '').toUpperCase() === 'UP';
  }
}
