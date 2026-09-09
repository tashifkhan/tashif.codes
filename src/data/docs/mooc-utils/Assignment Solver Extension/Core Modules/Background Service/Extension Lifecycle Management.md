# Extension lifecycle management

## Introduction
This page explains the extension lifecycle management for the NPTEL Assignment Solver extension. It covers how the browser action icon click opens the side panel, how the background service worker manages runtime event listeners, how the UI initializes and interacts with the background, and how content scripts bridge page DOM interactions with the extension's background. It also documents cross-browser compatibility strategies, panel behavior configuration, and reliable error handling for UI interactions.

## Project structure
The extension follows a modular structure with clear separation of concerns:
- Background service worker orchestrates messaging, panel behavior, and runtime listeners
- Platform adapters abstract browser APIs for cross-browser compatibility
- UI handles initialization, event binding, and user feedback
- Content scripts extract page data and apply answers to forms
- Handlers process messages from the UI and content scripts

```mermaid
graph TB
subgraph "Browser"
BA["Browser Action Icon"]
SP["Side Panel"]
end
subgraph "Extension"
BG["Background Service Worker<br/>index.js"]
RT["Runtime Adapter<br/>runtime.js"]
PT["Panel Adapter<br/>panel.js"]
MSG["Message Router<br/>router.js"]
MH["Message Types<br/>messages.js"]
end
subgraph "UI"
UIIDX["UI Entry Point<br/>ui/index.js"]
DET["Detection Controller<br/>controllers/detection.js"]
SOLVE["Solve Controller<br/>controllers/solve.js"]
end
subgraph "Content Scripts"
CTIDX["Content Script Entry<br/>content/index.js"]
EXTR["Extractor<br/>content/extractor.js"]
APP["Applicator<br/>content/applicator.js"]
end
BA --> PT
PT --> BG
UIIDX --> MH
UIIDX --> RT
SOLVE --> MH
SOLVE --> RT
DET --> RT
CTIDX --> MH
CTIDX --> EXTR
CTIDX --> APP
BG --> MSG
BG --> PT
BG --> RT
BG --> MH
```

## Core components
- Background service worker: Initializes adapters, registers message handlers, sets up browser action click listener, and configures panel behavior.
- Panel adapter: Unifies Chrome sidePanel and Firefox sidebarAction APIs for opening/closing panels and setting behavior.
- Runtime adapter: Wraps browser.runtime for cross-browser messaging.
- Tabs and Scripting adapters: Manage tab queries, content script injection, and tab-specific messaging.
- Message router: Centralized handler dispatch with proper async response handling for Firefox.
- UI entry point: Waits for background readiness, initializes controllers, and binds UI events.
- Content script: Listens for messages, extracts page data, applies answers, and submits assignments.
- Handlers: Implement specific tasks like HTML extraction, screenshot capture, and answer application.

## Architecture overview
The extension uses a unidirectional messaging model:
- UI sends requests to the background via runtime.sendMessage
- Background routes messages to appropriate handlers
- Handlers may query tabs, inject content scripts, or call services
- Content scripts respond directly to UI requests for page data
- Panel behavior is configured per browser

```mermaid
sequenceDiagram
participant User as "User"
participant BA as "Browser Action"
participant PT as "Panel Adapter"
participant BG as "Background"
participant UI as "Side Panel UI"
participant CT as "Content Script"
User->>BA : Click extension icon
BA->>PT : open()
PT->>BG : sidePanel.open() or sidebarAction.open()
BG-->>UI : Panel opened
UI->>BG : PING (health check)
BG-->>UI : PONG
UI->>BG : EXTRACT_HTML
BG->>CT : GET_PAGE_HTML
CT-->>BG : Page HTML + metadata
BG-->>UI : Page HTML + tab/window IDs
UI->>BG : CAPTURE_FULL_PAGE
BG->>BG : Capture screenshots
BG-->>UI : Screenshots
UI->>BG : APPLY_ANSWERS
BG->>CT : APPLY_ANSWERS
CT-->>BG : Success
BG-->>UI : Applied
UI->>BG : SUBMIT_ASSIGNMENT
BG->>CT : SUBMIT_ASSIGNMENT
CT-->>BG : Success
BG-->>UI : Submitted
```

## Detailed component analysis

### Browser action integration and panel opening
- The background listens for browser action clicks and opens the panel via the panel adapter.
- Panel behavior is configured for Chrome to open the panel on action click.
- The panel adapter abstracts differences between Chrome sidePanel and Firefox sidebarAction.

```mermaid
sequenceDiagram
participant BA as "Browser Action onClick"
participant BG as "Background"
participant PT as "Panel Adapter"
BA->>BG : onClick(tab)
BG->>PT : open({ tabId })
alt Firefox
PT->>PT : sidebarAction.open()
else Chrome
PT->>PT : sidePanel.open({ tabId })
end
PT-->>BG : Panel opened
```

### Panel behavior configuration (chrome)
- The background sets panel behavior to open on action click for Chrome.
- Firefox does not expose a direct close API for sidePanel; closing is handled implicitly.

```mermaid
flowchart TD
Start(["Set Panel Behavior"]) --> CheckChrome{"Chrome?"}
CheckChrome --> |Yes| HasAPI{"sidePanel.setPanelBehavior exists?"}
HasAPI --> |Yes| CallAPI["Call setPanelBehavior(openPanelOnActionClick: true)"]
HasAPI --> |No| LogWarn["Log warning and continue"]
CheckChrome --> |No| Ignore["Ignore (Firefox)"]
CallAPI --> End(["Done"])
LogWarn --> End
Ignore --> End
```

