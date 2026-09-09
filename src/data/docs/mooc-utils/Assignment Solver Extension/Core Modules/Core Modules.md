# Core modules

## Introduction
This page explains the core module structure of the assignment-solver extension. It covers the background service with message routing and handler implementations, the content scripts responsible for DOM extraction, answer application, and the UI components that manage state, controllers, and user interactions. It also details the core utilities including shared types, message protocols, and logging systems, and provides diagrams and references to code locations for module interactions and customization points.

## Project structure
The extension is organized into distinct layers:
- Background service worker orchestrates messaging, platform adapters, and service integrations.
- Content scripts run on target pages to extract DOM content and apply answers.
- UI controllers manage state, progress, settings, and detection workflows.
- Services encapsulate AI model interactions and parsing.
- Platform adapters abstract browser APIs for cross-browser compatibility.
- Core utilities define shared types, messages, and helpers.

```mermaid
graph TB
subgraph "Background"
BGIDX["background/index.js"]
ROUTER["background/router.js"]
H_EXTRACT["background/handlers/extraction.js"]
H_GEMINI["background/handlers/gemini.js"]
H_ANSWERS["background/handlers/answers.js"]
end
subgraph "Content Scripts"
CIDX["content/index.js"]
CEXTR["content/extractor.js"]
CAPPL["content/applicator.js"]
end
subgraph "UI"
STATE["ui/state.js"]
DETECT["ui/controllers/detection.js"]
SOLVE["ui/controllers/solve.js"]
PROGRESS["ui/controllers/progress.js"]
SETTINGS["ui/controllers/settings.js"]
end
subgraph "Services"
GEMINI["services/gemini/index.js"]
end
subgraph "Platform"
BROWSER["platform/browser.js"]
RUNTIME["platform/runtime.js"]
end
COREMSG["core/messages.js"]
CORETYPES["core/types.js"]
BGIDX --> ROUTER
BGIDX --> H_EXTRACT
BGIDX --> H_GEMINI
BGIDX --> H_ANSWERS
BGIDX --> RUNTIME
BGIDX --> BROWSER
CIDX --> CEXTR
CIDX --> CAPPL
CIDX --> COREMSG
SOLVE --> COREMSG
SOLVE --> GEMINI
SOLVE --> PROGRESS
SOLVE --> SETTINGS
SOLVE --> STATE
DETECT --> COREMSG
SETTINGS --> STATE
ROUTER --> COREMSG
H_EXTRACT --> COREMSG
H_GEMINI --> COREMSG
H_ANSWERS --> COREMSG
GEMINI --> COREMSG
GEMINI --> CORETYPES
```

## Core components
- Background service worker initializes platform adapters, services, and registers the message router. It exposes handlers for extraction, screenshots, Gemini requests, answer application, and submission.
- Content scripts provide DOM extraction and answer application, responding to messages from the background.
- UI controllers manage state, progress, settings, and detection. They coordinate the solve flow and interact with the background via message protocols.
- Services encapsulate AI model interactions, including extraction and solving, with reliable retry and error handling.
- Platform adapters abstract browser APIs for cross-browser compatibility.
- Core utilities define shared types, message constants, and helper functions for message sending with retry logic.

## Architecture overview
The extension follows a message-driven architecture:
- The background service worker listens for UI-triggered actions and routes them to appropriate handlers.
- Handlers interact with platform adapters and services, and may forward messages to content scripts.
- Content scripts execute in-page DOM operations and respond to messages with extracted data or applied answers.
- UI controllers orchestrate the end-to-end solve workflow, updating state and progress.

```mermaid
sequenceDiagram
participant UI as "UI Controller"
participant BG as "Background Worker"
participant RT as "Runtime Adapter"
participant CS as "Content Script"
participant GS as "Gemini Service"
UI->>BG : "EXTRACT_HTML"
BG->>RT : "sendMessage(EXTRACT_HTML)"
RT-->>CS : "EXTRACT_HTML"
CS-->>RT : "Page HTML + Images"
RT-->>BG : "Page HTML + Images"
BG-->>UI : "Page HTML + Images"
UI->>BG : "CAPTURE_FULL_PAGE"
BG->>RT : "sendMessage(CAPTURE_FULL_PAGE)"
RT-->>CS : "CAPTURE_FULL_PAGE"
CS-->>RT : "Screenshots"
RT-->>BG : "Screenshots"
BG-->>UI : "Screenshots"
UI->>BG : "GEMINI_REQUEST (extract)"
BG->>GS : "directAPICall(...)"
GS-->>BG : "Extraction result"
BG-->>UI : "Extraction result"
UI->>BG : "GEMINI_REQUEST (solve)"
BG->>GS : "directAPICall(...)"
GS-->>BG : "Solved extraction"
BG-->>UI : "Solved extraction"
UI->>BG : "APPLY_ANSWERS"
BG->>RT : "sendMessage(APPLY_ANSWERS)"
RT-->>CS : "APPLY_ANSWERS"
CS-->>RT : "Success"
RT-->>BG : "Success"
BG-->>UI : "Success"
```

