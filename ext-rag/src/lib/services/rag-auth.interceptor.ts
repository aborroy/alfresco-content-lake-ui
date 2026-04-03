import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '@alfresco/adf-core';

/**
 * HTTP interceptor that attaches the Alfresco authentication
 * credentials to every request matching the RAG base path.
 *
 * Reads the ECM ticket directly from the storage layer where ADF
 * persists it, avoiding reliance on AuthenticationService methods
 * that may filter by URL or return stale tokens.
 *
 * Registered automatically via `provideRagExtension()`.
 */
@Injectable()
export class RagAuthInterceptor implements HttpInterceptor {

  private readonly ragMatchers: string[];

  constructor(private appConfig: AppConfigService) {
    const configured = this.appConfig.get<string>('plugins.ragService.baseUrl', '/api/rag');

    // Always support proxy paths (RAG service + batch-ingester status API)
    const matchers = new Set<string>(['/api/rag', '/api/content-lake']);

    // Also support configured value, whether it is absolute or relative
    try {
      const u = new URL(configured, window.location.origin);
      // Example: configured = http://localhost:9091/api/rag  -> pathname /api/rag
      // Example: configured = http://localhost:9091          -> pathname /
      if (u.pathname && u.pathname !== '/') matchers.add(u.pathname.replace(/\/+$/, ''));
      matchers.add(configured.replace(/\/+$/, ''));
    } catch {
      matchers.add(configured.replace(/\/+$/, ''));
    }

    this.ragMatchers = [...matchers];
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;

    const isRagCall = this.ragMatchers.some(m => url.includes(m) || url.includes('/' + m));
    if (!isRagCall) return next.handle(req);

    const ticket = this.findTicket();

    if (!ticket) return next.handle(req);

    return next.handle(req.clone({
      setHeaders: { Authorization: `Basic ${btoa(ticket + ':')}` }
    }));
  }

  private findTicket(): string | null {
    const ticket = localStorage.getItem('ticket-ECM');
    if (!ticket) return null;
    const n = ticket.trim().replace(/^"+|"+$/g, '');
    return n.startsWith('TICKET_') ? n : null;
  }
}

