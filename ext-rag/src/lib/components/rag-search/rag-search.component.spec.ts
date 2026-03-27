import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DiscoveryApiService } from '@alfresco/adf-content-services';
import { of } from 'rxjs';

import { RagSearchComponent } from './rag-search.component';
import { RagApiService } from '../../services/rag-api.service';
import { SemanticSearchResponse } from '../../models/rag.models';

describe('RagSearchComponent', () => {
  let fixture: ComponentFixture<RagSearchComponent>;
  let component: RagSearchComponent;
  let ragApiSpy: jasmine.SpyObj<RagApiService>;

  const searchResponse: SemanticSearchResponse = {
    query: 'quarterly report',
    model: 'text-embedding-3-large',
    vectorDimension: 3072,
    resultCount: 1,
    totalCount: 1,
    searchTimeMs: 24,
    results: [
      {
        rank: 1,
        score: 0.91,
        chunkText: 'Revenue increased by 12%.',
        sourceDocument: {
          documentId: 'doc-789',
          nodeId: 'doc-789',
          sourceId: 'nuxeo:nuxeo-demo',
          sourceType: 'nuxeo',
          name: 'Quarterly Report.pdf',
          path: '/default-domain/workspaces/finance',
          mimeType: 'application/pdf',
          openInSourceUrl: 'http://localhost:8081/nuxeo/ui/#!/browse/default-domain/workspaces/finance/Quarterly%20Report.pdf'
        },
        chunkMetadata: {
          embeddingId: 'embed-1',
          embeddingType: 'text',
          page: 1,
          paragraph: 2,
          chunkLength: 128
        }
      }
    ]
  };

  beforeEach(async () => {
    ragApiSpy = jasmine.createSpyObj<RagApiService>('RagApiService', ['search']);
    ragApiSpy.search.and.returnValue(of(searchResponse));

    await TestBed.configureTestingModule({
      imports: [RagSearchComponent],
      providers: [
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

    fixture = TestBed.createComponent(RagSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('runSearch_preservesSourceAwareMetadata', () => {
    component.query = 'quarterly report';
    component.selectedSourceType = 'nuxeo';

    component.runSearch();

    expect(ragApiSpy.search).toHaveBeenCalledWith('quarterly report', 5, 0.5, 'nuxeo');
    expect(component.documents[0].sourceType).toBe('nuxeo');
    expect(component.documents[0].openInSourceUrl).toContain('/nuxeo/ui/#!/browse/');
  });

  it('canOpenInRepository_matchesNamespacedCurrentAlfrescoSource', () => {
    expect(component.canOpenInRepository({
      nodeId: 'node-123',
      sourceId: 'alfresco:repo-main',
      sourceType: 'alfresco',
      name: 'Budget.xlsx',
      path: '/Company Home/Sites/finance/documentLibrary',
      score: 0.94,
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
      score: 0.91,
      chunks: [],
      openInSourceUrl: 'http://localhost:8081/nuxeo/ui/#!/browse/default-domain/workspaces/finance/Quarterly%20Report.pdf'
    })).toBeTrue();
  });
});