## Detailed component analysis

### Background service worker and message routing
- Initializes platform adapters and services.
- Creates handlers for PING, EXTRACT_HTML, GET_PAGE_INFO, CAPTURE_FULL_PAGE, GEMINI_REQUEST, GEMINI_DEBUG, APPLY_ANSWERS, and SUBMIT_ASSIGNMENT.
- Registers a router that dispatches messages to handlers, ensuring asynchronous completion and proper response handling.
- Sets up extension action click to open the side panel and panel behavior for Chrome.

```mermaid
flowchart TD
Start(["Background Init"]) --> Adapters["Initialize adapters<br/>runtime, tabs, scripting, panel"]
Adapters --> Services["Initialize services<br/>Gemini, Screenshot"]
Services --> Handlers["Create handlers map"]
Handlers --> Router["Create message router"]
Router --> Listen["runtime.onMessage(router)"]
Listen --> Action["browser.action.onClicked -> open panel"]
Action --> Done(["Ready"])
```

### Message protocols and utilities
- Defines MESSAGE_TYPES for content/background communication and internal messages.
- Provides createMessage for constructing typed messages.
- sendMessageWithRetry adds reliable retry logic for transient connection failures, especially important for Firefox.

```mermaid
classDiagram
class MessageTypes {
+PING
+GET_PAGE_HTML
+GET_PAGE_INFO
+APPLY_ANSWERS
+SUBMIT_ASSIGNMENT
+EXTRACT_HTML
+CAPTURE_FULL_PAGE
+GEMINI_REQUEST
+GEMINI_DEBUG
+SCROLL_INFO
+SCROLL_TO
+TAB_UPDATED
}
class Messages {
+createMessage(type, payload) Message
+sendMessageWithRetry(runtime, message, options) Promise
}
MessageTypes <.. Messages : "exports"
```

### Content scripts: DOM extraction and answer application
- Content script listens for messages and performs:
  - PING health checks.
  - GET_PAGE_HTML extraction via extractor service.
  - GET_PAGE_INFO quick page info for assignment detection.
  - SCROLL_INFO and SCROLL_TO for screenshot capture.
  - APPLY_ANSWERS and SUBMIT_ASSIGNMENT via applicator service.
  - GEMINI_DEBUG console logging for debugging.
- Extractor locates assignment containers, extracts HTML and images, and finds submit/confirmation button IDs.
- Applicator applies answers to radio buttons, checkboxes, and text inputs, and triggers submission.

```mermaid
sequenceDiagram
participant BG as "Background"
participant CS as "Content Script"
participant EXT as "Extractor"
participant APP as "Applicator"
BG->>CS : "GET_PAGE_HTML"
CS->>EXT : "extractPageHTML()"
EXT-->>CS : "{html, images, urls...}"
CS-->>BG : "Page data"
BG->>CS : "APPLY_ANSWERS"
CS->>APP : "applyAnswers(answers)"
APP-->>CS : "Success"
CS-->>BG : "Success"
BG->>CS : "SUBMIT_ASSIGNMENT"
CS->>APP : "submitAssignment(id, confirmIds)"
APP-->>CS : "Success"
CS-->>BG : "Success"
```

### UI components: state management, controllers, and user interface elements
- State manager holds processing state, extraction result, and current step.
- Progress controller manages status messages, step indicators, and progress bars.
- Settings controller handles API key and model preference persistence and UI binding.
- Detection controller checks current page for assignments and toggles UI visibility.
- Solve controller coordinates the full workflow: extract, capture screenshots, call Gemini for extraction and solving, apply answers, and optionally submit.

```mermaid
classDiagram
class StateManager {
+getIsProcessing() boolean
+setIsProcessing(value) void
+getExtraction() any
+setExtraction(value) void
+getCurrentStep() any
+setCurrentStep(value) void
+reset() void
}
class ProgressController {
+setStatus(message, type) void
+setStep(name, status) void
+resetSteps() void
+markStepDone(name) void
+setProgress(current, total) void
+setIndeterminate() void
+resetProgress(total) void
+showProgress() void
+hideProgress() void
}
class SettingsController {
+show() void
+hide() void
+save() Promise~boolean~
+initEventListeners(callbacks) void
}
class DetectionController {
+checkCurrentPage() Promise~void~
+showAssignmentInfo(pageInfo) void
+showEmptyState() void
+init() void
}
class SolveController {
+initEventListeners() void
+handleSolve() Promise~void~
+extractWithRecursiveSplit(...) Promise~any~
+solveWithRecursiveSplit(...) Promise~any~
+fillAllAnswers(questions, tabId) Promise~void~
+submitAssignment(id, tabId) Promise~void~
+showResults(questions) void
}
StateManager <.. SolveController : "uses"
ProgressController <.. SolveController : "uses"
SettingsController <.. SolveController : "uses"
DetectionController <.. UI : "uses"
```

