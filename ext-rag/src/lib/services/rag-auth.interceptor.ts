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

    // Always support proxy path
    const matchers = new Set<string>(['/api/rag']);

    // Also support configured value, whether it is absolute or relative
    try {
      const u = new URL(configured, window.location.origin);
      // Example: configured = http://localhost:9091/api/rag  -> pathname /api/rag
      // Example: configured = http://localhost:9091          -> pathname /
      if (u.pathname && u.pathname !== '/') matchers.add(u.pathname.replace(/\/+$/, ''));
      matchers.add(u.origin); // optional: match absolute origin too
      matchers.add(configured.replace(/\/+$/, ''));
    } catch {
      matchers.add(configured.replace(/\/+$/, ''));
    }

    this.ragMatchers = [...matchers];
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;

    const isRagCall = this.ragMatchers.some(m => url.includes(m));
    if (!isRagCall) return next.handle(req);

    const ticket = this.findTicket();
    console.log('[ext-rag] Intercepting:', url, '| ticket:', ticket ? ticket.substring(0, 20) + '…' : '(none)');

    if (!ticket) return next.handle(req);

    return next.handle(req.clone({
      setHeaders: { Authorization: `Basic ${btoa(ticket)}` }
    }));
  }

  private findTicket(): string | null {
    const candidates = ['ticket-ECM', 'ticket_ECM', 'auth_ticket'];

    const normalize = (v: string) => v.trim().replace(/^"+|"+$/g, '');

    const readFrom = (s: Storage) => {
      for (const k of candidates) {
        const v = s.getItem(k);
        if (v) {
          const n = normalize(v);
          if (n.startsWith('TICKET_')) return n;
        }
      }
      // Scan keys (case changes happen)
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (!k) continue;
        const v = s.getItem(k);
        if (!v) continue;
        const n = normalize(v);
        if (n.startsWith('TICKET_')) return n;
      }
      return null;
    };

    // ADF can be configured to use either localStorage or sessionStorage
    return readFrom(localStorage) ?? readFrom(sessionStorage) ?? null;
  }
}

