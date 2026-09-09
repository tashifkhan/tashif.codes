# HTML extraction handler

## Introduction
This page provides detailed technical documentation for the HTML extraction handler, which enables the extension to retrieve processed HTML content from web pages. The handler manages tab selection, content script injection, HTML retrieval, error handling, and response formatting. It includes practical examples for tab ID resolution, active tab fallback, and content script verification patterns, along with cross-browser compatibility considerations for Firefox and Chrome.

## Project structure
The HTML extraction capability spans several modules:
- Background handler: orchestrates tab management, content script lifecycle, and response formatting
- Platform adapters: abstract browser APIs for cross-browser compatibility
- Content script: extracts HTML and images from the page
- Manifest: declares content script registration and permissions

```mermaid
graph TB
subgraph "Background"
BG_Index["Background Index<br/>Registers handlers"]
Router["Message Router<br/>Routes messages"]
Handler["Extraction Handler<br/>Main logic"]
end
subgraph "Platform Adapters"
Tabs["Tabs Adapter<br/>tabs API"]
Scripting["Scripting Adapter<br/>scripting API"]
Browser["Browser Polyfill<br/>webextension-polyfill"]
end
subgraph "Content Script"
ContentIndex["Content Script Entry<br/>Message listener"]
Extractor["Extractor Service<br/>HTML & image extraction"]
end
Manifest["Manifest<br/>Content script registration"]
BG_Index --> Router
Router --> Handler
Handler --> Tabs
Handler --> Scripting
Handler --> Browser
ContentIndex --> Extractor
Manifest --> ContentIndex
```

## Core components
The HTML extraction handler is composed of:
- Tab management: resolves tab ID, falls back to active tab, and validates tab/window context
- Content script lifecycle: pings existing script, injects if missing, verifies readiness, and handles delays for Firefox
- HTML retrieval: requests processed HTML from the content script and enriches response with metadata
- Error handling: reliable failure modes for injection, verification, and communication
- Response formatting: standardizes response shape with tab/window identifiers

Key responsibilities:
- Resolve tab context deterministically using either explicit tabId or active tab
- Ensure content script availability via ping and injection
- Retrieve structured HTML with associated images and page metadata
- Provide clear error messages for UI feedback

## Architecture overview
The extraction flow integrates background handlers, platform adapters, and the content script:

```mermaid
sequenceDiagram
participant Caller as "Caller"
participant Router as "Message Router"
participant Handler as "Extraction Handler"
participant Tabs as "Tabs Adapter"
participant Scripting as "Scripting Adapter"
participant Content as "Content Script"
participant Extractor as "Extractor Service"
Caller->>Router : "EXTRACT_HTML" message
Router->>Handler : Dispatch to handler
Handler->>Handler : Resolve tabId (explicit or active)
Handler->>Tabs : "PING" message to content script
alt Content script not loaded
Handler->>Scripting : Inject content script
Handler->>Tabs : "PING" message (verification)
end
Handler->>Content : "GET_PAGE_HTML" message
Content->>Extractor : extractPageHTML()
Extractor-->>Content : HTML + images + metadata
Content-->>Handler : Response with page data
Handler-->>Caller : Response enriched with tab/window IDs
```

## Detailed component analysis

### Tab management logic
The handler resolves the target tab using explicit tabId or active tab fallback:
- Explicit tabId: fetches tab metadata to obtain windowId
- Active tab fallback: queries current window for active tab, validates presence, and extracts tab/window IDs
- Error handling: returns structured error when no active tab is available

Examples:
- Explicit tabId resolution: pass tabId in message payload; handler queries tab and sets windowId
- Active tab fallback: when tabId is omitted, handler queries active tab in current window

```mermaid
flowchart TD
Start(["Start"]) --> HasTabId{"Has message.tabId?"}
HasTabId --> |Yes| UseProvided["Use provided tabId<br/>Fetch tab metadata"]
UseProvided --> GetWindowId["Get windowId from tab"]
HasTabId --> |No| QueryActive["Query active tab in current window"]
QueryActive --> FoundActive{"Active tab found?"}
FoundActive --> |No| NoActive["Send error: No active tab found"]
FoundActive --> |Yes| UseActive["Use active tabId and windowId"]
GetWindowId --> Ready["Ready to proceed"]
UseActive --> Ready
NoActive --> End(["End"])
Ready --> End
```

### Content script lifecycle
The handler ensures the content script is ready before requesting HTML:
- Ping verification: sends PING message to check if content script is loaded
- Injection: if ping fails, executes content script via scripting.executeScript
- Verification: sends PING again to confirm readiness
- Firefox-specific delay: adds extra wait time to accommodate slower initialization

```mermaid
flowchart TD
Start(["Start"]) --> Ping["Send PING to content script"]
Ping --> PingSuccess{"Ping successful?"}
PingSuccess --> |Yes| Proceed["Proceed to GET_PAGE_HTML"]
PingSuccess --> |No| Inject["Execute content script"]
Inject --> Delay["Wait for Firefox initialization"]
Delay --> Verify["Send PING to verify"]
Verify --> VerifySuccess{"Verification successful?"}
VerifySuccess --> |Yes| Proceed
VerifySuccess --> |No| Retry["Wait longer and retry once"]
Retry --> Proceed
Proceed --> End(["End"])
```