### Runtime event listeners and message routing
- The background registers a message router that dispatches to handlers based on message type.
- Handlers return promises and ensure sendResponse is called to avoid hanging message ports.
- Firefox requires returning true synchronously to keep the message channel open for async responses.

```mermaid
sequenceDiagram
participant UI as "UI"
participant RT as "Runtime Adapter"
participant BG as "Background"
participant MR as "Message Router"
participant H as "Handler"
UI->>RT : sendMessage({ type, payload })
RT->>BG : onMessage
BG->>MR : handleMessage(message, sender, sendResponse)
MR->>H : handler(message, sender, sendResponse)
H-->>MR : Promise(result) or result
MR-->>BG : Channel kept open (return true)
H-->>MR : sendResponse(result)
MR-->>UI : Response
```

### UI initialization and health checks
- The side panel waits for the background to be ready using a PING mechanism with exponential backoff.
- Controllers initialize event listeners and bind UI actions to background handlers.

```mermaid
sequenceDiagram
participant UI as "UI Entry"
participant RT as "Runtime Adapter"
participant BG as "Background"
UI->>UI : Initialize controllers
UI->>RT : sendMessage({ type : PING })
RT->>BG : onMessage(PING)
BG-->>RT : { pong : true }
RT-->>UI : Response
UI->>UI : initEventListeners()
UI->>UI : detection.init()
```

### Content script extraction and answer application
- The content script listens for messages and performs page extraction, scrolling info retrieval, and answer/application/submission.
- It responds to Gemini debug messages and logs to the page console for visibility.

```mermaid
sequenceDiagram
participant UI as "UI"
participant BG as "Background"
participant CT as "Content Script"
UI->>BG : GET_PAGE_HTML
BG->>CT : GET_PAGE_HTML
CT-->>BG : { html, images, url, title, ... }
UI->>BG : APPLY_ANSWERS
BG->>CT : APPLY_ANSWERS
CT-->>BG : { success : true }
UI->>BG : SUBMIT_ASSIGNMENT
BG->>CT : SUBMIT_ASSIGNMENT
CT-->>BG : { success : true }
```

### Cross-Browser compatibility and API detection
- The browser adapter detects Chrome vs Firefox and exposes safe API accessors.
- Panel adapter checks availability of sidePanel/sideBarAction APIs and falls back gracefully.

```mermaid
flowchart TD
Start(["Initialize Platform"]) --> Detect["Detect Browser"]
Detect --> IsFF{"Firefox?"}
IsFF --> |Yes| FF["Use sidebarAction APIs"]
IsFF --> |No| IsChrome{"Chrome?"}
IsChrome --> |Yes| CH["Use sidePanel APIs"]
IsChrome --> |No| DEF["Default to Chrome behavior"]
FF --> End(["Ready"])
CH --> End
DEF --> End
```

### Relationship between background events and UI triggers
- UI triggers (solve, settings, detection) send messages to the background.
- Background handlers may inject content scripts, query tabs, and coordinate with content scripts.
- UI listens for tab updates and re-detects assignments when the background signals.

```mermaid
sequenceDiagram
participant UI as "UI"
participant BG as "Background"
participant DET as "Detection Controller"
UI->>BG : GET_PAGE_INFO
BG-->>UI : { isAssignment, title, questionCount }
DET->>DET : init()
DET->>BG : Listen for TAB_UPDATED
BG-->>DET : TAB_UPDATED
DET->>UI : Re-check page and update UI
```

## Dependency analysis
The extension exhibits strong modularity with clear dependency boundaries:
- Background depends on platform adapters and message router
- UI depends on runtime adapter and controllers
- Content script depends on extractor and applicator
- Handlers depend on tabs/scripting adapters and services

```mermaid
graph LR
BG["Background"] --> RT["Runtime Adapter"]
BG --> PT["Panel Adapter"]
BG --> MSG["Message Router"]
BG --> MH["Message Types"]
UI["UI Entry"] --> RT
UI --> MH
UI --> DET["Detection Controller"]
UI --> SOLVE["Solve Controller"]
CT["Content Script"] --> MH
CT --> EXTR["Extractor"]
CT --> APP["Applicator"]
BG --> H1["Extraction Handler"]
BG --> H2["Screenshot Handler"]
H1 --> TABS["Tabs Adapter"]
H1 --> SCRIPT["Scripting Adapter"]
H2 --> SVC["Screenshot Service"]
```

## Performance considerations
- Message retries: The UI uses a retry mechanism with exponential backoff for transient connection failures, particularly important for Firefox.
- Content script injection delays: The background waits for content scripts to initialize before proceeding, with extra delays for Firefox.
- Token limit handling: The solve controller splits large inputs recursively to avoid MAX_TOKENS errors, merging results afterward.
- Progress reporting: UI shows determinate progress where possible and indeterminate progress for long-running steps.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and their handling:
- Background not ready: The UI performs health checks with retries; if unsuccessful, it warns and continues.
- Content script injection failures: The background attempts injection and verifies responsiveness; errors suggest refreshing the page.
- Panel open/close failures: Panel adapter logs errors and throws exceptions; Firefox lacks a direct close API.
- Message port closures: Router ensures sendResponse is called and keeps channels open for Firefox-compatible async responses.
- Gemini debug relay: UI relays debug payloads to the background and content script; failures are logged and ignored to prevent blocking.

## Conclusion
The extension implements a reliable lifecycle management system:
- Icon clicks reliably open the panel via unified adapters
- Runtime listeners route messages efficiently with Firefox-compliant async handling
- UI initializes safely with health checks and retry logic
- Content scripts bridge page DOM interactions with background orchestration
- Cross-browser compatibility is achieved through API detection and abstraction
- Error handling is detailed, with logging and graceful degradation

[No sources needed since this section summarizes without analyzing specific files]
