# Troubleshooting and FAQ

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [main.py](file://main.py)
- [pyproject.toml](file://pyproject.toml)
- [core/config.py](file://core/config.py)
- [core/llm.py](file://core/llm.py)
- [api/main.py](file://api/main.py)
- [mcp_server/server.py](file://mcp_server/server.py)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts)
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts)
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [FAQ](#faq)
10. [Conclusion](#conclusion)
11. [Appendices](#appendices)

## Introduction
This document provides comprehensive troubleshooting and FAQ guidance for Agentic Browser. It covers installation and setup issues, configuration errors, agent execution failures, browser extension problems, backend server issues, MCP protocol problems, extension communication failures, LLM provider integration challenges, authentication concerns, tool execution issues, performance tuning, memory optimization, browser automation debugging, and diagnostic techniques. It also outlines known limitations, workarounds, planned improvements, and community support resources.

## Project Structure
Agentic Browser comprises:
- A Python backend with two modes: API server and MCP server
- A FastAPI application exposing multiple routers for services
- An MCP server implementing tools for LLM generation, GitHub QA, and website content conversion
- A browser extension (React + WXT) with background and content scripts, WebSocket client, and sidepanel UI
- Core modules for configuration and LLM provider abstraction

```mermaid
graph TB
subgraph "Backend"
M["main.py<br/>CLI entrypoint"]
API["api/main.py<br/>FastAPI app"]
MCP["mcp_server/server.py<br/>MCP server"]
CFG["core/config.py<br/>Env & logging"]
LLM["core/llm.py<br/>Provider adapter"]
end
subgraph "Extension"
BG["background.ts<br/>background script"]
CT["content.ts<br/>content script"]
WS["websocket-client.ts<br/>WebSocket client"]
UI["sidepanel UI<br/>AgentExecutor.tsx"]
end
M --> API
M --> MCP
API --> LLM
MCP --> LLM
BG --> CT
UI --> WS
WS --> API
BG --> API
```

**Diagram sources**
- [main.py](file://main.py#L1-L58)
- [api/main.py](file://api/main.py#L1-L47)
- [mcp_server/server.py](file://mcp_server/server.py#L1-L139)
- [core/config.py](file://core/config.py#L1-L26)
- [core/llm.py](file://core/llm.py#L1-L215)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L1-L800)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L272-L484)

**Section sources**
- [README.md](file://README.md#L1-L185)
- [main.py](file://main.py#L1-L58)
- [api/main.py](file://api/main.py#L1-L47)
- [mcp_server/server.py](file://mcp_server/server.py#L1-L139)
- [core/config.py](file://core/config.py#L1-L26)
- [core/llm.py](file://core/llm.py#L1-L215)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L1-L800)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L272-L484)

## Core Components
- CLI entrypoint and mode selection
  - Supports running as API server or MCP server with interactive or non-interactive modes
  - Environment variables loaded via dotenv
  - See [main.py](file://main.py#L1-L58)

- Backend servers
  - API server: FastAPI app with routers for health, GitHub, website, YouTube, Google Search, Gmail, Calendar, PyJIIT, React agent, website validator, agent, and file upload
  - MCP server: Implements tools for LLM generation, GitHub QA, website markdown conversion, and error handling
  - See [api/main.py](file://api/main.py#L1-L47), [mcp_server/server.py](file://mcp_server/server.py#L1-L139)

- Configuration and logging
  - Reads environment variables for host, port, debug, and Google API key
  - Configures logging level and logger factory
  - See [core/config.py](file://core/config.py#L1-L26)

- LLM provider abstraction
  - Supports Google, OpenAI, Anthropic, Ollama, DeepSeek, OpenRouter
  - Validates provider availability, API keys, base URLs, and model names
  - Raises descriptive errors for misconfiguration
  - See [core/llm.py](file://core/llm.py#L1-L215)

- Extension
  - Background script handles messaging, tab operations, action execution, and agent tool execution
  - Content script provides page context helpers
  - WebSocket client manages connection to backend API and agent execution
  - Sidepanel UI formats responses and displays progress
  - See [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L1-L800), [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L1-L326), [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133), [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L272-L484)

**Section sources**
- [main.py](file://main.py#L1-L58)
- [api/main.py](file://api/main.py#L1-L47)
- [mcp_server/server.py](file://mcp_server/server.py#L1-L139)
- [core/config.py](file://core/config.py#L1-L26)
- [core/llm.py](file://core/llm.py#L1-L215)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L1-L800)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L1-L133)
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L272-L484)

## Architecture Overview
Agentic Browser integrates a browser extension with a Python backend. The extension communicates with the backend via WebSocket for agent execution and with the MCP server for tool invocations. The backend orchestrates LLM calls and service tools.

```mermaid
sequenceDiagram
participant User as "User"
participant Sidepanel as "Sidepanel UI"
participant WS as "WebSocketClient"
participant API as "FastAPI Server"
participant MCP as "MCP Server"
User->>Sidepanel : "Enter command"
Sidepanel->>WS : "executeAgent(command)"
WS->>API : "emit execute_agent {command}"
API-->>WS : "agent_progress x N"
API-->>WS : "agent_result or agent_error"
WS-->>Sidepanel : "progress updates"
WS-->>Sidepanel : "final result/error"
Note over Sidepanel,MCP : "Alternative : MCP tool invocation"
Sidepanel->>MCP : "call_tool(llm.generate, ...)"
MCP-->>Sidepanel : "tool result or error"
```

**Diagram sources**
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L61-L91)
- [api/main.py](file://api/main.py#L1-L47)
- [mcp_server/server.py](file://mcp_server/server.py#L83-L124)

## Detailed Component Analysis

### CLI and Mode Selection
Common issues:
- Missing or invalid mode argument
- Environment variables not loaded
- Port conflicts or host binding issues

Resolution steps:
- Verify mode selection: use explicit flags or respond to interactive prompt
- Confirm .env presence and required keys
- Check BACKEND_HOST and BACKEND_PORT values

**Section sources**
- [main.py](file://main.py#L11-L54)
- [core/config.py](file://core/config.py#L8-L11)

### Backend API Server
Common issues:
- Router inclusion errors
- Health endpoint not reachable
- Missing service dependencies

Resolution steps:
- Ensure all routers are imported and included with correct prefixes
- Test health endpoint
- Validate service dependencies and environment variables

**Section sources**
- [api/main.py](file://api/main.py#L14-L41)

### MCP Server
Common issues:
- Tool invocation failures
- Provider misconfiguration
- Tool schema mismatches

Resolution steps:
- Validate tool names and input schemas
- Confirm provider, model, and base URL parameters
- Inspect error responses returned by MCP server

**Section sources**
- [mcp_server/server.py](file://mcp_server/server.py#L16-L81)
- [mcp_server/server.py](file://mcp_server/server.py#L83-L124)
- [core/llm.py](file://core/llm.py#L78-L170)

### LLM Provider Integration
Common issues:
- Unsupported provider
- Missing API key or base URL
- Model name not provided or invalid
- Initialization failures

Resolution steps:
- Choose supported provider from the provider list
- Set required environment variables for API keys and base URLs
- Provide a valid model name or rely on defaults
- Review initialization error messages for guidance

**Section sources**
- [core/llm.py](file://core/llm.py#L21-L75)
- [core/llm.py](file://core/llm.py#L98-L155)
- [core/llm.py](file://core/llm.py#L159-L170)

### Extension Communication and Agent Execution
Common issues:
- WebSocket connection failures
- Background script message handling errors
- Content script injection failures
- Action execution timeouts or selector mismatches

Resolution steps:
- Verify VITE_API_URL and backend reachability
- Check background script logs for message type handling
- Ensure content script injection path is correct
- Validate action selectors and tab contexts

**Section sources**
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L17-L40)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L428-L449)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L541-L800)

### Browser Automation Actions
Common issues:
- Element not found selectors
- Content editable vs standard input handling
- Navigation/reload completion waits
- Tab/window control errors

Resolution steps:
- Use precise selectors and verify element presence
- Differentiate contenteditable and standard inputs
- Respect navigation/reload completion timeouts
- Validate tab IDs and window contexts

**Section sources**
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L691-L797)

### Sidepanel UI and Response Formatting
Common issues:
- HTML-like error messages
- Progress display inconsistencies
- Response formatting issues

Resolution steps:
- Parse and sanitize error messages for readability
- Accumulate progress events and render consistently
- Format nested data structures for user-friendly display

**Section sources**
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L272-L321)
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L455-L484)

### PyJIIT Service Exceptions
Common issues:
- API errors during service calls
- Login/session-related failures
- Account API errors

Resolution steps:
- Catch and propagate specific exception types
- Handle session expiration and re-authentication
- Log detailed error context for diagnostics

**Section sources**
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L22)

## Dependency Analysis
The backend depends on FastAPI, Uvicorn, LangChain/LangGraph, MCP, and various provider SDKs. The extension depends on Socket.IO client and React components. Ensure dependency versions align with project requirements.

```mermaid
graph LR
A["pyproject.toml<br/>dependencies"] --> B["FastAPI/Uvicorn"]
A --> C["LangChain/LangGraph"]
A --> D["MCP"]
A --> E["Provider SDKs"]
F["Extension deps<br/>Socket.IO client"] --> G["Sidepanel UI"]
```

**Diagram sources**
- [pyproject.toml](file://pyproject.toml#L7-L29)

**Section sources**
- [pyproject.toml](file://pyproject.toml#L1-L34)

## Performance Considerations
- Reduce unnecessary DOM queries and injections
- Batch navigation and tab operations
- Limit concurrent tool executions
- Monitor memory usage in long-running sessions
- Use caching for repeated website content conversions
- Optimize LLM calls with concise prompts and appropriate temperatures

## Troubleshooting Guide

### Installation and Setup
Symptoms:
- Missing dependencies or import errors
- CLI not recognizing modes
- Backend not starting

Resolution steps:
- Install dependencies per project requirements
- Verify Python version and virtual environment
- Confirm CLI usage and mode flags
- Check backend host/port configuration

**Section sources**
- [pyproject.toml](file://pyproject.toml#L6-L29)
- [main.py](file://main.py#L11-L54)
- [core/config.py](file://core/config.py#L8-L11)

### Configuration Errors
Symptoms:
- LLM initialization failures
- Missing API keys or base URLs
- Incorrect provider selection

Resolution steps:
- Validate provider and set required environment variables
- Provide model names or rely on defaults
- Review error messages for missing keys/base URLs

**Section sources**
- [core/llm.py](file://core/llm.py#L98-L155)

### Agent Execution Failures
Symptoms:
- WebSocket connection errors
- Agent execution timeouts
- Progress events not received

Resolution steps:
- Verify backend connectivity and URL
- Check agent execution lifecycle and error emissions
- Ensure proper event listeners and cleanup

**Section sources**
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L61-L91)
- [extension/entrypoints/sidepanel/AgentExecutor.tsx](file://extension/entrypoints/sidepanel/AgentExecutor.tsx#L455-L484)

### Browser Extension Issues
Symptoms:
- Background script message handling errors
- Content script injection failures
- Action execution errors

Resolution steps:
- Inspect background script logs for unknown message types
- Verify content script injection paths
- Validate action parameters and selectors

**Section sources**
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L428-L449)

### Backend Server Issues
Symptoms:
- API routes not found
- Health endpoint unreachable
- Router import errors

Resolution steps:
- Confirm router imports and prefixes
- Test health route independently
- Validate service dependencies

**Section sources**
- [api/main.py](file://api/main.py#L14-L41)

### MCP Protocol Problems
Symptoms:
- Tool invocation errors
- Schema mismatch errors
- Provider configuration errors

Resolution steps:
- Validate tool names and input schemas
- Check provider, model, and base URL parameters
- Inspect MCP server error responses

**Section sources**
- [mcp_server/server.py](file://mcp_server/server.py#L83-L124)
- [core/llm.py](file://core/llm.py#L98-L155)

### Extension Communication Failures
Symptoms:
- WebSocket disconnects
- No agent progress updates
- Connection status issues

Resolution steps:
- Verify VITE_API_URL and backend accessibility
- Check reconnection attempts and delays
- Monitor connection status events

**Section sources**
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L17-L40)

### Browser Automation Debugging
Symptoms:
- Element not found errors
- Selector mismatches
- Navigation/reload timeouts

Resolution steps:
- Use precise selectors and verify element presence
- Differentiate contenteditable and standard inputs
- Respect navigation/reload completion waits

**Section sources**
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L691-L797)

### LLM Provider Integration
Symptoms:
- Unsupported provider errors
- API key or base URL missing
- Model name invalid

Resolution steps:
- Choose supported provider
- Set required environment variables
- Provide valid model names

**Section sources**
- [core/llm.py](file://core/llm.py#L21-L75)
- [core/llm.py](file://core/llm.py#L121-L135)

### Service Authentication and Tool Execution
Symptoms:
- PyJIIT API errors
- Login/session failures
- Account API errors

Resolution steps:
- Catch and handle specific exception types
- Manage session expiration and re-authentication
- Log detailed error context

**Section sources**
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L22)

### Diagnostic Tools and Log Analysis
- Enable DEBUG logging for development
- Inspect background script console logs
- Capture WebSocket event sequences
- Review MCP tool invocation logs

**Section sources**
- [core/config.py](file://core/config.py#L16-L25)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L26-L36)

### Escalation Procedures
- Collect environment details and dependency versions
- Provide reproducible steps and logs
- Report issues with clear error messages and stack traces
- Engage community channels for support

## FAQ

### Setup and Installation
Q: How do I run the backend in API or MCP mode?
A: Use the CLI with explicit flags or interactive prompt. Ensure environment variables are loaded.

Q: What environment variables are required?
A: Configure host, port, debug, and provider-specific keys. See configuration module.

Q: How do I install dependencies?
A: Install Python dependencies as defined in project requirements.

**Section sources**
- [main.py](file://main.py#L11-L54)
- [core/config.py](file://core/config.py#L8-L18)
- [pyproject.toml](file://pyproject.toml#L7-L29)

### Configuration
Q: Which providers are supported?
A: Supported providers include Google, OpenAI, Anthropic, Ollama, DeepSeek, and OpenRouter.

Q: How do I configure API keys and base URLs?
A: Set environment variables for each provider and ensure base URLs are correct.

**Section sources**
- [core/llm.py](file://core/llm.py#L21-L75)

### Usage Patterns
Q: How do I execute agent commands via the extension?
A: Use the sidepanel to enter commands; the WebSocket client will execute and stream progress.

Q: How do I troubleshoot action execution failures?
A: Validate selectors, ensure content script injection, and check navigation completion.

**Section sources**
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L61-L91)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L541-L800)

### Limitations and Known Issues
- Some actions require explicit user approval in the extension UI
- Certain websites may block automation or require manual intervention
- Provider-specific rate limits and quotas apply

**Section sources**
- [README.md](file://README.md#L51-L59)

### Workarounds and Planned Improvements
- Use precise selectors for reliable automation
- Implement retry logic for transient network errors
- Plan for future improvements such as visual DOM debugger and offline retrieval

**Section sources**
- [README.md](file://README.md#L107-L114)

### Community Support and Reporting
- Contribute via fork and pull request
- Report issues with detailed logs and reproducible steps

**Section sources**
- [README.md](file://README.md#L117-L127)

## Conclusion
This guide consolidates troubleshooting strategies and FAQs for Agentic Browser across installation, configuration, backend servers, MCP protocol, extension communication, LLM providers, and browser automation. Use the diagnostic techniques and escalation procedures to resolve issues efficiently and contribute improvements to the project.

## Appendices

### Error Message Reference
- LLM initialization errors: indicate missing API keys, base URLs, or invalid model names
- MCP tool invocation errors: indicate schema mismatches or provider misconfiguration
- WebSocket connection errors: indicate backend unreachability or URL misconfiguration
- Background script message errors: indicate unsupported message types or missing handlers
- Action execution errors: indicate selector mismatches or navigation timeouts

**Section sources**
- [core/llm.py](file://core/llm.py#L159-L170)
- [mcp_server/server.py](file://mcp_server/server.py#L122-L124)
- [extension/entrypoints/utils/websocket-client.ts](file://extension/entrypoints/utils/websocket-client.ts#L37-L40)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L121-L128)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L691-L797)