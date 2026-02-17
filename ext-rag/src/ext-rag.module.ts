import { APP_INITIALIZER, NgModule, Provider, EnvironmentProviders } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideExtensionConfig, ExtensionService } from '@alfresco/adf-extensions';
import { provideEffects } from '@ngrx/effects';

import { RagEffects } from './lib/store/rag.effects';
import { RagPageComponent } from './lib/components/rag-page/rag-page.component';
import { RagSidebarComponent } from './lib/components/rag-sidebar/rag-sidebar.component';
import { RagAuthInterceptor } from './lib/services/rag-auth.interceptor';

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
      'ext-rag.sidebar': RagSidebarComponent
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
