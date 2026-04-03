import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '@alfresco/adf-core';
import { findEcmTicket } from '../utils/ecm-ticket.util';

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
  private readonly contentLakeMatchers: string[];

  constructor(private appConfig: AppConfigService) {
    const configuredRagBaseUrl = this.appConfig.get<string>('plugins.ragService.baseUrl', '/api/rag');
    const configuredContentLakeBaseUrl = this.appConfig.get<string>('plugins.contentLakeService.baseUrl', '/api/content-lake');

    this.ragMatchers = this.buildMatchers('/api/rag', configuredRagBaseUrl);
    this.contentLakeMatchers = this.buildMatchers('/api/content-lake', configuredContentLakeBaseUrl);
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;

    const isRagCall = this.matchesAny(url, this.ragMatchers);
    const isContentLakeCall = this.matchesAny(url, this.contentLakeMatchers);
    if (!isRagCall && !isContentLakeCall) return next.handle(req);

    const ticket = findEcmTicket();

    if (!ticket) return next.handle(req);

    const encodedCredentials = isContentLakeCall ? btoa(ticket) : btoa(ticket + ':');

    return next.handle(req.clone({
      setHeaders: { Authorization: `Basic ${encodedCredentials}` }
    }));
  }

  private buildMatchers(defaultBaseUrl: string, configuredBaseUrl: string): string[] {
    const matchers = new Set<string>([defaultBaseUrl]);

    try {
      const url = new URL(configuredBaseUrl, window.location.origin);
      if (url.pathname && url.pathname !== '/') {
        matchers.add(url.pathname.replace(/\/+$/, ''));
      }
      matchers.add(configuredBaseUrl.replace(/\/+$/, ''));
    } catch {
      matchers.add(configuredBaseUrl.replace(/\/+$/, ''));
    }

    return [...matchers];
  }

  private matchesAny(url: string, matchers: string[]): boolean {
    return matchers.some((matcher) => url.includes(matcher) || url.includes('/' + matcher));
  }
}