### Core utilities: types and logging systems
- Shared types define ExtractedQuestion, PageData, Screenshot, ExtractionResult, and the Logger interface for consistent typing across modules.
- Logger instances are passed through adapters and handlers for consistent logging.

```mermaid
classDiagram
class Logger {
+log(msg) void
+info(msg) void
+warn(msg) void
+error(msg) void
+debug(msg) void
}
class Types {
<<typedef>>
+ExtractedQuestion
+PageData
+Screenshot
+ExtractionResult
}
Logger <.. Background : "used by"
Logger <.. Content : "used by"
Logger <.. UI : "used by"
Logger <.. Services : "used by"
```

### Platform adapters and cross-browser compatibility
- Browser adapter exports a unified browser API and provides helper functions to detect browser type and safely access optional APIs.
- Runtime adapter wraps browser.runtime for cross-browser messaging.

```mermaid
classDiagram
class BrowserAdapter {
+detectBrowser() string
+isFirefox() boolean
+isChrome() boolean
+getOptionalAPI(path) Function|Null
+hasAPI(path) boolean
}
class RuntimeAdapter {
+sendMessage(message) Promise~any~
+onMessage(listener) void
}
BrowserAdapter <.. Background : "used by"
RuntimeAdapter <.. Background : "used by"
RuntimeAdapter <.. UI : "used by"
```

### Service workers lifecycle and extension integration
- The background worker registers message listeners and sets up the extension action to open the side panel.
- Panel behavior is configured for Chrome to open the panel on action clicks.
- The worker relays debug messages to content scripts for visibility in the page console.

```mermaid
sequenceDiagram
participant Ext as "Extension"
participant BG as "Background"
participant Panel as "Panel Adapter"
Ext->>BG : "action.onClicked(tab)"
BG->>Panel : "open({tabId})"
Panel-->>BG : "Success"
BG-->>Ext : "Panel opened"
```

## Dependency analysis
The modules exhibit clear separation of concerns:
- Background depends on platform adapters, services, and core message utilities.
- Content scripts depend on extractor and applicator services plus core messages.
- UI controllers depend on state, progress, settings, and runtime adapters.
- Services depend on core messages and types.
- Platform adapters are foundational and used across modules.

```mermaid
graph LR
BG["background/index.js"] --> RT["platform/runtime.js"]
BG --> BR["platform/browser.js"]
BG --> MSG["core/messages.js"]
BG --> H1["handlers/extraction.js"]
BG --> H2["handlers/gemini.js"]
BG --> H3["handlers/answers.js"]
BG --> SV["services/gemini/index.js"]
CS["content/index.js"] --> CEX["content/extractor.js"]
CS --> CAP["content/applicator.js"]
CS --> MSG
UI["ui/controllers/solve.js"] --> ST["ui/state.js"]
UI --> PR["ui/controllers/progress.js"]
UI --> SE["ui/controllers/settings.js"]
UI --> MSG
UI --> SV
SV --> MSG
SV --> TY["core/types.js"]
```

## Performance considerations
- Message retries: sendMessageWithRetry mitigates transient connection issues, particularly in Firefox.
- Asynchronous handler pattern: Handlers return promises and ensure sendResponse is called to prevent hanging channels.
- Screenshot capture: Captures full-page screenshots to aid visual understanding; consider batching and rate limiting to reduce overhead.
- Recursive splitting: The solve and extract controllers split content on MAX_TOKENS errors to stay within model limits, improving reliability at the cost of extra API calls.
- DOM operations: Content scripts throttle answer application with small delays to improve stability.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and remedies:
- Content script not responding: The background extraction handler injects content scripts and verifies readiness with a PING message. If injection fails, the handler returns an error suggesting a page refresh.
- Firefox message channel timeouts: Use sendMessageWithRetry and ensure handlers return true for asynchronous responses to keep channels open.
- Gemini API failures: The Gemini service throws on non-OK responses and parses candidates; errors are relayed to the UI and logged.
- Debugging: Use GEMINI_DEBUG messages to relay structured payloads to the page console for inspection.

## Conclusion
The assignment-solver extension employs a clean, modular architecture centered around message-driven communication between the background service worker, content scripts, and UI controllers. Reliable utilities for messaging, types, and platform abstraction enable reliable cross-browser operation. The Gemini service integrates smoothly to extract and solve assignments, while UI controllers provide a guided, stepwise workflow with progress tracking and settings management. The documented extension points allow customization of handlers, controllers, and services to adapt to evolving assignment formats and user needs.
