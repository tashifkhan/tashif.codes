# Message router

## Introduction
This page explains the message routing system that enables cross-extension communication in the NPTEL Assignment Solver extension. It covers how the router handles incoming messages, registers handlers, dispatches messages to appropriate handlers, and manages errors. It also documents the router factory function, handler mapping patterns, and the dependency injection pattern used in handler creation. Finally, it demonstrates message flow from content scripts to handlers and shows how the system ensures reliable communication across browsers.

## Project structure
The message routing system spans several modules:
- Background service worker initializes adapters, services, and handlers, then registers the router.
- Core module defines message types and utilities for sending messages with retry logic.
- Platform adapters abstract browser APIs for cross-browser compatibility.
- Content script listens for messages from the background and responds directly to them.
- Handlers encapsulate business logic and depend on platform adapters and services.

```mermaid
graph TB
subgraph "Background"
BG_INDEX["background/index.js"]
BG_ROUTER["background/router.js"]
BG_HANDLERS["background/handlers/*"]
BG_RUNTIME["platform/runtime.js"]
BG_TABS["platform/tabs.js"]
end
subgraph "Core"
CORE_MESSAGES["core/messages.js"]
CORE_TYPES["core/types.js"]
end
subgraph "Content"
CONTENT_INDEX["content/index.js"]
CONTENT_EXTRACTOR["content/extractor.js"]
CONTENT_APPLICATOR["content/applicator.js"]
end
subgraph "Platform"
PLATFORM_BROWSER["platform/browser.js"]
end
BG_INDEX --> BG_ROUTER
BG_INDEX --> BG_HANDLERS
BG_INDEX --> BG_RUNTIME
BG_INDEX --> BG_TABS
BG_ROUTER --> CORE_MESSAGES
BG_HANDLERS --> CORE_MESSAGES
BG_HANDLERS --> BG_RUNTIME
BG_HANDLERS --> BG_TABS
CONTENT_INDEX --> CORE_MESSAGES
CONTENT_INDEX --> CONTENT_EXTRACTOR
CONTENT_INDEX --> CONTENT_APPLICATOR
BG_RUNTIME --> PLATFORM_BROWSER
BG_TABS --> PLATFORM_BROWSER
```

## Core components
- Message router factory: Creates a listener function that routes messages to registered handlers, handles unknown types, and ensures responses are sent for asynchronous operations.
- Message types and utilities: Defines standardized message types and a retry mechanism for transient connection failures.
- Background initialization: Sets up adapters, services, and handlers, then registers the router with the runtime adapter.
- Content script listener: Responds to messages from the background and performs DOM operations.
- Platform adapters: Provide cross-browser compatibility for runtime and tabs APIs.
- Handler factories: Encapsulate business logic and dependency injection for handlers.

Key responsibilities:
- Router: Central dispatcher that validates message types, invokes handlers, and guarantees response delivery.
- Handlers: Implement specific actions (e.g., extraction, screenshot capture, Gemini API requests).
- Adapters: Abstract browser APIs to support both Chrome and Firefox consistently.
- Content script: Bridges background and page DOM for operations requiring DOM access.

## Architecture overview
The message routing architecture follows a request-response pattern with explicit handler registration and reliable error handling. The background service worker creates adapters and services, registers handlers in a map keyed by message type, and installs a single router that delegates to the appropriate handler. The content script listens for messages and performs DOM-related tasks.

```mermaid
sequenceDiagram
participant UI as "UI/Side Panel"
participant BG as "Background Worker"
participant RT as "Runtime Adapter"
participant H as "Handler"
participant CS as "Content Script"
participant TABS as "Tabs Adapter"
UI->>BG : "Send message with type"
BG->>RT : "onMessage(listener)"
RT-->>BG : "Deliver message"
BG->>BG : "Lookup handler by type"
BG->>H : "Invoke handler(message, sender, sendResponse)"
alt "Handler requires DOM access"
H->>TABS : "tabs.sendMessage(tabId, {type})"
TABS-->>H : "Response from content script"
else "Handler is pure background"
H-->>BG : "Return result"
end
H-->>BG : "sendResponse(result)"
BG-->>UI : "Response"
```

## Detailed component analysis

### Router factory and message dispatching
The router factory function accepts a handler map and an optional logger, returning a listener suitable for installation with the runtime adapter. The listener:
- Logs incoming messages.
- Looks up the handler by message type.
- Returns an error response if no handler is found.
- Invokes the handler synchronously and ensures responses are sent for asynchronous operations.
- Keeps the message channel open for Firefox by returning true when appropriate.

```mermaid
flowchart TD
Start(["Message Received"]) --> Log["Log message type"]
Log --> Lookup{"Handler exists?"}
Lookup --> |No| SendErr["sendResponse({ error })"]
SendErr --> ReturnFalse["Return false"]
Lookup --> |Yes| TryInvoke["Invoke handler(message, sender, sendResponse)"]
TryInvoke --> IsPromise{"Handler returned Promise?"}
IsPromise --> |Yes| HandleAsync["Handle Promise resolution/rejection"]
IsPromise --> |No| ReturnTrue["Return true"]
HandleAsync --> ReturnTrue
ReturnFalse --> End(["Done"])
ReturnTrue --> End
```

### Handler registration mechanism
Handlers are registered in a map keyed by message type during background initialization. Each handler is created via a factory that receives dependencies (adapters, services, logger). This pattern centralizes dependency management and allows handlers to remain pure functions of their inputs.

