import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ContentLakeStatusBadgeComponent } from './content-lake-status-badge.component';
import { ContentLakeStatusBatchService } from '../../services/content-lake-status-batch.service';
import { CONTENT_LAKE_INDEXED_ASPECT } from '../../utils/content-lake-scope.utils';

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

  it('folderInScope_showsScopeIndicator', () => {
    component.data = {
      node: {
        id: 'folder-1', isFolder: true, isFile: false,
        aspectNames: [CONTENT_LAKE_INDEXED_ASPECT]
      } as any
    };
    fixture.detectChanges();

    expect(batchServiceSpy.getNodeStatus).not.toHaveBeenCalled();
    expect(component.statusIcon).toBe('check_circle');
    expect(component.statusClass).toBe('ext-rag-status-badge--in-scope');
    expect(component.statusTooltip).toBe('Content Lake: In scope');
  });

  it('folderOutOfScope_showsNotInScope', () => {
    component.data = {
      node: { id: 'folder-2', isFolder: true, isFile: false, aspectNames: [] } as any
    };
    fixture.detectChanges();

    expect(batchServiceSpy.getNodeStatus).not.toHaveBeenCalled();
    expect(component.statusIcon).toBe('remove_circle_outline');
    expect(component.statusTooltip).toBe('Content Lake: Not in scope');
  });

  it('fileNode_usesServerStatus', () => {
    batchServiceSpy.getNodeStatus.and.returnValue(of({
      nodeId: 'file-1',
      status: 'FAILED',
      exists: true,
      folder: false,
      inScope: true,
      excluded: false,
      error: 'parse error'
    }));

    component.data = {
      node: { id: 'file-1', isFolder: false, isFile: true } as any
    };
    fixture.detectChanges();

    expect(batchServiceSpy.getNodeStatus).toHaveBeenCalledWith('file-1');
    expect(component.statusIcon).toBe('error');
    expect(component.statusTooltip).toBe('Content Lake status: Error (parse error)');
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
});
