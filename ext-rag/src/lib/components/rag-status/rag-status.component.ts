import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RagApiService } from '../../services/rag-api.service';
import { ConnectorListing, StatusResponse } from '../../models/rag.models';
import { sourceTypeLabel, splitSourceKey } from '../../utils/source-label.util';

/** One row of the per-source table. */
interface SourceRow {
  key: string;
  sourceType: string;
  sourceId: string;
  label: string;
  count: number;
}

/**
 * Operational status dashboard (#12): renders the rag-service `/api/status`
 * snapshot - hxpr connectivity, indexed document counts (total and per source),
 * and embedding-model reachability, plus the connectors an ingester has loaded (#17).
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

  connectors: ConnectorListing | null = null;
  connectorsLoading = false;
  connectorsError: string | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  get connectorsConfigured(): boolean {
    return this.ragApi.connectorsConfigured;
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
    this.refreshConnectors();
  }

  /** One row per source, labelled rather than showing the raw `<sourceType>:<sourceId>` key. */
  get sourceEntries(): SourceRow[] {
    if (!this.status?.sourceCounts) {
      return [];
    }
    return Object.entries(this.status.sourceCounts)
      .map(([key, count]) => {
        const { sourceType, sourceId } = splitSourceKey(key);
        return { key, sourceType, sourceId, label: sourceTypeLabel(sourceType), count };
      })
      .sort((a, b) => b.count - a.count);
  }

  isUp(value?: string): boolean {
    return (value ?? '').toUpperCase() === 'UP';
  }

  /**
   * Reads the connector listing when one is configured. A failure is reported on this panel alone: the
   * URL points at a service the rest of the page does not depend on, so it must not fail the page.
   */
  private refreshConnectors(): void {
    const request = this.ragApi.getConnectors();
    if (!request) {
      this.connectors = null;
      return;
    }
    this.connectorsLoading = true;
    this.connectorsError = null;
    request.subscribe({
      next: (listing) => {
        this.connectors = {
          connectors: listing?.connectors ?? [],
          problems: listing?.problems ?? []
        };
        this.connectorsLoading = false;
      },
      error: (err) => {
        this.connectorsError = err?.status === 0
          ? 'Cannot reach the configured connectors URL.'
          : err?.error?.message || err?.message || 'Failed to load connectors';
        this.connectorsLoading = false;
      }
    });
  }
}