Examples of registrations:
- PING handler responds immediately with a pong.
- EXTRACT_HTML handler uses tabs and scripting adapters to inject and communicate with the content script.
- GEMINI_REQUEST handler delegates to a service for API calls.
- Gemini debug handler relays debug messages to the content script.

```mermaid
classDiagram
class BackgroundIndex {
+handlers : Map
+createMessageRouter()
+registerRuntimeListener()
}
class MessageRouter {
+createMessageRouter(handlers, logger)
+handleMessage(message, sender, sendResponse)
}
class ExtractionHandler {
+createExtractionHandler(deps)
+handleExtractHtml(message, sender, sendResponse)
}
class GeminiHandler {
+createGeminiHandler(deps)
+handleGeminiRequest(message, sender, sendResponse)
}
BackgroundIndex --> MessageRouter : "creates"
BackgroundIndex --> ExtractionHandler : "registers"
BackgroundIndex --> GeminiHandler : "registers"
MessageRouter --> BackgroundIndex : "invokes handlers"
```

### Dependency injection pattern in handlers
Handlers are created with a dependency injection pattern:
- Each handler factory takes a deps object containing required collaborators (e.g., tabs, scripting, geminiService, logger).
- The factory returns a handler function that uses these dependencies internally.
- Background initialization composes adapters and services, then passes them to handler factories.

Benefits:
- Testability: Dependencies can be mocked for unit tests.
- Reusability: Same handler logic can be reused with different environments.
- Separation of concerns: Handlers focus on orchestration while adapters/services encapsulate platform-specific behavior.

### Cross-Browser communication flow
The system uses webextension-polyfill to ensure compatibility across Chrome and Firefox. The runtime adapter wraps browser.runtime APIs, and the tabs adapter wraps browser.tabs APIs. The content script listens for messages and performs DOM operations.

```mermaid
sequenceDiagram
participant BG as "Background"
participant RT_BG as "Runtime Adapter (BG)"
participant CS as "Content Script"
participant RT_CS as "Runtime Adapter (CS)"
participant TABS as "Tabs Adapter"
BG->>RT_BG : "sendMessage(message)"
RT_BG-->>RT_CS : "Deliver to content script"
RT_CS-->>CS : "onMessage listener"
CS->>CS : "Switch on message.type"
CS-->>RT_CS : "resolve(response)"
RT_CS-->>RT_BG : "Return response"
RT_BG-->>BG : "Handler response"
```

### Error handling strategies
The router and handlers implement layered error handling:
- Router: Logs unknown message types and ensures sendResponse is called. For asynchronous handlers, it catches rejections and sends an error response if sendResponse was not already called.
- Handlers: Wrap operations in try/catch blocks, log errors, and send structured error responses. Some handlers include retry-like logic (e.g., content script injection verification).
- Content script: Returns error responses for unknown message types and logs exceptions.

### Message types and retry logic
Message types define the contract between components. The core module provides:
- MESSAGE_TYPES: Standardized message type constants.
- createMessage: Helper to construct typed messages.
- sendMessageWithRetry: Retries transient connection failures with exponential delays, useful for Firefox where background initialization can be slower.

## Dependency analysis
The router depends on:
- Message types for dispatching.
- Logger for diagnostics.
- Handlers map for delegation.

Handlers depend on:
- Platform adapters (runtime, tabs) for browser APIs.
- Services (e.g., Gemini service) for external integrations.
- Logger for observability.

Content script depends on:
- Extractor and applicator services for DOM operations.
- Browser runtime for message exchange.

```mermaid
graph LR
CORE["core/messages.js"] --> ROUTER["background/router.js"]
ROUTER --> HANDLERS["background/handlers/*"]
HANDLERS --> RUNTIME["platform/runtime.js"]
HANDLERS --> TABS["platform/tabs.js"]
CONTENT["content/index.js"] --> CORE
CONTENT --> EXTRACTOR["content/extractor.js"]
CONTENT --> APPLICATOR["content/applicator.js"]
RUNTIME --> BROWSER["platform/browser.js"]
TABS --> BROWSER
```

## Performance considerations
- Asynchronous response handling: Handlers should resolve promises promptly to avoid blocking the message channel. The router keeps channels open for Firefox by returning true when appropriate.
- Content script injection: The extraction handler injects the content script only when necessary and verifies readiness before proceeding.
- Retry logic: sendMessageWithRetry reduces failure rates for transient connection issues, particularly beneficial for Firefox.
- Logging overhead: Excessive logging can impact performance; use the logger judiciously in production builds.

## Troubleshooting guide
Common issues and resolutions:
- Unknown message type: The router responds with an error. Verify the message type constant and ensure the handler is registered.
- Content script not responding: The extraction handler attempts to inject the content script and verifies it. If injection fails, the handler returns an error suggesting a page refresh.
- Firefox-specific issues: Keep the message channel open by returning true from the router listener. Use sendMessageWithRetry for background communication.
- CORS and image extraction: The extractor skips images that cannot be converted due to CORS restrictions.

## Conclusion
The message routing system provides a clean, extensible foundation for cross-extension communication. The router factory centralizes dispatch logic, the dependency injection pattern improves modularity and testability, and platform adapters ensure cross-browser compatibility. The combination of standardized message types, reliable error handling, and retry mechanisms yields a reliable and maintainable architecture.
