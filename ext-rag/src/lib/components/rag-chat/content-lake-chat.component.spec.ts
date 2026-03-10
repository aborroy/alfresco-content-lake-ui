import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DiscoveryApiService } from '@alfresco/adf-content-services';
import { of } from 'rxjs';

import { RagChatComponent } from './rag-chat.component';
import { RagApiService } from '../../services/rag-api.service';
import { RagChatSessionService } from '../../services/rag-chat-session.service';
import { RagPromptResponse } from '../../models/rag.models';

describe('RagChatComponent', () => {
  let fixture: ComponentFixture<RagChatComponent>;
  let component: RagChatComponent;
  let ragApiSpy: jasmine.SpyObj<RagApiService>;

  const promptResponse: RagPromptResponse = {
    answer: 'answer',
    question: 'question',
    sessionId: 'session-from-backend',
    model: 'model',
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
      { type: 'metadata', response: promptResponse },
      { type: 'done' }
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
        nodeId: 'folder-123',
        filter: "cin_ingestProperties.alfresco_path LIKE '/Company Home/Sites/finance/documentLibrary%'"
      })
    );
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
});
