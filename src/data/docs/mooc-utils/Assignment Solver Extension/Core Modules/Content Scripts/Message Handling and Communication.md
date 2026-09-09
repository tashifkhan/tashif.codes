# Message handling and communication

## Introduction
This page explains the content script message handling system that enables bidirectional communication between the content script and the background service worker. It covers supported message types, parameter and response structures, asynchronous processing, error handling, retry mechanisms, logging integration, debugging capabilities, and health checks. It also provides practical message flow examples and troubleshooting guidance.

## Project structure
The messaging system spans three layers:
- Content script: Receives and responds to messages from the background script and interacts with the page DOM.
- Background service worker: Routes messages to specialized handlers and orchestrates cross-tab communication.
- Platform adapters: Provide a unified API surface for browser-specific implementations.

```mermaid
graph TB
subgraph "Content Layer"
CS_Index["Content Index<br/>Listens for messages"]
CS_Extractor["Extractor<br/>Page HTML & images"]
CS_Applicator["Applicator<br/>Apply answers & submit"]
CS_Logger["Logger<br/>Console output"]
end
subgraph "Background Layer"
BG_Index["Background Index<br/>Registers handlers"]
BG_Router["Message Router<br/>Dispatches messages"]
BG_Extraction["Extraction Handler<br/>Injects & fetches HTML"]
BG_PageInfo["Page Info Handler<br/>Assignment detection"]
end
subgraph "Platform Adapters"
RT_Adapter["Runtime Adapter<br/>browser.runtime.*"]
TABS_Adapter["Tabs Adapter<br/>browser.tabs.*"]
BR_Adapter["Browser Adapter<br/>polyfill & detection"]
end
CS_Index <- --> BG_Router
BG_Index --> BG_Router
BG_Router --> BG_Extraction
BG_Router --> BG_PageInfo
CS_Index --> CS_Extractor
CS_Index --> CS_Applicator
CS_Index --> CS_Logger
BG_Index --> RT_Adapter
BG_Index --> TABS_Adapter
BG_Index --> BR_Adapter
```

## Core components
- Message types: Centralized in a constants module and used across content and background layers.
- Content script message listener: Handles incoming messages, delegates to extractor/applicator, and returns structured responses.
- Background message router: Dispatches messages to appropriate handlers and ensures response semantics.
- Handlers: Implement specific workflows (HTML extraction, page info, assignment detection).
- Retry and error handling: Reliable retry logic for transient connection failures.
- Logging: Unified logger factories for both content and background contexts.

Key responsibilities:
- Health checks via PING
- Page HTML and image extraction via GET_PAGE_HTML
- Quick assignment detection via GET_PAGE_INFO
- Applying answers via APPLY_ANSWERS
- Submitting assignments via SUBMIT_ASSIGNMENT
- Debugging via GEMINI_DEBUG

## Architecture overview
The system uses a request-response model with explicit message routing and error propagation. The content script listens for messages and performs DOM operations, while the background orchestrates cross-tab actions and content script injection.

```mermaid
sequenceDiagram
participant BG as "Background"
participant RT as "Runtime Adapter"
participant TABS as "Tabs Adapter"
participant CS as "Content Script"
BG->>RT : "sendMessage({type : EXTRACT_HTML})"
RT-->>BG : "onMessage listener"
BG->>TABS : "query active tab"
BG->>TABS : "sendMessage(PING)"
alt "Content script not loaded"
BG->>TABS : "executeScript(content.js)"
BG->>TABS : "sendMessage(PING) verify"
end
BG->>CS : "sendMessage(GET_PAGE_HTML)"
CS-->>BG : "resolve(PageData)"
BG-->>RT : "sendResponse(PageData)"
```

## Detailed component analysis

### Message types and contracts
Supported message types and their roles:
- PING: Health check for content script availability.
- GET_PAGE_HTML: Request page HTML and associated assets.
- GET_PAGE_INFO: Quick page metadata for assignment detection.
- APPLY_ANSWERS: Apply AI-provided answers to form elements.
- SUBMIT_ASSIGNMENT: Trigger submission with optional confirmation handling.
- GEMINI_DEBUG: Relay debug payloads to content script for logging.

Parameter and response structures:
- Generic message shape: { type: string, payload?: any }
- Responses: Always include either data fields or an error field.

Type definitions:
- Message: { type, payload? }
- PageData: { html, images[], url, title, submitButtonId, confirmButtonIds, tabId?, windowId? }
- ExtractionResult: { submit_button_id, confirm_submit_button_ids, questions[] }
- Logger: { log, warn, error }

### Content script message listener
The content script registers a message listener that:
- Logs received message types
- Returns a Promise for asynchronous responses
- Supports PING, GET_PAGE_HTML, GET_PAGE_INFO, APPLY_ANSWERS, SUBMIT_ASSIGNMENT, and GEMINI_DEBUG
- Wraps errors in structured responses

