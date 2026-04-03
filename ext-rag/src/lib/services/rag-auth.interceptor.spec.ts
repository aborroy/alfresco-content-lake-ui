import { HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { AppConfigService } from '@alfresco/adf-core';

import { RagAuthInterceptor } from './rag-auth.interceptor';

describe('RagAuthInterceptor', () => {
  let interceptor: RagAuthInterceptor;
  let appConfigMock: jasmine.SpyObj<AppConfigService>;

  beforeEach(() => {
    appConfigMock = jasmine.createSpyObj<AppConfigService>('AppConfigService', ['get']);
    appConfigMock.get.and.callFake((key: string, defaultValue: any) => {
      const config: Record<string, string> = {
        'plugins.ragService.baseUrl': '/api/rag'
      };
      return config[key] ?? defaultValue;
    });

    interceptor = new RagAuthInterceptor(appConfigMock);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function createHandlerWithSpy(): HttpHandler {
    return {
      handle: jasmine.createSpy('handle').and.callFake(() => of({} as HttpEvent<any>))
    };
  }

  it('attachesBasicTicketHeaderForRagRequests', (done) => {
    localStorage.setItem('ticket-ECM', '"TICKET_ALFRESCO"');

    const req = new HttpRequest('GET', '/api/rag/search/semantic');
    const handler = createHandlerWithSpy();

    interceptor.intercept(req, handler).subscribe(() => {
      const handledReq = (handler.handle as jasmine.Spy).calls.mostRecent().args[0] as HttpRequest<any>;
      expect(handledReq.headers.get('Authorization')).toBe(`Basic ${btoa('TICKET_ALFRESCO:')}`);
      done();
    });
  });

  it('readsTicketFromSessionStorageForContentLakeRequests', (done) => {
    sessionStorage.setItem('ticket_ECM', 'TICKET_SESSION');

    const req = new HttpRequest('GET', '/api/content-lake/nodes/status');
    const handler = createHandlerWithSpy();

    interceptor.intercept(req, handler).subscribe(() => {
      const handledReq = (handler.handle as jasmine.Spy).calls.mostRecent().args[0] as HttpRequest<any>;
      expect(handledReq.headers.get('Authorization')).toBe(`Basic ${btoa('TICKET_SESSION:')}`);
      done();
    });
  });

  it('doesNotAttachHeaderWhenTicketIsMissing', (done) => {
    const req = new HttpRequest('GET', '/api/rag/search/semantic');
    const handler = createHandlerWithSpy();

    interceptor.intercept(req, handler).subscribe(() => {
      const handledReq = (handler.handle as jasmine.Spy).calls.mostRecent().args[0] as HttpRequest<any>;
      expect(handledReq.headers.has('Authorization')).toBeFalse();
      done();
    });
  });
});
