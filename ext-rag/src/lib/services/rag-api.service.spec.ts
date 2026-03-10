import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '@alfresco/adf-core';

import { RagApiService } from './rag-api.service';
import { RagPromptStreamEvent } from '../models/rag.models';

describe('RagApiService', () => {
  let service: RagApiService;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = (globalThis as any).fetch;

    const appConfigSpy = jasmine.createSpyObj<AppConfigService>('AppConfigService', ['get']);
    appConfigSpy.get.and.callFake((key: string, defaultValue: any) => {
      const config: Record<string, string> = {
        'plugins.ragService.baseUrl': '/api/rag',
        'plugins.ragService.searchPath': '/search/semantic',
        'plugins.ragService.promptPath': '/prompt',
        'plugins.ragService.streamPath': '/chat/stream'
      };
      return config[key] ?? defaultValue;
    });

    TestBed.configureTestingModule({
      providers: [
        RagApiService,
        {
          provide: HttpClient,
          useValue: jasmine.createSpyObj<HttpClient>('HttpClient', ['post'])
        },
        {
          provide: AppConfigService,
          useValue: appConfigSpy
        }
      ]
    });

    service = TestBed.inject(RagApiService);
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('streamPrompt_emitsTokensInOrder', (done) => {
    (globalThis as any).fetch = jasmine.createSpy('fetch').and.returnValue(Promise.resolve(
      createMockResponse([
        'event: token\ndata: {"token":"Hel"}\n\n',
        'event: token\ndata: {"token":"lo"}\n\n',
        'event: metadata\ndata: {"answer":"Hello","question":"Q","model":"m","tokenCount":42,"searchTimeMs":1,"generationTimeMs":2,"totalTimeMs":3,"sourcesUsed":0,"sources":[]}\n\n',
        'event: done\ndata: {}\n\n'
      ])
    ));

    const events: RagPromptStreamEvent[] = [];
    service.streamPrompt('Q').subscribe({
      next: (event) => events.push(event),
      error: (error) => done.fail(error),
      complete: () => {
        expect(events.length).toBe(4);
        expect(events[0]).toEqual({ type: 'token', token: 'Hel' });
        expect(events[1]).toEqual({ type: 'token', token: 'lo' });
        expect(events[2].type).toBe('metadata');
        if (events[2].type === 'metadata') {
          expect(events[2].response.answer).toBe('Hello');
          expect(events[2].response.tokenCount).toBe(42);
        }
        expect(events[3]).toEqual({ type: 'done' });

        expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
        expect((globalThis as any).fetch).toHaveBeenCalledWith(
          '/api/rag/chat/stream',
          jasmine.objectContaining({ method: 'POST' })
        );
        done();
      }
    });
  });

  it('streamPrompt_handlesErrorEvent', (done) => {
    (globalThis as any).fetch = jasmine.createSpy('fetch').and.returnValue(Promise.resolve(
      createMockResponse([
        'event: error\ndata: {"message":"stream exploded"}\n\n'
      ])
    ));

    service.streamPrompt('Q').subscribe({
      next: () => done.fail('Expected stream to fail'),
      error: (error) => {
        expect(String(error?.message ?? '')).toContain('stream exploded');
        done();
      },
      complete: () => done.fail('Expected error, got complete')
    });
  });

  it('streamPrompt_parsesCrLfDelimitedEvents', (done) => {
    (globalThis as any).fetch = jasmine.createSpy('fetch').and.returnValue(Promise.resolve(
      createMockResponse([
        'event: token\r\ndata: {"token":"Hi"}\r\n\r\n',
        'event: done\r\ndata: {}\r\n\r\n'
      ])
    ));

    const events: RagPromptStreamEvent[] = [];
    service.streamPrompt('Q').subscribe({
      next: (event) => events.push(event),
      error: (error) => done.fail(error),
      complete: () => {
        expect(events).toEqual([
          { type: 'token', token: 'Hi' },
          { type: 'done' }
        ]);
        done();
      }
    });
  });
});

function createMockResponse(events: string[]): Response {
  let index = 0;
  const encoder = new TextEncoder();

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: () => {
          if (index >= events.length) {
            return Promise.resolve({ done: true, value: undefined });
          }
          const value = encoder.encode(events[index++]);
          return Promise.resolve({ done: false, value });
        }
      })
    }
  } as unknown as Response;
}
