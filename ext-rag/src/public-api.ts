/* Public API surface of ext-rag */

export { ExtRagModule, provideRagExtension } from './ext-rag.module';

/* Re-export components for consumers that need direct references */
export { RagPageComponent } from './lib/components/rag-page/rag-page.component';
export { RagSearchComponent } from './lib/components/rag-search/rag-search.component';
export { RagChatComponent } from './lib/components/rag-chat/rag-chat.component';
export { RagSidebarComponent } from './lib/components/rag-sidebar/rag-sidebar.component';
export { ContentLakeSidebarComponent } from './lib/components/content-lake-sidebar/content-lake-sidebar.component';
export { ContentLakeStatusBadgeComponent } from './lib/components/content-lake-status-badge/content-lake-status-badge.component';

/* Re-export service for advanced integrations */
export { RagApiService } from './lib/services/rag-api.service';
export { RagAuthInterceptor } from './lib/services/rag-auth.interceptor';
export { ContentLakeScopeService } from './lib/services/content-lake-scope.service';
export { ContentLakeStatusBatchService } from './lib/services/content-lake-status-batch.service';

/* Re-export models */
export * from './lib/models/rag.models';
