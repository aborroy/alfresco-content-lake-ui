import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ContentLakeStatusBadgeComponent } from './content-lake-status-badge.component';
import { ContentLakeStatusBatchService } from '../../services/content-lake-status-batch.service';

describe('ContentLakeStatusBadgeComponent', () => {
  let fixture: ComponentFixture<ContentLakeStatusBadgeComponent>;
  let component: ContentLakeStatusBadgeComponent;
  let batchServiceSpy: jasmine.SpyObj<ContentLakeStatusBatchService>;

  beforeEach(async () => {
    batchServiceSpy = jasmine.createSpyObj<ContentLakeStatusBatchService>('ContentLakeStatusBatchService', ['getNodeStatus']);

    await TestBed.configureTestingModule({
      imports: [ContentLakeStatusBadgeComponent],
      providers: [
        { provide: ContentLakeStatusBatchService, useValue: batchServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContentLakeStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('folderNode_rendersAggregatedStatusTooltip', () => {
    batchServiceSpy.getNodeStatus.and.returnValue(of({
      nodeId: 'folder-1',
      status: 'FAILED',
      exists: true,
      folder: true,
      inScope: true,
      excluded: false,
      error: '1 document(s) failed indexing',
      folderSummary: {
        totalDocuments: 10,
        indexedDocuments: 8,
        pendingDocuments: 1,
        failedDocuments: 1
      }
    }));

    component.data = {
      node: { id: 'folder-1', isFolder: true, isFile: false } as any
    };
    fixture.detectChanges();

    expect(batchServiceSpy.getNodeStatus).toHaveBeenCalledWith('folder-1');
    expect(component.statusIcon).toBe('error');
    expect(component.statusTooltip).toContain('10 docs (8 indexed, 1 pending, 1 failed)');
  });

  it('nonFileOrFolder_showsNotApplicable', () => {
    component.data = {
      node: { id: 'node-1', isFolder: false, isFile: false } as any
    };
    fixture.detectChanges();

    expect(batchServiceSpy.getNodeStatus).not.toHaveBeenCalled();
    expect(component.statusIcon).toBe('remove_circle_outline');
    expect(component.statusTooltip).toBe('Content Lake status: Not applicable');
  });

  it('folderNode_withoutAggregateStatus_showsNotAvailable', () => {
    batchServiceSpy.getNodeStatus.and.returnValue(of({
      nodeId: 'folder-legacy',
      status: null,
      exists: true,
      folder: true,
      inScope: true,
      excluded: false,
      error: null
    }));

    component.data = {
      node: { id: 'folder-legacy', isFolder: true, isFile: false } as any
    };
    fixture.detectChanges();

    expect(component.statusIcon).toBe('help_outline');
    expect(component.statusTooltip).toBe('Content Lake status: Not available');
  });
});