### HTML retrieval and response formatting
The handler requests processed HTML from the content script:
- Sends GET_PAGE_HTML message to content script
- Receives structured response containing HTML, images, URL, title, submit button IDs, and confirmation button IDs
- Enriches response with tabId and windowId for UI context

```mermaid
sequenceDiagram
participant Handler as "Extraction Handler"
participant Content as "Content Script"
participant Extractor as "Extractor Service"
Handler->>Content : "GET_PAGE_HTML"
Content->>Extractor : extractPageHTML()
Extractor-->>Content : {html, images, url, title, submitButtonId, confirmButtonIds}
Content-->>Handler : Response
Handler-->>Handler : Add tabId and windowId
Handler-->>Caller : Final response
```

### Error handling patterns
The handler implements layered error handling:
- Tab resolution: returns error when no active tab is available
- Injection failures: reports inability to load content script with guidance to refresh
- Communication failures: handles content script not responding with actionable message
- General errors: wraps exceptions with standardized error response

```mermaid
flowchart TD
Start(["Start"]) --> TryBlock["Try block"]
TryBlock --> TabResolution["Resolve tabId"]
TabResolution --> PingCheck["Ping content script"]
PingCheck --> InjectCheck{"Injection needed?"}
InjectCheck --> |Yes| Inject["Inject content script"]
Inject --> Verify["Verify injection"]
InjectCheck --> |No| HtmlRequest["Request HTML"]
Verify --> VerifySuccess{"Verified?"}
VerifySuccess --> |Yes| HtmlRequest
VerifySuccess --> |No| InjectFail["Report injection failure"]
HtmlRequest --> HtmlSuccess{"HTML retrieval success?"}
HtmlSuccess --> |Yes| Enrich["Enrich response with tab/window IDs"]
HtmlSuccess --> |No| HtmlFail["Report HTML retrieval failure"]
InjectFail --> End(["End"])
HtmlFail --> End
Enrich --> End
```

### Content script verification patterns
The content script exposes a PING endpoint for health checks:
- Responds with pong: true to confirm readiness
- Used by background handler to validate content script availability
- Supports re-verification after injection

```mermaid
sequenceDiagram
participant Handler as "Extraction Handler"
participant Content as "Content Script"
Handler->>Content : "PING"
Content-->>Handler : {pong : true}
Note over Handler,Content : "Content script verified"
```

## Dependency analysis
The extraction handler depends on platform adapters and messaging infrastructure:
- Tabs adapter abstracts browser.tabs.* APIs
- Scripting adapter abstracts browser.scripting.executeScript
- Message router ensures asynchronous responses and proper channel management
- Content script provides extraction service and message handling

```mermaid
graph TB
Handler["Extraction Handler"]
Tabs["Tabs Adapter"]
Scripting["Scripting Adapter"]
Router["Message Router"]
Content["Content Script"]
Extractor["Extractor Service"]
Handler --> Tabs
Handler --> Scripting
Handler --> Router
Content --> Extractor
```

## Performance considerations
- Firefox initialization delay: the handler introduces a deliberate wait after injection to ensure content script readiness
- Image extraction overhead: converting images to base64 can be expensive; the extractor filters small or unloaded images
- Selector traversal: multiple DOM queries are performed to locate assessment containers; selectors are prioritized for efficiency
- Asynchronous message handling: the router keeps message channels open for Firefox compatibility, preventing premature closure

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- No active tab found: occurs when no tab is active in the current window; ensure a tab is selected before invoking extraction
- Content script not loaded: indicates injection failure; refresh the page and retry
- Content script not responding: suggests timing issues; wait briefly and retry; the handler includes verification steps
- CORS restrictions: images that fail conversion are skipped with warnings; this is expected for external resources

Diagnostic tips:
- Monitor logs for tab resolution and injection steps
- Verify content script health via PING messages
- Check response enrichment for tab/window IDs

## Cross-Browser compatibility
The extension uses webextension-polyfill to ensure compatibility across Chrome and Firefox:
- Unified browser API: all platform adapters use browser.* instead of browser-specific APIs
- Firefox-specific handling: longer delay after injection to accommodate slower initialization
- Manifest configuration: content script registered for NPTEL domains with document_idle execution

Key compatibility points:
- Tabs API: abstracted via tabs adapter
- Scripting API: abstracted via scripting adapter
- Browser detection: helper functions to detect Chrome vs Firefox
- Manifest permissions: includes activeTab, tabs, storage, sidePanel, and scripting

## Conclusion
The HTML extraction handler provides a reliable mechanism for retrieving processed HTML from web pages while managing tab context, ensuring content script readiness, and delivering structured responses. Its design emphasizes reliability through verification, error handling, and cross-browser compatibility. The modular architecture enables easy maintenance and extension for future enhancements.
