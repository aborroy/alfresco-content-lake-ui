import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';

import { ContentLakeScopeService } from '../services/content-lake-scope.service';
import {
  CONTENT_LAKE_DISABLE_FOLDER_SCOPE,
  CONTENT_LAKE_ENABLE_FOLDER_SCOPE,
  RAG_OPEN_CHAT,
  RAG_ASK_ABOUT
} from './rag.actions';

/**
 * Side-effects triggered by the extension descriptor actions.
 *
 * RAG_OPEN_CHAT  → navigate to the full-page RAG route.
 * RAG_ASK_ABOUT  → navigate to the RAG route with the selected node id
 *                   pre-filled so the chat is scoped to that document.
 */
@Injectable()
export class RagEffects {

  private actions$ = inject(Actions);
  private router   = inject(Router);
  private contentLakeScopeService = inject(ContentLakeScopeService);

  openChat$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(RAG_OPEN_CHAT),
        tap(() => {
          void this.router.navigate(['/rag']);
        })
      ),
    { dispatch: false }
  );

  askAbout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(RAG_ASK_ABOUT),
        tap((action: any) => {
          const node = action.payload;
          if (node?.id) {
            const path = this.resolveNodePath(node);
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

  private resolveNodePath(node: any): string | null {
    const elements = Array.isArray(node?.path?.elements) ? node.path.elements : [];
    const segments: string[] = [];

    for (const element of elements) {
      const name = element?.name;
      if (typeof name === 'string' && name.trim()) {
        segments.push(name.trim());
      }
    }

    if (typeof node?.name === 'string' && node.name.trim()) {
      segments.push(node.name.trim());
    }

    if (segments.length === 0) {
      return null;
    }

    return `/${segments.join('/')}`;
  }
}
