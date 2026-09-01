import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { ReplaySubject, of } from 'rxjs';

import { RagEffects } from './rag.effects';
import { ContentLakeScopeService } from '../services/content-lake-scope.service';
import {
  CONTENT_LAKE_DISABLE_FOLDER_SCOPE,
  CONTENT_LAKE_ENABLE_FOLDER_SCOPE,
  RAG_ASK_ABOUT
} from './rag.actions';

describe('RagEffects', () => {
  let actions$: ReplaySubject<any>;
  let effects: RagEffects;
  let router: jasmine.SpyObj<Router>;
  let scope: jasmine.SpyObj<ContentLakeScopeService>;

  beforeEach(() => {
    actions$ = new ReplaySubject<any>(1);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    scope = jasmine.createSpyObj<ContentLakeScopeService>('ContentLakeScopeService', ['setFolderIndexed']);

    TestBed.configureTestingModule({
      providers: [
        RagEffects,
        provideMockActions(() => actions$),
        { provide: Router, useValue: router },
        { provide: ContentLakeScopeService, useValue: scope }
      ]
    });
    effects = TestBed.inject(RagEffects);
  });

  it('askAbout$ navigates to /rag with node query params and resolved path', () => {
    effects.askAbout$.subscribe();
    actions$.next({
      type: RAG_ASK_ABOUT,
      payload: { id: 'n1', name: 'Doc', isFolder: false, path: { elements: [{ name: 'Home' }] } }
    });

    expect(router.navigate).toHaveBeenCalledWith(['/rag'], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({
        nodeId: 'n1',
        name: 'Doc',
        nodeType: 'file',
        path: '/Home/Doc'
      })
    }));
  });

  it('askAbout$ ignores payloads without an id', () => {
    effects.askAbout$.subscribe();
    actions$.next({ type: RAG_ASK_ABOUT, payload: {} });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('enableFolderScope$ enables indexing for the folder', () => {
    scope.setFolderIndexed.and.returnValue(of({} as any));
    effects.enableFolderScope$.subscribe();
    actions$.next({ type: CONTENT_LAKE_ENABLE_FOLDER_SCOPE, payload: { id: 'f1' } });

    expect(scope.setFolderIndexed).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'f1' }), true);
  });

  it('disableFolderScope$ disables indexing for the folder', () => {
    scope.setFolderIndexed.and.returnValue(of({} as any));
    effects.disableFolderScope$.subscribe();
    actions$.next({ type: CONTENT_LAKE_DISABLE_FOLDER_SCOPE, payload: { id: 'f1' } });

    expect(scope.setFolderIndexed).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'f1' }), false);
  });
});
