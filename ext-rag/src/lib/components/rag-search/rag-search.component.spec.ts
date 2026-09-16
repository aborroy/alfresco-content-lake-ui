import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DiscoveryApiService } from '@alfresco/adf-content-services';
import { of } from 'rxjs';

import { RagSearchComponent } from './rag-search.component';
import { RagApiService } from '../../services/rag-api.service';
import { ContentSourceCatalogService } from '../../services/content-source-catalog.service';
import { SemanticSearchResponse, StatusResponse } from '../../models/rag.models';

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
    ragApiSpy = jasmine.createSpyObj<RagApiService>(
      'RagApiService', ['search', 'facets', 'getNamedQueries', 'getStatus']);
    ragApiSpy.search.and.returnValue(of(searchResponse));
    ragApiSpy.facets.and.returnValue(of({ property: 'cin_sourceId', buckets: [{ value: 'nuxeo:nuxeo-demo', count: 3 }] }));
    ragApiSpy.getNamedQueries.and.returnValue(of([]));
    // The source filter's options come from /api/status (#16).
    ragApiSpy.getStatus.and.returnValue(of({
      hxprStatus: 'UP',
      totalDocuments: 3,
      sourceCounts: { 'nuxeo:nuxeo-demo': 3 },
      embeddingModel: { status: 'UP' }
    } as StatusResponse));
    (ragApiSpy as any).facetProperties = ['cin_sourceId'];

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
    component.sourceKey = 'nuxeo';

    component.runSearch();

    // The status stub reports nuxeo:nuxeo-demo, so the type is scoped by naming that source rather than
    // through the sourceType request field, which filters on an ingest property only some adapters set.
    expect(ragApiSpy.search).toHaveBeenCalledWith('quarterly report', 5, 0.5, {
      sourceType: undefined,
      filter: "cin_sourceId = 'nuxeo:nuxeo-demo'",
      namedQuery: undefined,
      topDocuments: undefined
    });
    expect(component.documents[0].sourceType).toBe('nuxeo');
    expect(component.documents[0].openInSourceUrl).toContain('/nuxeo/ui/#!/browse/');
  });

  it('runSearch_offersEverySourceTheIndexHoldsAndScopesToOneById', () => {
    // #16: with two repositories of one type, the id-level option scopes through the filter, since the
    // request carries no source id.
    ragApiSpy.getStatus.and.returnValue(of({
      hxprStatus: 'UP',
      totalDocuments: 5,
      sourceCounts: { 'cmis:docmgr': 3, 'cmis:archive': 2 },
      embeddingModel: { status: 'UP' }
    } as StatusResponse));
    // The catalogue caches the first status response for the app's lifetime, so a spec that changes the
    // answer has to drop that cache before asking again.
    TestBed.inject(ContentSourceCatalogService).refresh();
    component.ngOnInit();

    expect(component.sourceOptions.map((o) => o.key))
      .toEqual(['alfresco', 'nuxeo', 'cmis', 'cmis:docmgr', 'cmis:archive']);

    component.query = 'quarterly report';
    component.sourceKey = 'cmis:archive';
    component.runSearch();

    expect(ragApiSpy.search).toHaveBeenCalledWith('quarterly report', 5, 0.5, {
      sourceType: undefined,
      filter: "cin_sourceId = 'cmis:archive'",
      namedQuery: undefined,
      topDocuments: undefined
    });
  });

  it('toggleFacet_appliesFilterAndReRunsSearch', () => {
    component.query = 'quarterly report';
    component.runSearch();

    component.toggleFacet('cin_sourceId', 'nuxeo:nuxeo-demo');

    expect(component.isFacetActive('cin_sourceId', 'nuxeo:nuxeo-demo')).toBeTrue();
    expect(ragApiSpy.search).toHaveBeenCalledWith('quarterly report', 5, 0.5, {
      sourceType: undefined,
      filter: "cin_sourceId = 'nuxeo:nuxeo-demo'",
      namedQuery: undefined,
      topDocuments: undefined
    });
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
