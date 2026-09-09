# Component interactions and data flow

## Introduction
This page explains how the browser extension, backend API, MCP server, and external services interact to deliver a smooth agentic browsing experience. It focuses on:
- Communication patterns between the React UI, background/content scripts, WebSocket client, backend API, and external services
- Real-time data synchronization via WebSocket and HTTP fallback
- Asynchronous flows for agent execution, tool invocation, and browser automation
- Error propagation, state management, and consistency across components
- Performance, caching, and fault tolerance strategies

## Project structure
The system is organized into:
- Extension (React UI, background script, content script, WebSocket client, utilities)
- Backend API (FastAPI app, routers, services, models)
- Agents and tools (LangGraph-based React agent, tool registry)
- MCP server (external service integration)

```mermaid
graph TB
subgraph "Extension"
UI["AgentExecutor.tsx<br/>Side Panel UI"]
WS["websocket-client.ts<br/>WebSocket Client"]
BG["background.ts<br/>Background Script"]
CT["content.ts<br/>Content Script"]
EXA["executeAgent.ts<br/>HTTP Execution"]
EXB["executeActions.ts<br/>Browser Actions"]
PARSE["parseAgentCommand.ts<br/>Command Parser"]
end
subgraph "Backend API"
API["main.py<br/>FastAPI App"]
RUN["run.py<br/>Uvicorn Runner"]
end
subgraph "Agents & Tools"
REACT["react_agent.py<br/>LangGraph Agent"]
end
UI --> WS
UI --> EXA
UI --> PARSE
WS --> API
EXA --> API
BG --> CT
EXB --> BG
API --> REACT
```

## Core components
- WebSocket client encapsulates connection lifecycle, event handling, and agent execution over WebSocket with automatic reconnection.
- Side panel UI manages user input, command parsing, progress updates, and browser storage-backed sessions.
- Background script handles cross-tab automation, content script injection, and runtime messaging.
- Content script provides page context and executes DOM-level actions.
- HTTP execution utility builds payloads, captures page context, and invokes backend endpoints.
- Backend API exposes routers for agents, tools, and services; runs on Uvicorn.
- React agent orchestrates LLM reasoning and tool execution via LangGraph.

## Architecture overview
The system supports two primary execution modes:
- Real-time via WebSocket: UI emits commands; backend streams progress and returns results.
- HTTP fallback: UI sends commands via HTTP; backend responds with completion.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "AgentExecutor.tsx"
participant WS as "websocket-client.ts"
participant BG as "background.ts"
participant CT as "content.ts"
participant API as "main.py"
participant REACT as "react_agent.py"
User->>UI : Enter command
UI->>UI : parseAgentCommand()
alt WebSocket connected
UI->>WS : executeAgent(command, onProgress)
WS->>API : emit "execute_agent" {command}
API->>REACT : run_react_agent(messages)
REACT-->>API : streaming tool calls
API-->>WS : "generation_progress" events
WS-->>UI : onProgress updates
API-->>WS : "agent_result" or "agent_error"
WS-->>UI : resolve/reject
else HTTP fallback
UI->>BG : fetch skills / upload / execute agent
BG->>CT : inject and send PERFORM_ACTION
UI->>API : POST /api/... with payload
API->>REACT : run_react_agent(messages)
REACT-->>API : final answer
API-->>UI : JSON response
end
```

## Detailed component analysis

### WebSocket client and real-time execution
- Establishes persistent connections with automatic reconnection and transport fallback.
- Emits connection status and generation progress events.
- Provides executeAgent, stopAgent, and stats APIs with timeouts and cleanup.

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
+stopAgent() Promise
+getStats() Promise
+disconnect()
+connectSocket()
+enableAutoConnect()
+disableAutoConnect()
}
```

### Side panel UI and command parsing
- Parses slash commands into agent/action endpoints and validates availability.
- Manages sessions, voice input, file attachments, and mention menus.
- Streams progress updates and renders Markdown responses.

```mermaid
flowchart TD
Start(["User enters command"]) --> Parse["parseAgentCommand()"]
Parse --> Stage{"Stage"}
Stage --> |agent_select| SuggestAgents["Show agent suggestions"]
Stage --> |action_select| SuggestActions["Show action suggestions"]
Stage --> |complete| BuildPayload["Build payload and execute"]
BuildPayload --> WSMode{"WebSocket connected?"}
WSMode --> |Yes| WSExec["wsClient.executeAgent()"]
WSMode --> |No| HTTPExec["executeAgent() via HTTP"]
WSExec --> Progress["Update progress"]
HTTPExec --> Result["Render result"]
Progress --> Result
```

