import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';

import { ContentLakeScopeService } from '../services/content-lake-scope.service';
import { resolveNodePath } from '../utils/node-path.util';
import {
  CONTENT_LAKE_DISABLE_FOLDER_SCOPE,
  CONTENT_LAKE_ENABLE_FOLDER_SCOPE,
  RAG_ASK_ABOUT
} from './rag.actions';

/**
 * Side-effects triggered by the extension descriptor actions.
 *
 * RAG_ASK_ABOUT: navigate to the RAG route with the selected node id
 *   pre-filled so the chat is scoped to that document.
 */
@Injectable()
export class RagEffects {

  private actions$ = inject(Actions);
  private router   = inject(Router);
  private contentLakeScopeService = inject(ContentLakeScopeService);

  askAbout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(RAG_ASK_ABOUT),
        tap((action: any) => {
          const node = action.payload;
          if (node?.id) {
            const path = resolveNodePath(node);
            void this.router.navigate(['/rag'], {
              queryParams: {
                nodeId: node.id,
                name: node.name,
                nodeType: node.isFolder ? 'folder' : 'file',
                ...(path ? { path } : {})
              }
            });
          }
        })
      ),
    { dispatch: false }
  );

  enableFolderScope$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(CONTENT_LAKE_ENABLE_FOLDER_SCOPE),
        switchMap((action: any) => {
          const node = action.payload;
          if (!node?.id) {
            return EMPTY;
          }

          return this.contentLakeScopeService.setFolderIndexed(node, true).pipe(catchError(() => EMPTY));
        })
      ),
    { dispatch: false }
  );

  disableFolderScope$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(CONTENT_LAKE_DISABLE_FOLDER_SCOPE),
        switchMap((action: any) => {
          const node = action.payload;
          if (!node?.id) {
            return EMPTY;
          }

          return this.contentLakeScopeService.setFolderIndexed(node, false).pipe(catchError(() => EMPTY));
        })
      ),
    { dispatch: false }
  );
}