Processing logic highlights:
- PING: Responds with pong indicator
- GET_PAGE_HTML: Delegates to extractor and returns PageData
- GET_PAGE_INFO: Delegates to extractor for quick metadata
- APPLY_ANSWERS: Delegates to applicator to update DOM
- SUBMIT_ASSIGNMENT: Delegates to applicator to trigger submission
- GEMINI_DEBUG: Logs payload to console with stage context

### Background message router
The router:
- Logs incoming messages
- Looks up handler by type
- Ensures sendResponse is always invoked
- Keeps message channels open for asynchronous handlers (critical for Firefox)
- Handles both synchronous and Promise-returning handlers

### Extraction handler workflow
Purpose: Fetch full-page HTML and images from the active or specified tab.

Key steps:
- Determine tab/window context (use provided tabId or active tab)
- Verify content script presence via PING; inject if missing
- Request GET_PAGE_HTML from content script
- Return combined PageData with tab/window identifiers

Error handling:
- Propagates "no active tab" and "content script not responding" conditions
- Provides actionable messages for user action (refresh page)

### Page info handler workflow
Purpose: Detect assignment pages and gather quick metadata.

Key steps:
- Determine active tab (or provided tabId)
- Check URL for NPTEL/Swayam and assignment-related paths
- Optionally inject content script and verify PING
- Request GET_PAGE_INFO from content script
- Return structured assignment info

### Retry and connection error handling
The sendMessageWithRetry utility:
- Retries transient connection errors (e.g., "Receiving end does not exist", "Could not establish connection")
- Exponential backoff delay scaled by attempt number
- Stops after maxRetries attempts and throws a descriptive error
- Does not retry non-connection errors

Usage context:
- Particularly beneficial for Firefox where background initialization can be slower
- Can be applied when sending messages from UI or background to content script

### Logging and debugging integration
- Content script logger: Prefixed console output for content operations
- Background logger: Centralized logging for router and handlers
- GEMINI_DEBUG: Two-way debug relay from background to content script for visibility during AI workflows

### Health checks and content script lifecycle
- PING: Used by background to verify content script readiness
- Injection: Background injects content script when absent and verifies with PING
- Firefox-specific delays: Additional waits to ensure initialization completes

### Data extraction and application
- Extractor: Finds assignment containers, extracts HTML, collects images, identifies submit and confirmation button IDs
- Applicator: Applies single/multi-choice and fill-in-the-blank answers; triggers submission

## Dependency analysis
The messaging system relies on platform adapters to abstract browser differences and ensure cross-browser compatibility.

```mermaid
graph LR
BG_Index["Background Index"] --> RT["Runtime Adapter"]
BG_Index --> TABS["Tabs Adapter"]
BG_Index --> BR["Browser Adapter"]
BG_Index --> Router["Message Router"]
Router --> Handlers["Handlers"]
Handlers --> BG_Extraction["Extraction Handler"]
Handlers --> BG_PageInfo["Page Info Handler"]
CS_Index["Content Index"] --> CS_Extractor["Extractor"]
CS_Index --> CS_Applicator["Applicator"]
CS_Index --> CS_Logger["Logger"]
BG_Extraction --> CS_Index
BG_PageInfo --> CS_Index
```

## Performance considerations
- Asynchronous message handling: Handlers return Promises; ensure sendResponse is called promptly to avoid channel timeouts.
- Firefox-specific behavior: Returning true from onMessage keeps the response channel open for async work; the router enforces this.
- Injection overhead: Content script injection adds latency; caching or reusing injected scripts reduces repeated overhead.
- Image extraction: Canvas-based conversion can be expensive; filtering small or external images avoids unnecessary work.
- Retry strategy: Configurable exponential backoff prevents busy-waiting and reduces failure cascades.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Content script not responding:
  - Symptom: Error indicating content script not responding
  - Action: Refresh the page; background attempts injection and verification
- Unknown message type:
  - Symptom: Error response with unknown type
  - Action: Verify message type constants and ensure both sides use the same definitions
- Connection errors during messaging:
  - Symptom: "Receiving end does not exist" or similar
  - Action: Use sendMessageWithRetry; if persistent, reload extension or refresh page
- No active tab found:
  - Symptom: Handler reports no active tab
  - Action: Ensure a valid tab is focused; handlers support explicit tabId
- CORS or canvas conversion errors:
  - Symptom: Images skipped due to CORS
  - Action: Review image sources; only same-origin images are converted

Health check:
- Use PING from background/UI to verify content script readiness
- Background also supports PING for UI-side health checks

## Conclusion
The message handling system provides a reliable, cross-browser compatible communication layer between the content script and background service worker. It supports essential workflows for assignment detection, content extraction, answer application, and submission, with strong error handling, logging, and health checks. Following the documented patterns ensures reliable operation across Chrome and Firefox environments.