### HTTP execution pipeline
- Resolves active or mentioned tab context, captures client HTML, normalizes URLs, and constructs payloads.
- Supports special endpoints (React agent, YouTube, website, GitHub, PyJIIT, skills).
- Uses GET/POST based on endpoint and returns structured responses.

```mermaid
sequenceDiagram
participant UI as "AgentExecutor.tsx"
participant EXA as "executeAgent.ts"
participant BG as "background.ts"
participant API as "main.py"
participant REACT as "react_agent.py"
UI->>EXA : executeAgent(fullCommand, prompt, chatHistory, attachedFile)
EXA->>EXA : Resolve tab context + capture HTML
EXA->>EXA : Build payload per endpoint
alt WebSocket mode
EXA->>API : POST /api/... (payload)
else HTTP mode
EXA->>BG : Runtime message (if needed)
BG->>API : HTTP request
end
API->>REACT : run_react_agent(messages)
REACT-->>API : final answer
API-->>EXA : JSON response
EXA-->>UI : result
```

### Browser automation and content scripts
- Background script injects content scripts and routes actions to active tabs.
- Content script performs DOM-level actions (click, type, scroll) and page info extraction.
- Action executor translates agent action plans into tab messages.

```mermaid
sequenceDiagram
participant UI as "AgentExecutor.tsx"
participant BG as "background.ts"
participant CT as "content.ts"
participant TAB as "Target Tab"
UI->>BG : EXECUTE_ACTION {action}
BG->>TAB : scripting.executeScript(files)
BG->>TAB : tabs.sendMessage {type : "PERFORM_ACTION", action}
TAB->>CT : performAction(action)
CT-->>TAB : result
TAB-->>BG : response
BG-->>UI : result
```

### Backend API and agent orchestration
- FastAPI app aggregates routers for agents, tools, and services.
- Uvicorn runner starts the server on a configurable host/port.
- React agent compiles a LangGraph workflow and executes tool calls asynchronously.

```mermaid
graph TB
API["main.py"] --> Routers["Routers: agent, react, website, youtube, upload, skills"]
API --> App["FastAPI App"]
App --> Uvicorn["run.py: uvicorn.run()"]
App --> REACT["react_agent.py: run_react_agent()"]
```

## Dependency analysis
- UI depends on WebSocket client and HTTP execution utility.
- Background script depends on content script and browser APIs.
- HTTP execution utility depends on browser storage, tabs, and scripting APIs.
- Backend API depends on routers and the React agent.
- React agent depends on LLM and tool registry.

```mermaid
graph LR
UI["AgentExecutor.tsx"] --> WS["websocket-client.ts"]
UI --> EXA["executeAgent.ts"]
UI --> PARSE["parseAgentCommand.ts"]
EXA --> BG["background.ts"]
BG --> CT["content.ts"]
API["main.py"] --> REACT["react_agent.py"]
WS --> API
EXA --> API
```

## Performance considerations
- WebSocket streaming reduces latency for long-running agent executions; HTTP fallback ensures reliability when WebSocket is unavailable.
- Payload construction captures minimal client HTML and limits DOM introspection to reduce overhead.
- Action executor introduces small delays between actions to prevent race conditions and improve stability.
- Caching: React agent graph is cached via LRU to avoid recompilation costs.
- Recommendations:
  - Prefer WebSocket for interactive sessions; degrade gracefully to HTTP.
  - Limit DOM capture size and scope; avoid unnecessary reflows.
  - Batch browser actions and debounce UI updates.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- WebSocket connectivity:
  - Monitor connection_status events and fallback to HTTP when disconnected.
  - Use getStats with timeout to detect backend responsiveness.
- Command parsing:
  - Ensure slash commands are complete; partial suggestions guide users.
- Browser automation:
  - Verify content script injection and tab permissions.
  - Handle unknown action types and timeouts during navigation/reload.
- HTTP errors:
  - Normalize error messages for rate limits, gateway errors, and service unavailability.
- Storage and sessions:
  - Persist sessions in browser storage; migrate legacy chat history if needed.

## Conclusion
The system integrates a React-based UI, background/content scripts, WebSocket streaming, and a FastAPI backend with a LangGraph-powered agent. It balances real-time responsiveness with reliable HTTP fallback, manages state across browser storage and UI components, and provides clear error propagation and recovery paths. By using caching, minimal payload construction, and cautious automation, it maintains performance and reliability across distributed components.
