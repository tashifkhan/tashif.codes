# Browser extension architecture

## Introduction
This page explains the browser extension architecture built with WXT and React. It covers the side panel UI, background script functionality, content script integration, and the messaging system between extension components. It documents the WXT configuration, component hierarchy in the side panel, and how the extension communicates with the backend through WebSocket connections. It also includes examples of lifecycle management, permission handling, cross-origin communication, the agent executor pattern, real-time conversation display, and authentication flow. Finally, it addresses browser compatibility, packaging, and deployment strategies, along with component composition patterns and integration with browser APIs.

## Project structure
The extension is organized into entrypoints for background, content, and side panel, plus shared utilities and hooks. WXT manages build, manifest generation, and browser-specific targets.

```mermaid
graph TB
subgraph "Extension Root"
CFG["wxt.config.ts"]
PKG["package.json"]
TSC["tsconfig.json"]
end
subgraph "Entry Points"
BG["background.ts"]
CT["content.ts"]
SP_IDX["sidepanel/index.tsx"]
SP_MAIN["sidepanel/main.tsx"]
APP["sidepanel/App.tsx"]
AE["sidepanel/AgentExecutor.tsx"]
end
subgraph "Utilities"
WS_CLIENT["utils/websocket-client.ts"]
EXEC_AGENT["utils/executeAgent.ts"]
EXEC_ACTIONS["utils/executeActions.ts"]
PARSE_CMD["utils/parseAgentCommand.ts"]
end
subgraph "Hooks"
AUTH["hooks/useAuth.ts"]
WS_HOOK["hooks/useWebSocket.ts"]
TABS["hooks/useTabManagement.ts"]
end
CFG --> BG
CFG --> CT
CFG --> SP_IDX
SP_IDX --> APP
APP --> AE
APP --> AUTH
APP --> WS_HOOK
APP --> TABS
AE --> WS_CLIENT
AE --> EXEC_AGENT
AE --> EXEC_ACTIONS
AE --> PARSE_CMD
AUTH --> WS_CLIENT
```

## Core components
- Side Panel (React): Hosted inside a shadow root UI, renders the main app, manages authentication, WebSocket connectivity, tab management, and the agent executor.
- Background Script: Handles cross-tab messaging, executes agent tools, performs browser-level actions, and manages Gemini requests.
- Content Script: Injects UI overlays and performs page-level actions when instructed by the background script.
- Messaging System: Uses browser runtime messaging for background ↔ side panel and background ↔ content script communication.
- WebSocket Client: Provides a minimal client for real-time agent execution updates and statistics retrieval.
- Utilities: Command parsing, agent execution, and browser action execution.

## Architecture overview
The extension follows a layered architecture:
- UI Layer: Side panel React app with hooks for auth, WebSocket, and tab management.
- Control Layer: Side panel orchestrates agent execution and displays progress.
- Communication Layer: WebSocket client for real-time updates; browser messaging for background ↔ side panel and background ↔ content script.
- Execution Layer: Background script handles browser APIs and dispatches actions; content script executes DOM-level actions.

```mermaid
graph TB
SP["Side Panel (React)"]
BG["Background Script"]
CS["Content Script"]
WS["WebSocket Server"]
BA["Browser APIs"]
SP --> BG
BG --> BA
SP --> WS
SP --> BA
BG --> CS
CS --> BA
```

## Detailed component analysis

### Side panel React application
The side panel is a React app mounted inside a shadow root UI. It initializes the app, sets up authentication, WebSocket connectivity, and tab management. It renders the agent executor and unified settings menu.

