# Extension Architecture

<cite>
**Referenced Files in This Document**
- [wxt.config.ts](file://extension/wxt.config.ts)
- [background.ts](file://extension/entrypoints/background.ts)
- [content.ts](file://extension/entrypoints/content.ts)
- [index.tsx](file://extension/entrypoints/sidepanel/index.tsx)
- [main.tsx](file://extension/entrypoints/sidepanel/main.tsx)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts)
- [AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts)
- [package.json](file://extension/package.json)
- [tsconfig.json](file://extension/tsconfig.json)
- [README.md](file://extension/README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Security Considerations](#security-considerations)
9. [Cross-Browser Compatibility](#cross-browser-compatibility)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Conclusion](#conclusion)

## Introduction
This document explains the Browser Extension Architecture built with the WXT framework. It focuses on the three main entry points:
- Background script for extension-wide operations and cross-tab coordination
- Content script for page-level automation and DOM interaction
- Side panel UI for user interaction and agent orchestration

It documents extension configuration, manifest setup, messaging architecture, component relationships, lifecycle management, and integration patterns with browser APIs. Security, permissions, and performance optimization strategies are also covered.

## Project Structure
The extension is organized under the extension directory with WXT entrypoints and React-based UI components. Key areas:
- Configuration: wxt.config.ts defines module usage, permissions, and host permissions
- Background: background.ts handles messaging, tab management, and agent tool execution
- Content: content.ts manages page-level automation and DOM interactions
- Side Panel: React app mounted via shadow DOM with hooks for auth, tabs, and WebSocket
- Utilities: websocket-client.ts, executeActions.ts, and shared parsing utilities

```mermaid
graph TB
subgraph "Extension Root"
CFG["wxt.config.ts"]
PKG["package.json"]
TS["tsconfig.json"]
end
subgraph "Entry Points"
BG["background.ts"]
CT["content.ts"]
SP_IDX["sidepanel/index.tsx"]
SP_MAIN["sidepanel/main.tsx"]
APP["sidepanel/App.tsx"]
end
subgraph "Side Panel Hooks"
AUTH["hooks/useAuth.ts"]
TABS["hooks/useTabManagement.ts"]
end
subgraph "Utilities"
WS["utils/websocket-client.ts"]
EXE["utils/executeActions.ts"]
end
CFG --> BG
CFG --> CT
CFG --> SP_IDX
SP_IDX --> APP
APP --> AUTH
APP --> TABS
APP --> WS
APP --> EXE
PKG --> WS
PKG --> EXE
```

**Diagram sources**
- [wxt.config.ts](file://extension/wxt.config.ts#L1-L29)
- [background.ts](file://extension/entrypoints/background.ts#L1-L1642)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [index.tsx](file://extension/entrypoints/sidepanel/index.tsx#L1-L26)
- [main.tsx](file://extension/entrypoints/sidepanel/main.tsx#L1-L10)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [package.json](file://extension/package.json#L1-L40)
- [tsconfig.json](file://extension/tsconfig.json#L1-L13)

**Section sources**
- [wxt.config.ts](file://extension/wxt.config.ts#L1-L29)
- [package.json](file://extension/package.json#L1-L40)
- [tsconfig.json](file://extension/tsconfig.json#L1-L13)
- [README.md](file://extension/README.md#L1-L4)

## Core Components
- Background Script: Central orchestrator for messaging, tab state, and agent tool execution. Handles message routing for agent actions, tab operations, and Gemini requests.
- Content Script: Page-level automation that injects or removes visual overlays and performs DOM actions (click, type, scroll) via injected scripts.
- Side Panel UI: React application mounted in a shadow DOM, providing user controls, authentication, tab management, and agent execution with WebSocket integration.

Key responsibilities:
- Messaging: bidirectional communication between UI, background, and content scripts
- Permissions: activeTab, tabs, storage, scripting, identity, sidePanel, webNavigation, webRequest, cookies, bookmarks, history, clipboard, notifications, contextMenus, downloads
- Cross-origin: host_permissions for <all_urls>

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L1-L1642)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [index.tsx](file://extension/entrypoints/sidepanel/index.tsx#L1-L26)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [wxt.config.ts](file://extension/wxt.config.ts#L5-L27)

## Architecture Overview
The extension follows a layered architecture:
- UI Layer: Side panel React app with hooks for auth and tab management
- Control Layer: Background script managing messaging and cross-tab operations
- Automation Layer: Content script performing DOM-level actions
- Utility Layer: WebSocket client and action executor utilities

```mermaid
graph TB
UI["Side Panel UI<br/>React App"] --> BG["Background Script<br/>Messaging Hub"]
BG --> CT["Content Script<br/>DOM Automation"]
UI --> WS["WebSocket Client"]
UI --> AUTH["Auth Hook"]
UI --> TABS["Tab Management Hook"]
BG --> UTIL_EXE["Action Executor"]
UI --> UTIL_WS["WebSocket Client"]
subgraph "Browser APIs"
RT["runtime"]
TABS_API["tabs"]
ST["storage"]
ID["identity"]
SCR["scripting"]
NAV["webNavigation"]
REQ["webRequest"]
end
BG --> RT
BG --> TABS_API
BG --> ST
BG --> ID
BG --> SCR
BG --> NAV
BG --> REQ
```

**Diagram sources**
- [background.ts](file://extension/entrypoints/background.ts#L1-L1642)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [index.tsx](file://extension/entrypoints/sidepanel/index.tsx#L1-L26)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)

## Detailed Component Analysis

### Background Script
Responsibilities:
- Message routing for agent tool execution, tab activation/deactivation, tab queries, action execution, Gemini requests, and generated agent runs
- Tab tracking via browser.tabs listeners and storage updates
- Dynamic imports for external libraries (e.g., Gemini SDK)
- Injection of content scripts and inter-tab messaging

Key flows:
- Message listener routes incoming runtime messages to handlers
- Tab management updates local storage for UI consumption
- Action execution injects content scripts and forwards actions to content script

```mermaid
sequenceDiagram
participant UI as "Side Panel UI"
participant BG as "Background Script"
participant CT as "Content Script"
participant TAB as "Tabs API"
UI->>BG : "ACTIVATE_AI_FRAME" or "DEACTIVATE_AI_FRAME"
BG->>TAB : "Query active tab"
BG->>CT : "Inject/remove overlay (via scripting)"
CT-->>BG : "Activation result"
UI->>BG : "EXECUTE_ACTION"
BG->>TAB : "Inject content script"
BG->>CT : "Send PERFORM_ACTION"
CT-->>BG : "Action result"
BG-->>UI : "Response"
```

**Diagram sources**
- [background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [background.ts](file://extension/entrypoints/background.ts#L428-L449)
- [content.ts](file://extension/entrypoints/content.ts#L197-L213)

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L1-L1642)

### Content Script
Responsibilities:
- Optional creation/removal of visual AI frame overlays
- DOM-level actions (click, type, scroll) via injected functions
- Basic action parsing and execution helpers

Notes:
- The current implementation focuses on DOM manipulation and does not actively listen for messages in the provided snippet
- The commented code shows a previous approach to overlay injection and removal

**Section sources**
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)

### Side Panel UI
Responsibilities:
- Mounts React app in a shadow DOM
- Provides authentication flow (Google OAuth and demo GitHub login)
- Manages active tab and tab list
- Integrates WebSocket client for agent execution and statistics
- Executes agent commands and browser actions

Key integrations:
- Shadow DOM mounting via WXT content script API
- Authentication hook for OAuth and token refresh
- Tab management hook for active tab and tab list
- WebSocket client for agent execution and progress updates
- Action executor for browser-level actions

```mermaid
sequenceDiagram
participant UI as "Side Panel UI"
participant AUTH as "Auth Hook"
participant TABS as "Tab Management Hook"
participant WS as "WebSocket Client"
participant BG as "Background Script"
UI->>AUTH : "handleLogin()"
AUTH->>AUTH : "Launch OAuth flow"
AUTH-->>UI : "User data + tokens"
UI->>TABS : "loadTabs()"
TABS->>BG : "GET_ALL_TABS"
BG-->>TABS : "Tab list"
TABS-->>UI : "Active tab + tabs"
UI->>WS : "executeAgent()"
WS->>WS : "Emit execute_agent"
WS-->>UI : "Progress + Result"
```

**Diagram sources**
- [index.tsx](file://extension/entrypoints/sidepanel/index.tsx#L1-L26)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [background.ts](file://extension/entrypoints/background.ts#L81-L89)

**Section sources**
- [index.tsx](file://extension/entrypoints/sidepanel/index.tsx#L1-L26)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)

### Messaging System Architecture
The messaging system connects the UI, background, and content layers:
- UI sends commands to background via runtime.sendMessage
- Background routes messages to appropriate handlers
- Background injects content scripts and communicates with content script via tabs.sendMessage
- Content script executes DOM actions and returns results

```mermaid
flowchart TD
UI["Side Panel UI"] --> BG_MSG["Background Message Listener"]
BG_MSG --> BG_ROUTER{"Route by type"}
BG_ROUTER --> |EXECUTE_AGENT_TOOL| BG_TOOL["handleExecuteAgentTool"]
BG_ROUTER --> |ACTIVATE_AI_FRAME| BG_ACT["handleActivateAIFrame"]
BG_ROUTER --> |DEACTIVATE_AI_FRAME| BG_DEACT["handleDeactivateAIFrame"]
BG_ROUTER --> |GET_ACTIVE_TAB| BG_GET_ACTIVE["handleGetActiveTab"]
BG_ROUTER --> |GET_ALL_TABS| BG_GET_ALL["handleGetAllTabs"]
BG_ROUTER --> |EXECUTE_ACTION| BG_EXEC["handleExecuteAction"]
BG_ROUTER --> |GEMINI_REQUEST| BG_GEM["handleGeminiRequest"]
BG_ROUTER --> |RUN_GENERATED_AGENT| BG_RUN["handleRunGeneratedAgent"]
BG_EXEC --> CT_INJ["Inject content script"]
CT_INJ --> CT_MSG["tabs.sendMessage to content"]
CT_MSG --> CT_PERF["performAction()"]
CT_PERF --> BG_RESP["Return result to background"]
BG_RESP --> UI_RESP["Return result to UI"]
```

**Diagram sources**
- [background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [background.ts](file://extension/entrypoints/background.ts#L428-L514)
- [content.ts](file://extension/entrypoints/content.ts#L197-L213)

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [background.ts](file://extension/entrypoints/background.ts#L428-L514)
- [content.ts](file://extension/entrypoints/content.ts#L197-L213)

### Component Relationships
- Side Panel App depends on hooks for authentication and tab management
- AgentExecutor integrates with WebSocket client and action executor
- Background script coordinates messaging and tab operations
- Content script provides DOM-level automation

```mermaid
classDiagram
class App {
+user
+activeTab
+apiKey
+response
+isSettingsOpen
}
class useAuth {
+handleLogin()
+handleGitHubLogin()
+handleLogout()
+getTokenAge()
+getTokenExpiry()
+handleManualRefresh()
}
class useTabManagement {
+tabs
+activeTab
+loadTabs()
}
class AgentExecutor {
+handleExecute()
+handleStop()
+progress
+result
}
class WebSocketClient {
+executeAgent()
+stopAgent()
+getStats()
+isSocketConnected()
}
class executeActions {
+executeBrowserActions()
}
App --> useAuth : "uses"
App --> useTabManagement : "uses"
App --> AgentExecutor : "renders"
AgentExecutor --> WebSocketClient : "uses"
AgentExecutor --> executeActions : "uses"
```

**Diagram sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L1-L800)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)

**Section sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L1-L800)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)

## Dependency Analysis
External dependencies include React, Socket.IO client, and Google Generative AI SDK. Internal dependencies are structured around hooks and utilities.

```mermaid
graph LR
PKG["package.json"] --> REACT["react"]
PKG --> SOCKET["socket.io-client"]
PKG --> GAISDK["@google/generative-ai"]
PKG --> RADIX["@radix-ui/react-select"]
PKG --> MARKDOWN["react-markdown"]
APP["App.tsx"] --> AUTH["useAuth.ts"]
APP --> TABS["useTabManagement.ts"]
APP --> WS["websocket-client.ts"]
APP --> AE["AgentExecutor.tsx"]
AE --> EXE["executeActions.ts"]
```

**Diagram sources**
- [package.json](file://extension/package.json#L17-L32)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L1-L800)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)

**Section sources**
- [package.json](file://extension/package.json#L17-L32)

## Performance Considerations
- Minimize DOM operations: batch DOM queries and mutations in content script
- Debounce UI updates: throttle progress updates and tab list refreshes
- Lazy loading: defer heavy computations until needed (e.g., Gemini SDK dynamic import)
- Efficient messaging: avoid excessive message traffic; coalesce updates
- Memory cleanup: remove event listeners and unmount React roots when appropriate
- WebSocket reconnection: configure retry policies and backoff strategies

## Security Considerations
- Permissions: carefully review and limit permissions to those required for functionality
- Host permissions: <all_urls> grants broad access; ensure CSP and content security are enforced
- OAuth: validate redirect URIs and handle errors gracefully; store tokens securely in browser storage
- Content script isolation: avoid exposing sensitive data; sanitize inputs before DOM manipulation
- Cross-origin requests: validate and sanitize external API responses; handle rate limits and errors

## Cross-Browser Compatibility
- WXT supports multiple browsers; ensure browser-specific APIs are handled consistently
- Use browser polyfills or feature detection for APIs not universally available
- Test manifest keys and permissions across Chrome, Firefox, and Edge
- Validate content script injection and messaging behavior differences

## Troubleshooting Guide
Common issues and resolutions:
- Messaging timeouts: verify message listener registration and ensure async responses are sent
- Content script injection failures: confirm scripting permissions and correct file paths
- Tab operations failing: check tabs permissions and active tab queries
- WebSocket connectivity: verify URL configuration and network availability
- Authentication errors: validate OAuth flow and token refresh logic

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L128-L208)
- [websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L17-L40)

## Conclusion
The extension architecture leverages WXT’s entry points and React to deliver a cohesive browser automation experience. The background script centralizes messaging and coordination, the content script handles page-level automation, and the side panel UI provides user interaction and agent orchestration. Proper configuration, security hardening, and performance optimization are essential for robust cross-browser deployment.