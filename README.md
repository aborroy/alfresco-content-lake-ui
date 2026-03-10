# Alfresco Content Lake UI

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![ADF](https://img.shields.io/badge/Alfresco%20ADF-8.4.0--21916318527-7C4DFF.svg)](https://github.com/Alfresco/alfresco-ng2-components)
[![Angular](https://img.shields.io/badge/Angular-19.2.18-DD0031.svg)](https://angular.dev/)
[![Nx](https://img.shields.io/badge/Nx-21.5.2-143055.svg)](https://nx.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://docs.docker.com/compose/)
[![Status](https://img.shields.io/badge/Status-PoC-yellow.svg)]()


UI extension for [alfresco-content-lake](https://github.com/aborroy/alfresco-content-lake) that adds **semantic search** and **RAG question-answering** to Alfresco Content Application (ACA) and Alfresco Digital Workspace (ADW).

## Features

* Semantic search panel: free-text query with configurable `topK` / `minScore`, results grouped by document with similarity scores and expandable chunk snippets
* Chat-style Q&A: natural language questions answered via RAG, displaying the generated answer, model used, timing breakdown, and referenced source documents with chunks
* Document-scoped mode: right-click any document and choose *"Ask AI about this document"* to open the chat pre-scoped to that file
* Folder-scoped mode: right-click any folder and choose *"Ask AI about this folder"* to scope retrieval to that folder subtree
* Sidebar tab: compact chat panel in the info-drawer, automatically scoped to the selected document or folder.
* Conversation sessions: local session list with restore and *New conversation* support across route changes
* Content Lake scope controls: right-click a folder to add or remove the `cl:indexed` aspect, or use the dedicated *Content Lake* sidebar tab
* Document override: set `cl:excludeFromLake` on a document from the *Content Lake* sidebar to opt it out of an indexed folder subtree
* Visual scope indicators: badges show when a folder or document is in Content Lake scope, and when a document is explicitly excluded
* Document preview: result links open the ACA document viewer; closing the preview returns to the RAG Assistant page
* Zero custom auth code: authentication is forwarded transparently via the ADF HTTP interceptor and a shared gateway

## Prerequisites

* A running [alfresco-content-lake](https://github.com/aborroy/alfresco-content-lake) deployment with `rag-service` available
* The `content-lake-repo-model` module deployed in Alfresco Repository so `cl:indexed` and `cl:excludeFromLake` exist
* ACA (Alfresco Content App) source checkout, or ADW (Alfresco Digital Workspace) source
* Node.js 18+

## Install into ACA

### 1. Copy the extension

```bash
# From the root of your alfresco-content-app clone:
cp -r /path/to/alfresco-content-lake-ui/ext-rag projects/ext-rag
```

### 2. Register the module

Edit `app/src/app/extensions.module.ts`:

```typescript
import { provideRagExtension } from 'projects/ext-rag/src/public-api';

export function provideApplicationExtensions(): (Provider | EnvironmentProviders)[] {
  return [
    ...provideRagExtension(),
    // keep other extensions here
  ];
}
```

### 3. Add extension assets to the build

Edit `app/project.json` and add to the `build.options.assets` array:

```json
{
  "glob": "ext-rag.plugin.json",
  "input": "projects/ext-rag/src/assets",
  "output": "./assets/plugins"
}
```

### 4. Configure the RAG service URL

Add to `app/src/app.config.json` (see [`config/app.config.snippet.json`](config/app.config.snippet.json)):

```json
{
  "plugins": {
    "ragService": {
      "baseUrl": "/api/rag",
      "searchPath": "/search/semantic",
      "promptPath": "/prompt",
      "streamPath": "/chat/stream"
    },
    "contentLakeService": {
      "baseUrl": "/api/content-lake"
    }
  }
}
```

### 5. Configure the dev proxy

Add to `app/proxy.conf.js` (see [`config/proxy.conf.snippet.js`](config/proxy.conf.snippet.js)):

```javascript
'/api/rag': {
  target: 'http://localhost:9091',
  changeOrigin: true,
  secure: false,
  logLevel: 'debug'
},
'/api/content-lake': {
  target: 'http://localhost:9090',
  changeOrigin: true,
  secure: false,
  logLevel: 'debug'
}
```

### 6. Run

```bash
npm start
```

Open `http://localhost:4200`, log in, and find the *RAG Assistant* entry in the left navigation.

## Accessing sidebar features

Use this flow to access all sidebar-driven features from the document list:

1. Open any library or folder in ACA and select a node.
2. Click the info drawer toggle (right-side panel icon in the top toolbar) to open the right panel.
3. In the panel header, switch to:
   * *Ask AI* tab for compact document-scoped chat.
   * *Content Lake* tab for scope and ingestion controls.

What you can do from each tab:

* *Ask AI* (document selected):
  * Ask questions about the selected document directly from the sidebar.
  * Keep context while browsing files without leaving the current page.
* *Content Lake* (folder selected):
  * Enable or disable Content Lake inclusion for the folder subtree.
* *Content Lake* (document selected):
  * Exclude or include the document from inherited Content Lake scope.
  * Check *Ingestion status* and refresh it using the refresh icon.

Notes:

* Sidebar tabs appear only when the extension is correctly registered (`provideRagExtension`) and `ext-rag.plugin.json` is included in build assets.
* *Ingestion status* requires `/api/content-lake/*` to be proxied to `batch-ingester` (see proxy/nginx sections below).

## Content Lake scope controls

The extension also exposes the repository scope model introduced by `alfresco-content-lake`:

* Right-click a folder and use *Enable Content Lake for this folder* or *Disable Content Lake for this folder* to add or remove `cl:indexed`
* Open the *Content Lake* tab in the ACA info drawer to manage the same folder toggle without leaving the current view
* Select a document inside an indexed subtree and use *Exclude this document from Content Lake* to set `cl:excludeFromLake=true`
* Look for the `offline_bolt` badge on nodes that are currently in Content Lake scope, and the `block` badge on documents explicitly excluded from ingestion

These controls call the standard Alfresco Repository nodes API directly. No extra UI-specific backend service is required.

## Install into ADW

The mechanism is identical, only the paths change since ADW uses Nx:

1. Place the extension under `libs/ext-rag/` (or generate a new Nx lib and copy the source)
2. Update `tsconfig.base.json` to map `@myorg/ext-rag` > `libs/ext-rag/src/index.ts`
3. Import `ExtRagModule` in `apps/content-ee/src/app/extension.module.ts`
4. Add the plugin JSON asset in `angular.json` under `content-ee` build assets
5. Configure proxy / gateway the same way

## Docker deployment

The `docker` directory contains a production-ready Dockerfile that builds ACA with the ext-rag extension pre-installed:

```bash
docker build -t alfresco-content-lake-ui -f docker/Dockerfile .
```

See [`docker`](docker/) for details on the nginx template and runtime configuration hook.

## Production deployment (nginx)

Add this block inside the `server { }` in your existing `nginx.conf` (see [`config/nginx.snippet.conf`](config/nginx.snippet.conf)):

```nginx
location /api/rag/ {
  proxy_pass http://rag-service:9091/api/rag/;
}

location /api/content-lake/ {
  proxy_pass http://batch-ingester:9090/api/content-lake/;
}
```

This ensures:

* Requests from the browser go to the same origin (no CORS issues)
* The ADF HTTP interceptor attaches the Alfresco auth ticket automatically
* `rag-service` receives the ticket and can validate it against the Alfresco authentication API
* `batch-ingester` serves ingestion-status lookups used by the Content Lake sidebar

## Authentication flow

```
Browser (ACA/ADW)
  │
  │  POST /api/rag/prompt
  │  Header: Authorization: Basic <alfresco-ticket>
  │
  ▼
nginx / gateway
  │
  │  proxy_pass → rag-service:9091
  │
  ▼
rag-service
  │
  │  Validates ticket via:
  │  GET /alfresco/api/-default-/public/authentication/versions/1/tickets/-me-
  │
  ▼
Alfresco Repository
```

No custom authentication code is needed in the Angular module. ADF installs an HTTP interceptor that adds the ticket to every same-origin request. The gateway makes `rag-service` reachable on the same origin as Alfresco.

## API contract

The extension expects the following endpoints from [alfresco-content-lake](https://github.com/aborroy/alfresco-content-lake) `rag-service`:

### `POST /api/rag/search/semantic`

Semantic search across indexed content-lake chunks.

**Request:**

```json
{
  "query": "a girl falls in a crater",
  "topK": 5,
  "minScore": 0.5
}
```

**Response:**

```json
{
  "query": "a girl falls in a crater",
  "model": "OpenAiEmbeddingModel",
  "vectorDimension": 1024,
  "resultCount": 2,
  "totalCount": 2,
  "searchTimeMs": 739,
  "results": [
    {
      "rank": 1,
      "score": 0.5760,
      "chunkText": "found herself falling down a very deep well…",
      "sourceDocument": {
        "documentId": "c225f4d5-882b-4b99-81d1-3226af2560a4",
        "nodeId": "e0f2943f-5e11-4f78-b294-3f5e116f7823",
        "name": "down-the-rabbit-hole.pdf",
        "path": "/Company Home/Sites/private/documentLibrary",
        "mimeType": "application/pdf"
      },
      "chunkMetadata": {
        "embeddingId": "334f91ec-4ed1-41b8-a1aa-bca6c2b1431e",
        "embeddingType": "default",
        "page": 0,
        "paragraph": 3,
        "chunkLength": 773
      }
    }
  ]
}
```

The UI groups results by `sourceDocument.nodeId`, showing one entry per document with all matching chunks listed underneath.

### `POST /api/rag/prompt`

RAG question-answering with optional conversation session controls.
For document scope, the UI translates `nodeId` into a backend `filter`
expression (`cin_id = '<nodeId>'`).

**Request:**

```json
{
  "question": "Why the girl fell in the hole?",
  "sessionId": "demo-session-1",
  "resetSession": false,
  "filter": "cin_id = 'e0f2943f-5e11-4f78-b294-3f5e116f7823'"
}
```

**Response:**

```json
{
  "answer": "She fell because the rabbit-hole dipped suddenly downward…",
  "question": "Why the girl fell in the hole?",
  "sessionId": "demo-session-1",
  "retrievalQuery": "why the girl fell in the hole",
  "historyTurnsUsed": 2,
  "model": "model.gguf",
  "searchTimeMs": 454,
  "generationTimeMs": 7084,
  "totalTimeMs": 7539,
  "sourcesUsed": 5,
  "sources": [
    {
      "documentId": "c225f4d5-882b-4b99-81d1-3226af2560a4",
      "nodeId": "e0f2943f-5e11-4f78-b294-3f5e116f7823",
      "name": "down-the-rabbit-hole.pdf",
      "path": "/Company Home/Sites/private/documentLibrary",
      "chunkText": "found herself falling down a very deep well…",
      "score": 0.6628
    }
  ]
}
```

The UI groups sources by `nodeId`, showing one entry per document with all source chunks.

### `POST /api/rag/chat/stream`

Streaming RAG endpoint consumed by the chat panel for progressive rendering.

Expected SSE events:

- `event: token` with incremental token payload (`token`, `delta`, `text`, or `content`)
- `event: metadata` with final response payload (`RagPromptResponse`)
- `event: done` to close the stream
- `event: error` for terminal stream errors
