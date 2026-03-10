import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '@alfresco/adf-core';
import { of } from 'rxjs';

import { ContentLakeStatusBatchService } from './content-lake-status-batch.service';
import { ContentLakeNodeStatus } from '../models/rag.models';

describe('ContentLakeStatusBatchService', () => {
  let service: ContentLakeStatusBatchService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    const appConfigSpy = jasmine.createSpyObj<AppConfigService>('AppConfigService', ['get']);
    appConfigSpy.get.and.callFake((key: string, defaultValue: any) => {
      const config: Record<string, string> = {
        'plugins.contentLakeService.baseUrl': '/api/content-lake'
      };
      return config[key] ?? defaultValue;
    });

    TestBed.configureTestingModule({
      providers: [
        ContentLakeStatusBatchService,
        { provide: HttpClient, useValue: httpSpy },
        { provide: AppConfigService, useValue: appConfigSpy }
      ]
    });

    service = TestBed.inject(ContentLakeStatusBatchService);
  });

  it('getNodeStatus_sendsIncludeFolderAggregateFlag', fakeAsync(() => {
    const folderStatus: ContentLakeNodeStatus = {
      nodeId: 'folder-1',
      status: 'INDEXED',
      exists: true,
      folder: true,
      inScope: true,
      excluded: false,
      error: null,
      folderSummary: {
        totalDocuments: 3,
        indexedDocuments: 3,
        pendingDocuments: 0,
        failedDocuments: 0
      }
    };
    httpSpy.post.and.returnValue(of({ 'folder-1': folderStatus }));

    let observed: ContentLakeNodeStatus | null = null;
    service.getNodeStatus('folder-1').subscribe((status) => {
      observed = status;
    });

    flushMicrotasks();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/content-lake/nodes/status', {
      nodeIds: ['folder-1'],
      includeFolderAggregate: true
    });
    expect(observed).toEqual(folderStatus);
  }));
});