```mermaid
classDiagram
class App {
+user
+authLoading
+tokenStatus
+browserInfo
+handleLogin()
+handleGitHubLogin()
+handleLogout()
+getTokenAge()
+getTokenExpiry()
+handleManualRefresh()
+loadApiKey()
+saveApiKey()
+loadConversationStats()
}
class AgentExecutor {
+goal
+isExecuting
+progress
+result
+error
+sessions
+activeSessionId
+openTabs
+handleExecute()
+handleStop()
+handleNewChat()
+handleDeleteSession()
}
class useAuth {
+user
+authLoading
+tokenStatus
+shouldRedirectToSettings
+handleLogin()
+handleGitHubLogin()
+handleLogout()
+getTokenAge()
+getTokenExpiry()
+handleManualRefresh()
}
class useWebSocket {
+wsConnected
+useWebSocket
+autoConnectEnabled
+setupWebSocket()
}
class useTabManagement {
+tabs
+activeTab
+loadTabs()
}
App --> AgentExecutor : "renders"
App --> useAuth : "uses"
App --> useWebSocket : "uses"
App --> useTabManagement : "uses"
```

### Authentication flow
The authentication hook integrates with browser identity and a backend service to exchange OAuth codes for tokens, persist user data, and manage token refresh. It supports both Google OAuth and a demo GitHub flow.

```mermaid
sequenceDiagram
participant UI as "Side Panel UI"
participant Hook as "useAuth"
participant Identity as "browser.identity"
participant Backend as "Backend Service"
UI->>Hook : "handleLogin()"
Hook->>Identity : "launchWebAuthFlow(authUrl)"
Identity-->>Hook : "redirectResponse(code)"
Hook->>Backend : "POST /exchange-code {code, redirect_uri}"
Backend-->>Hook : "{access_token, refresh_token, expires_in}"
Hook->>Backend : "GET /userinfo?access_token"
Backend-->>Hook : "user info"
Hook->>Hook : "persist googleUser in storage"
Hook-->>UI : "set user state"
```

### WebSocket integration and real-time updates
The WebSocket client encapsulates connection management, event emission, and agent execution. The side panel hook subscribes to connection status and progress updates, displaying real-time feedback.

```mermaid
sequenceDiagram
participant SP as "Side Panel"
participant Hook as "useWebSocket"
participant WSClient as "wsClient"
participant Server as "WebSocket Server"
SP->>Hook : "setupWebSocket()"
Hook->>WSClient : "subscribe to connection_status"
WSClient->>Server : "connect()"
Server-->>WSClient : "connect"
WSClient-->>Hook : "emit {connected : true}"
Hook-->>SP : "set wsConnected=true"
SP->>WSClient : "executeAgent(command, onProgress)"
WSClient->>Server : "emit execute_agent {command}"
Server-->>WSClient : "generation_progress"
WSClient-->>SP : "onProgress(message)"
Server-->>WSClient : "agent_result"
WSClient-->>SP : "resolve result"
```

### Agent executor pattern and action execution
The agent executor parses slash commands, executes agents either via WebSocket or HTTP, and triggers browser actions. It maintains chat sessions and displays formatted responses.

```mermaid
flowchart TD
Start(["User submits command"]) --> Parse["Parse command (/agent-action ...)"]
Parse --> Stage{"Stage complete?"}
Stage --> |No| Suggestions["Show suggestions or partial matches"]
Suggestions --> WaitInput["Wait for user refinement"]
WaitInput --> Parse
Stage --> |Yes| Prepare["Prepare payload with context<br/>tabs, chat history, attachments"]
Prepare --> Mode{"WebSocket connected?"}
Mode --> |Yes| WSExec["wsClient.executeAgent()"]
Mode --> |No| HTTPExec["fetch() to backend endpoint"]
WSExec --> Actions{"Has action plan?"}
HTTPExec --> Actions
Actions --> |Yes| ExecActions["executeBrowserActions()"]
Actions --> |No| Display["Format and display response"]
ExecActions --> Display
Display --> Persist["Persist sessions to storage"]
Persist --> End(["Done"])
```

### Background script functionality and messaging
The background script listens for messages from the side panel and content script, executes agent tools, manages tabs, and performs browser-level actions. It injects content scripts and coordinates cross-tab communication.

