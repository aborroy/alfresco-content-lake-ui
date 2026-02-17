# ext-rag — ADF Extension for RAG

ADF extension module that adds **semantic search** and **RAG question-answering** to Alfresco Content Application (ACA) and Alfresco Digital Workspace (ADW).

This module is part of [alfresco-content-lake-ui](https://github.com/aborroy/alfresco-content-lake-ui) and implements [alfresco-content-lake#7](https://github.com/aborroy/alfresco-content-lake/issues/7).

## Installation

Copy this folder into your ACA clone:

```bash
cp -r ext-rag /path/to/alfresco-content-app/projects/ext-rag
```

Then register the extension in `app/src/app/extensions.module.ts`:

```typescript
import { provideRagExtension } from 'projects/ext-rag/src/public-api';

export function provideApplicationExtensions(): (Provider | EnvironmentProviders)[] {
  return [
    ...provideRagExtension(),
  ];
}
```

See the [parent README](../README.md) for full integration steps including asset configuration and dev proxy setup.

## Structure

```
ext-rag/
├── tsconfig.lib.json
├── tsconfig.lib.prod.json
├── README.md
└── src/
    ├── assets/
    │   └── ext-rag.plugin.json       # Extension descriptor (routes, menus, sidebar)
    ├── lib/
    │   ├── components/
    │   │   ├── rag-chat/             # Chat-style Q&A component
    │   │   ├── rag-page/             # Full-page wrapper (tabs: Ask + Search)
    │   │   ├── rag-search/           # Semantic search component
    │   │   └── rag-sidebar/          # Sidebar wrapper (compact chat)
    │   ├── models/
    │   │   └── rag.models.ts         # TypeScript interfaces (API + view models)
    │   ├── services/
    │   │   ├── rag-api.service.ts    # HTTP client for rag-service
    │   │   └── rag-auth.interceptor.ts
    │   └── store/
    │       ├── rag.actions.ts        # NgRx action types
    │       └── rag.effects.ts        # NgRx effects (navigation)
    ├── ext-rag.module.ts             # Root NgModule + provider function
    └── public-api.ts                # Barrel exports
```

## License

Apache License 2.0
