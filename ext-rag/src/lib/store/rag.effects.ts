import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';

import { RAG_OPEN_CHAT, RAG_ASK_ABOUT } from './rag.actions';

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
            void this.router.navigate(['/rag'], {
              queryParams: { nodeId: node.id, name: node.name }
            });
          }
        })
      ),
    { dispatch: false }
  );
}
