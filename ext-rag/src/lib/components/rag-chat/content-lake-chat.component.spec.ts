import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DiscoveryApiService } from '@alfresco/adf-content-services';
import { of } from 'rxjs';

import { RagChatComponent } from './rag-chat.component';
import { RagApiService } from '../../services/rag-api.service';
import { RagChatSessionService } from '../../services/rag-chat-session.service';
import { RagPromptResponse, RagPromptStreamEvent } from '../../models/rag.models';

describe('RagChatComponent', () => {
  let fixture: ComponentFixture<RagChatComponent>;
  let component: RagChatComponent;
  let ragApiSpy: jasmine.SpyObj<RagApiService>;

  const promptResponse: RagPromptResponse = {
    answer: 'answer',
    question: 'question',
    sessionId: 'session-from-backend',
    model: 'model',
    tokenCount: 128,
    searchTimeMs: 5,
    generationTimeMs: 6,
    totalTimeMs: 11,
    sourcesUsed: 0,
    sources: []
  };

  beforeEach(async () => {
    sessionStorage.clear();
    ragApiSpy = jasmine.createSpyObj<RagApiService>('RagApiService', ['prompt', 'streamPrompt']);
    ragApiSpy.prompt.and.returnValue(of(promptResponse));
    ragApiSpy.streamPrompt.and.returnValue(of(
      { type: 'metadata', response: promptResponse } as RagPromptStreamEvent,
      { type: 'done' } as RagPromptStreamEvent
    ));

    await TestBed.configureTestingModule({
      imports: [RagChatComponent],
      providers: [
        RagChatSessionService,
        provideRouter([]),
        {
          provide: RagApiService,
          useValue: ragApiSpy
        },
        {
          provide: DiscoveryApiService,
          useValue: {
            getEcmProductInfo: () => of({ id: 'repo-main' })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RagChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('newConversation_clearsMessages', () => {
    component.messages = [
      { id: 'm1', role: 'user', content: 'Hello', timestamp: new Date() }
    ];
    (component as any).persistMessages();

    component.newConversation();

    expect(component.messages).toEqual([]);
    expect(component.activeSessionId).toBeTruthy();
    expect(component.sessionSummaries.length).toBeGreaterThan(0);
    expect(component.sessionSummaries[0].messageCount).toBe(0);
  });

  it('sessionScope_passesNodeIdToService', () => {
    component.scopedNodeId = 'node-123';
    component.currentQuestion = 'What is this?';

    component.ask();

    expect(ragApiSpy.streamPrompt).toHaveBeenCalledWith(
      'What is this?',
      jasmine.objectContaining({
        nodeId: 'node-123',
        sessionId: jasmine.any(String),
        resetSession: true
      })
    );
  });

  it('folderScope_buildsPathPrefixFilter', () => {
    component.scopedNodeId = 'folder-123';
    component.scopedNodeName = 'Finance';
    component.scopedNodeIsFolder = true;
    component.scopedNodePath = '/Company Home/Sites/finance/documentLibrary';
    component.currentQuestion = 'Summarize this folder';

    component.ask();

    expect(ragApiSpy.streamPrompt).toHaveBeenCalledWith(
      'Summarize this folder',
      jasmine.objectContaining({
        sourceType: 'alfresco',
        filter: "(cin_sourceId = 'alfresco:repo-main') AND (cin_ingestProperties.source_path >= '/Company Home/Sites/finance/documentLibrary' AND cin_ingestProperties.source_path < '/Company Home/Sites/finance/documentLibrary\uFFFF')"
      })
    );
  });

  it('canOpenInRepository_matchesNamespacedCurrentAlfrescoSource', () => {
    expect(component.canOpenInRepository({
      nodeId: 'node-123',
      sourceId: 'alfresco:repo-main',
      sourceType: 'alfresco',
      name: 'Budget.xlsx',
      path: '/Company Home/Sites/finance/documentLibrary',
      score: 0.92,
      chunks: []
    })).toBeTrue();
  });

  it('canOpenInSource_returnsTrueForExternalMixedSourceResults', () => {
    expect(component.canOpenInSource({
      nodeId: 'doc-789',
      sourceId: 'nuxeo:nuxeo-demo',
      sourceType: 'nuxeo',
      name: 'Quarterly Report.pdf',
      path: '/default-domain/workspaces/finance',
      score: 0.88,
      chunks: [],
      openInSourceUrl: 'http://localhost:8081/nuxeo/ui/#!/browse/default-domain/workspaces/finance/Quarterly%20Report.pdf'
    })).toBeTrue();
  });

  it('autoScroll_triggersOnNewMessage', () => {
    const scrollHost = document.createElement('div');
    Object.defineProperty(scrollHost, 'scrollHeight', { value: 500, writable: true });
    Object.defineProperty(scrollHost, 'clientHeight', { value: 100, writable: true });
    scrollHost.scrollTop = 460;
    (component as any).messagesContainer = new ElementRef(scrollHost);

    const scrollSpy = spyOn<any>(component, 'scrollToBottom').and.callThrough();
    component.currentQuestion = 'Trigger scroll';

    component.ask();
    component.ngAfterViewChecked();

    expect(scrollSpy).toHaveBeenCalled();
  });

  it('assistantAnswer_stripsMarkdownSyntaxFromMetadataResponse', () => {
    ragApiSpy.streamPrompt.and.returnValue(of(
      {
        type: 'metadata',
        response: {
          ...promptResponse,
          answer: '## LDAP setup\n**Define** _chain_ and [restart](https://example.com)\n- check properties'
        }
      } as RagPromptStreamEvent,
      { type: 'done' } as RagPromptStreamEvent
    ));

    component.currentQuestion = 'How do I configure LDAP?';
    component.ask();

    const assistant = component.messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('LDAP setup\nDefine chain and restart\n- check properties');
  });

  it('assistantAnswer_stripsMarkdownSyntaxFromStreamingTokens', () => {
    ragApiSpy.streamPrompt.and.returnValue(of(
      { type: 'token', token: '**Define** _chain_' } as RagPromptStreamEvent,
      { type: 'token', token: '\n- check properties' } as RagPromptStreamEvent,
      { type: 'done' } as RagPromptStreamEvent
    ));

    component.currentQuestion = 'How do I configure LDAP?';
    component.ask();

    const assistant = component.messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('Define chain\n- check properties');
  });

  it('assistantAnswer_mapsTokenCountFromMetadata', () => {
    component.currentQuestion = 'How many tokens?';
    component.ask();

    const assistant = component.messages.find((message) => message.role === 'assistant');
    expect(assistant?.tokenCount).toBe(128);
  });

  it('assistantAnswer_preservesSourceAwareLinksInMergedSources', () => {
    ragApiSpy.streamPrompt.and.returnValue(of(
      {
        type: 'metadata',
        response: {
          ...promptResponse,
          sourcesUsed: 1,
          sources: [
            {
              documentId: 'doc-789',
              nodeId: 'doc-789',
              sourceId: 'nuxeo:nuxeo-demo',
              sourceType: 'nuxeo',
              name: 'Quarterly Report.pdf',
              path: '/default-domain/workspaces/finance',
              chunkText: 'Revenue increased by 12%.',
              score: 0.88,
              openInSourceUrl: 'http://localhost:8081/nuxeo/ui/#!/browse/default-domain/workspaces/finance/Quarterly%20Report.pdf'
            }
          ]
        }
      } as RagPromptStreamEvent,
      { type: 'done' } as RagPromptStreamEvent
    ));

    component.currentQuestion = 'What changed in finance?';
    component.ask();

    const assistant = component.messages.find((message) => message.role === 'assistant');
    expect(assistant?.sources?.[0].sourceType).toBe('nuxeo');
    expect(assistant?.sources?.[0].openInSourceUrl).toContain('/nuxeo/ui/#!/browse/');
  });
});
