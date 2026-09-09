# Browser extension

## Introduction
This page explains the Browser Extension component of the Agentic Browser project. It focuses on the React-based side panel built with the WXT framework, covering the side panel UI structure, component organization, state management, messaging between extension components, authentication flow, settings management, and the AgentExecutor implementation. It also documents the WebSocket client for real-time communication, content script integration for page-level automation, and cross-browser compatibility considerations.

## Project structure
The extension is organized under the extension directory with the following key areas:
- Side panel entrypoint with React app and hooks
- Background script for extension-wide operations and messaging
- Content script for page-level automation
- Utilities for agent execution, action execution, and WebSocket client
- UI components for profile, settings, loading, sign-in, and response sections

```mermaid
graph TB
subgraph "Side Panel"
SP_App["App.tsx"]
SP_Agent["AgentExecutor.tsx"]
SP_Settings["UnifiedSettingsMenu.tsx"]
SP_Profile["ProfileSidebar.tsx"]
SP_SignIn["SignInScreen.tsx"]
SP_Loading["LoadingScreen.tsx"]
SP_Response["ResponseSection.tsx"]
SP_Hooks["Hooks<br/>useAuth.ts, useWebSocket.ts"]
end
subgraph "Background Script"
BG["background.ts"]
end
subgraph "Content Script"
CS["content.ts"]
end
subgraph "Utilities"
U_WS["websocket-client.ts"]
U_Parse["parseAgentCommand.ts"]
U_ExecAgent["executeAgent.ts"]
U_ExecActions["executeActions.ts"]
end
SP_App --> SP_Agent
SP_App --> SP_Settings
SP_App --> SP_Profile
SP_App --> SP_SignIn
SP_App --> SP_Loading
SP_App --> SP_Response
SP_App --> SP_Hooks
SP_Agent --> U_WS
SP_Agent --> U_Parse
SP_Agent --> U_ExecAgent
SP_Agent --> U_ExecActions
BG --> CS
BG --> U_ExecAgent
BG --> U_ExecActions
```

## Core components
- Side panel React app orchestrates authentication, settings, and agent execution.
- Hooks encapsulate authentication and WebSocket connectivity.
- AgentExecutor manages chat sessions, command parsing, agent execution, and action execution.
- Utilities provide command parsing, agent execution, and WebSocket client.
- Background script handles messaging, tab management, and action execution.
- Content script provides page-level automation hooks.

## Architecture overview
The extension follows a React side panel front-end communicating with a background script and content script. Real-time capabilities are provided by a WebSocket client. Authentication integrates with Google OAuth via the browser identity API and a local backend service.

```mermaid
sequenceDiagram
participant UI as "Side Panel UI (React)"
participant BG as "Background Script"
participant CS as "Content Script"
participant WS as "WebSocket Client"
participant BE as "Backend/API"
UI->>BG : "runtime.sendMessage(type : EXECUTE_AGENT_TOOL)"
BG->>BE : "Fetch/execute tool"
BE-->>BG : "Result"
BG-->>UI : "Response"
UI->>WS : "executeAgent(command, onProgress)"
WS-->>UI : "generation_progress events"
WS-->>UI : "agent_result or agent_error"
UI->>BG : "runtime.sendMessage(type : EXECUTE_ACTION, payload)"
BG->>CS : "tabs.sendMessage(PERFORM_ACTION)"
CS-->>BG : "Action result"
BG-->>UI : "Response"
```

## Detailed component analysis

### Side panel application (app)
- Initializes authentication and WebSocket hooks.
- Loads API key and conversation stats.
- Activates/deactivates AI frame on tab changes.
- Renders AgentExecutor and UnifiedSettingsMenu.

```mermaid
flowchart TD
Start([Mount App]) --> InitAuth["Init useAuth()"]
InitAuth --> InitWS["Init useWebSocket()"]
InitWS --> LoadAPI["Load API key from storage"]
LoadAPI --> LoadStats["Load conversation stats"]
LoadStats --> ActivateFrame["Send ACTIVATE_AI_FRAME to active tab"]
ActivateFrame --> Render["Render AgentExecutor + Settings"]
Render --> DeactivateOnUnmount["On unmount: send DEACTIVATE_AI_FRAME"]
```

### Authentication hook (useAuth)
- Detects browser type and sets browser info.
- Handles Google OAuth via browser.identity.
- Stores user data in browser storage and refreshes tokens.
- Provides manual refresh and logout helpers.

```mermaid
sequenceDiagram
participant UI as "Side Panel UI"
participant Auth as "useAuth()"
participant Identity as "browser.identity"
participant Backend as "Backend Service"
UI->>Auth : "handleLogin()"
Auth->>Identity : "launchWebAuthFlow()"
Identity-->>Auth : "Authorization code"
Auth->>Backend : "POST /exchange-code"
Backend-->>Auth : "Access/Refresh tokens"
Auth->>Auth : "Store user in storage"
Auth-->>UI : "User state updated"
```

### WebSocket hook (useWebSocket)
- Initializes WebSocket client and listens for connection status and progress updates.
- Reads auto-connect preference from storage.
- Exposes connection state to UI.

```mermaid
flowchart TD
Init([useWebSocket mount]) --> Setup["Setup wsClient listeners"]
Setup --> ReadPref["Read wsAutoConnect from storage"]
ReadPref --> Connected{"Connected?"}
Connected --> |Yes| Notify["Set wsConnected=true"]
Connected --> |No| Fallback["Set wsConnected=false"]
```