```mermaid
sequenceDiagram
participant SP as "Side Panel"
participant BG as "Background Script"
participant CS as "Content Script"
participant Tabs as "Tabs API"
SP->>BG : "runtime.sendMessage {type : EXECUTE_AGENT_TOOL, payload}"
BG->>BG : "handleExecuteAgentTool()"
BG-->>SP : "sendResponse(result)"
SP->>BG : "runtime.sendMessage {type : EXECUTE_ACTION, payload}"
BG->>Tabs : "scripting.executeScript(files : [...])"
BG->>Tabs : "tabs.sendMessage(tabId, {type : PERFORM_ACTION, action})"
BG-->>SP : "sendResponse(response)"
SP->>BG : "runtime.sendMessage {type : GET_ACTIVE_TAB}"
BG->>Tabs : "tabs.query({active : true,currentWindow : true})"
BG-->>SP : "sendResponse({success, tab})"
SP->>BG : "runtime.sendMessage {type : GET_ALL_TABS}"
BG->>Tabs : "tabs.query({})"
BG-->>SP : "sendResponse({success, tabs})"
```

### Content script integration
The content script runs on all URLs and can be extended to perform page-level actions. It listens for messages from the background script and executes DOM operations.

## Dependency analysis
The extension relies on WXT for build and manifest generation, React for UI, and Socket.IO for real-time communication. Dependencies are declared in package.json and TypeScript configuration extends WXT's generated tsconfig.

```mermaid
graph TB
WXT["WXT Build System"]
React["React + ReactDOM"]
SocketIO["Socket.IO Client"]
Tailwind["Tailwind Merge / Animate CSS"]
Radix["Radix UI Select"]
Markdown["React Markdown + KaTeX"]
WXT --> AppTSX["App.tsx"]
React --> AppTSX
SocketIO --> WSClient["websocket-client.ts"]
Tailwind --> AppTSX
Radix --> AppTSX
Markdown --> AppTSX
```

## Performance considerations
- Debounce or throttle frequent UI updates (e.g., tab list refresh) to reduce re-renders.
- Batch browser API calls (tabs.query, scripting.executeScript) and cache results where appropriate.
- Use lazy loading for heavy components and defer non-critical computations.
- Limit DOM extraction sizes (e.g., HTML capture) and apply timeouts to prevent long-running operations.
- Prefer polling fallbacks for stats retrieval when WebSocket is unavailable.

## Troubleshooting guide
Common issues and resolutions:
- WebSocket not connecting: Verify VITE_API_URL and server availability; check connection events and fallback to HTTP stats.
- Authentication failures: Ensure backend is running and identity API is available; confirm OAuth redirect URI and scopes.
- Content script injection errors: Confirm permissions and that the content script path is correct; verify target tab exists.
- Tab management inconsistencies: Ensure listeners are registered/unregistered on mount/unmount; use query results before acting.
- Cross-origin limitations: Use host_permissions and appropriate permissions; avoid unsafe inline styles in injected UI.

## Conclusion
The extension architecture cleanly separates concerns across UI, messaging, execution, and communication layers. The React-based side panel provides a modern interface with reliable authentication and real-time updates via WebSocket. The background script centralizes browser API interactions and action orchestration, while the content script handles page-level operations. With proper permission handling, lifecycle management, and cross-origin considerations, the extension is ready for production deployment across browsers.

## Appendices

### WXT configuration and permissions
- Manifest permissions include activeTab, tabs, storage, scripting, identity, sidePanel, webNavigation, webRequest, cookies, bookmarks, history, clipboard, notifications, contextMenus, downloads.
- Host permissions grant access to all URLs.
- Scripts support development and build targets for Chrome and Firefox.

### Browser compatibility and packaging
- Use WXT scripts to build and package for Chrome and Firefox.
- Shadow DOM UI ensures isolation and compatibility across pages.
- Feature detection for browser APIs (e.g., speech recognition) prevents runtime errors.

### Cross-Origin communication
- Use host_permissions for broad access.
- For OAuth, rely on browser.identity and secure redirects.
- For backend communication, configure CORS and environment variables for API base URL.
