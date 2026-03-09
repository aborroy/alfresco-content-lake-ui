import { APP_INITIALIZER, EnvironmentProviders, NgModule, Provider } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ExtensionService, provideExtensionConfig } from '@alfresco/adf-extensions';
import { provideEffects } from '@ngrx/effects';
import { Node, NodeEntry } from '@alfresco/js-api';

import { RagEffects } from './lib/store/rag.effects';
import { RagPageComponent } from './lib/components/rag-page/rag-page.component';
import { RagSidebarComponent } from './lib/components/rag-sidebar/rag-sidebar.component';
import { ContentLakeSidebarComponent } from './lib/components/content-lake-sidebar/content-lake-sidebar.component';
import { RagAuthInterceptor } from './lib/services/rag-auth.interceptor';
import {
  asNode,
  canManageExcludeOverride,
  canManageFolderExclude,
  hasIndexedAspect,
  isContentLakeEnabled,
  isExcludedFromLake
} from './lib/utils/content-lake-scope.utils';

function getRuleNode(candidate?: NodeEntry | Node): Node | null {
  return asNode(candidate);
}

/**
 * Registers ext-rag dynamic components with the ADF extension service.
 *
 * This factory runs during APP_INITIALIZER so it works regardless of
 * whether consumers import the NgModule or just spread the providers.
 */
export function registerRagComponents(extensions: ExtensionService): () => void {
  return () => {
    extensions.setComponents({
      'ext-rag.page': RagPageComponent,
      'ext-rag.sidebar': RagSidebarComponent,
      'ext-rag.content-lake-sidebar': ContentLakeSidebarComponent
    });

    extensions.setEvaluators({
      'ext-rag.selection.folder.indexed': (context: any) => hasIndexedAspect(context.selection?.folder),
      'ext-rag.node.in-content-lake': (_context: any, node: NodeEntry | Node) => isContentLakeEnabled(getRuleNode(node)),
      'ext-rag.node.excluded-from-content-lake': (_context: any, node: NodeEntry | Node) => isExcludedFromLake(getRuleNode(node)),
      'ext-rag.node.document-override-available': (_context: any, node: NodeEntry | Node) => canManageExcludeOverride(getRuleNode(node)),
      'ext-rag.node.folder-exclude-available': (_context: any, node: NodeEntry | Node) => canManageFolderExclude(getRuleNode(node))
    });
  };
}

/**
 * Provides all extension registrations needed by ACA or ADW.
 *
 * Usage in `extensions.module.ts`:
 *
 *   import { provideRagExtension } from 'projects/ext-rag/src/public-api';
 *
 *   export function provideApplicationExtensions() {
 *     return [
 *       ...provideRagExtension(),
 *       // other extensions…
 *     ];
 *   }
 */
export function provideRagExtension(): (Provider | EnvironmentProviders)[] {
  return [
    provideExtensionConfig(['ext-rag.plugin.json']),
    provideEffects(RagEffects),
    {
      provide: APP_INITIALIZER,
      useFactory: registerRagComponents,
      deps: [ExtensionService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: RagAuthInterceptor,
      multi: true
    }
  ];
}

/**
 * @deprecated Use `provideRagExtension()` provider function instead.
 */
@NgModule({
  providers: [...provideRagExtension()]
})
export class ExtRagModule {}