### Agent executor (AgentExecutor)
- Manages sessions, messages, and progress updates.
- Parses slash commands and executes agent actions.
- Supports voice input, file attachments, and tab mentions.
- Integrates with WebSocket client for streaming and fallback HTTP for stats.

```mermaid
flowchart TD
Input([User Input]) --> Parse["parseAgentCommand()"]
Parse --> Stage{"Stage"}
Stage --> |complete| ExecAgent["executeAgent()"]
Stage --> |partial| Suggestions["Show suggestions"]
ExecAgent --> Actions{"Has action_plan?"}
Actions --> |Yes| ExecBrowser["executeBrowserActions()"]
Actions --> |No| Format["formatResponseToText()"]
ExecBrowser --> Format
Format --> SaveMsg["Add assistant message"]
```

### WebSocket client
- Provides a minimal Socket.IO client wrapper.
- Emits connection status and progress events.
- Executes agent commands and stops execution.

```mermaid
classDiagram
class WebSocketClient {
-socket
-listeners
-autoConnect
+connect()
+on(event, callback)
+off(event, callback)
+isSocketConnected() bool
+executeAgent(command, onProgress) Promise
+stopAgent() void
+getStats() Promise
+disconnect() void
+enableAutoConnect() void
+disableAutoConnect() void
}
```

### Background script (background.ts)
- Listens for messages from side panel and content script.
- Handles activation/deactivation of AI frames, tab queries, action execution, and Gemini requests.
- Injects content scripts and relays actions to the active tab.

```mermaid
sequenceDiagram
participant SP as "Side Panel"
participant BG as "Background Script"
participant CS as "Content Script"
SP->>BG : "ACTIVATE_AI_FRAME / DEACTIVATE_AI_FRAME"
BG->>BG : "Inject/remove frame via scripting.executeScript"
BG-->>SP : "Response"
SP->>BG : "EXECUTE_ACTION {action, tabId}"
BG->>BG : "scripting.executeScript(content.js)"
BG->>CS : "tabs.sendMessage(PERFORM_ACTION)"
CS-->>BG : "Action result"
BG-->>SP : "Response"
```

### Content script (content.ts)
- Provides helpers to find elements and perform actions (play/pause video, click, type, scroll).
- Can create overlays for AI frame indication (commented in current implementation).
- Receives action messages from background script.

### UI components
- UnifiedSettingsMenu: Collapsible settings/profile panel with tabs, model selection, API key, base URL, Google/JIIT connections, and WebSocket auto-connect.
- ProfileSidebar: Detailed user profile with token controls and logout.
- ResponseSection: Displays agent responses.
- LoadingScreen: Minimal loading UI.
- SignInScreen: OAuth login options with animated branding.

## Dependency analysis
- WXT configuration defines permissions and host permissions for broad site access.
- Dependencies include React, Radix UI, Lucide icons, Socket.IO client, KaTeX, and Tailwind utilities.
- Side panel depends on hooks for auth and WebSocket, and utilities for agent/command/action execution.
- Background script depends on browser APIs for messaging, tabs, scripting, and storage.

```mermaid
graph LR
WXT["wxt.config.ts"] --> Pkg["package.json"]
Pkg --> React["React"]
Pkg --> Icons["Lucide Icons"]
Pkg --> SocketIO["socket.io-client"]
Pkg --> KaTeX["KaTeX"]
App["App.tsx"] --> Hooks["useAuth.ts, useWebSocket.ts"]
App --> Utils["executeAgent.ts, executeActions.ts, websocket-client.ts, parseAgentCommand.ts"]
App --> UI["Components/*.tsx"]
BG["background.ts"] --> CS["content.ts"]
BG --> Utils
```

## Performance considerations
- Minimize DOM operations in content script; batch action execution with small delays.
- Debounce or throttle command suggestions and tab fetching in AgentExecutor.
- Use browser storage efficiently; avoid frequent writes by batching.
- Prefer WebSocket streaming for long-running tasks; fallback to HTTP only when necessary.
- Lazy-load heavy components and libraries to reduce initial bundle size.

## Troubleshooting guide
Common issues and resolutions:
- WebSocket not connecting: Verify VITE_API_URL and auto-connect preference; check connection status events.
- Action execution failures: Ensure content script injection succeeded and tab IDs are valid.
- Authentication errors: Confirm backend service is running and OAuth consent flow completes.
- Tab context resolution: When using @mentions, verify tab query results and fallback to active tab.
- Storage sync: Listen to browser.storage.onChanged for immediate UI updates.

## Conclusion
The extension combines a React side panel with a reliable background and content script architecture. It supports real-time agent execution via WebSocket, secure authentication with Google OAuth, flexible settings management, and smooth page automation. Following the guidelines in this page will help extend and maintain the system effectively across browsers.

## Appendices

### Manifest and permissions
- Permissions include activeTab, tabs, storage, scripting, identity, sidePanel, webNavigation, webRequest, cookies, bookmarks, history, clipboard, notifications, contextMenus, downloads.
- Host permissions grant access to all URLs.

### Cross-Browser compatibility
- Uses browser.identity and browser.storage APIs compatible with Chromium-based browsers.
- Content script injection uses browser.scripting.executeScript.
- Consider polyfills or feature detection for Firefox-specific differences if extending support.

### Development examples
- Initialize side panel entrypoint and React root:
  - `main.tsx`
- Execute an agent command:
  - `AgentExecutor.handleExecute`
- Send action to active tab:
  - `background.handleExecuteAction`
- Connect to WebSocket:
  - `websocket-client.connect`
