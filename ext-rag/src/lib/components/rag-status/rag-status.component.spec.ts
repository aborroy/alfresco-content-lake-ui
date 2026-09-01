import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { RagStatusComponent } from './rag-status.component';
import { RagApiService } from '../../services/rag-api.service';
import { StatusResponse } from '../../models/rag.models';

describe('RagStatusComponent', () => {
  let component: RagStatusComponent;
  let ragApiSpy: jasmine.SpyObj<RagApiService>;

  const status: StatusResponse = {
    hxprStatus: 'UP',
    totalDocuments: 42,
    sourceCounts: { 'alfresco:acs': 30, 'nuxeo:demo': 12 },
    embeddingModel: { status: 'UP', url: 'http://model:12434' }
  };

  beforeEach(async () => {
    ragApiSpy = jasmine.createSpyObj<RagApiService>('RagApiService', ['getStatus']);
    await TestBed.configureTestingModule({
      imports: [RagStatusComponent],
      providers: [{ provide: RagApiService, useValue: ragApiSpy }]
    }).compileComponents();
    component = TestBed.createComponent(RagStatusComponent).componentInstance;
  });

  it('loads the status snapshot on init and sorts sources by count', () => {
    ragApiSpy.getStatus.and.returnValue(of(status));
    component.ngOnInit();

    expect(ragApiSpy.getStatus).toHaveBeenCalled();
    expect(component.status?.totalDocuments).toBe(42);
    expect(component.loading).toBeFalse();
    expect(component.sourceEntries.map((e) => e.key)).toEqual(['alfresco:acs', 'nuxeo:demo']);
    expect(component.isUp('UP')).toBeTrue();
    expect(component.isUp('DOWN')).toBeFalse();
  });

  it('surfaces an error message when the status call fails', () => {
    ragApiSpy.getStatus.and.returnValue(throwError(() => ({ message: 'boom' })));
    component.refresh();

    expect(component.error).toBe('boom');
    expect(component.loading).toBeFalse();
    expect(component.status).toBeNull();
  });
});
