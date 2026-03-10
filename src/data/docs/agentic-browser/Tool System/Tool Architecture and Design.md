# Tool Architecture and Design

<cite>
**Referenced Files in This Document**
- [react_tools.py](file://agents/react_tools.py)
- [react_agent.py](file://agents/react_agent.py)
- [tool.py](file://tools/browser_use/tool.py)
- [browser_use_service.py](file://services/browser_use_service.py)
- [prompts/browser_use.py](file://prompts/browser_use.py)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py)
- [seach_agent.py](file://tools/google_search/seach_agent.py)
- [create_calender_events.py](file://tools/calendar/create_calender_events.py)
- [get_calender_events.py](file://tools/calendar/get_calender_events.py)
- [fetch_latest_mails.py](file://tools/gmail/fetch_latest_mails.py)
- [send_email.py](file://tools/gmail/send_email.py)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts)
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
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the Tool System architecture and design patterns used in the project. It focuses on the structured tool interface built with LangChain’s StructuredTool, the tool registration and discovery mechanisms, standardized input/output schemas, the tool execution pipeline, error handling patterns, and asynchronous operation support. It also covers the tool discovery system, dependency injection patterns, and integration with the agent framework. Finally, it provides guidelines for designing tool interfaces, validation schemas, return value formatting, testing strategies, performance optimization, lifecycle management, resource cleanup, and debugging approaches.

## Project Structure
The tool system is organized around:
- Agent orchestration and tool registration in Python
- Tool implementations under tools/ grouped by domain
- Services that encapsulate external integrations
- Prompts and sanitization utilities for structured outputs
- Frontend integration utilities that prepare payloads and dispatch requests

```mermaid
graph TB
subgraph "Agent Layer"
RA["react_agent.py"]
RT["react_tools.py"]
end
subgraph "Tools"
BT["tools/browser_use/tool.py"]
GST["tools/google_search/seach_agent.py"]
GCAL_GET["tools/calendar/get_calender_events.py"]
GCAL_CREATE["tools/calendar/create_calender_events.py"]
GM_FETCH["tools/gmail/fetch_latest_mails.py"]
GM_SEND["tools/gmail/send_email.py"]
end
subgraph "Services"
BUS["services/browser_use_service.py"]
end
subgraph "Prompts & Utils"
PB["prompts/browser_use.py"]
AS["utils/agent_sanitizer.py"]
end
subgraph "Frontend"
EAT["extension/entrypoints/utils/executeAgent.ts"]
end
RA --> RT
RT --> BT
RT --> GST
RT --> GCAL_GET
RT --> GCAL_CREATE
RT --> GM_FETCH
RT --> GM_SEND
BT --> BUS
BUS --> PB
BUS --> AS
EAT --> RA
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L138-L175)
- [react_tools.py](file://agents/react_tools.py#L609-L702)
- [tool.py](file://tools/browser_use/tool.py#L1-L49)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L138)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)
- [seach_agent.py](file://tools/google_search/seach_agent.py#L14-L63)
- [get_calender_events.py](file://tools/calendar/get_calender_events.py#L6-L23)
- [create_calender_events.py](file://tools/calendar/create_calender_events.py#L6-L41)
- [fetch_latest_mails.py](file://tools/gmail/fetch_latest_mails.py#L4-L42)
- [send_email.py](file://tools/gmail/send_email.py#L20-L31)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L17-L298)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L1-L191)
- [react_tools.py](file://agents/react_tools.py#L1-L721)
- [tool.py](file://tools/browser_use/tool.py#L1-L49)
- [browser_use_service.py](file://services/browser_use_service.py#L1-L96)
- [prompts/browser_use.py](file://prompts/browser_use.py#L1-L138)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [seach_agent.py](file://tools/google_search/seach_agent.py#L1-L84)
- [get_calender_events.py](file://tools/calendar/get_calender_events.py#L1-L52)
- [create_calender_events.py](file://tools/calendar/create_calender_events.py#L1-L70)
- [fetch_latest_mails.py](file://tools/gmail/fetch_latest_mails.py#L1-L61)
- [send_email.py](file://tools/gmail/send_email.py#L1-L52)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L1-L299)

## Core Components
- StructuredTool wrappers: Tools are defined as StructuredTool instances with a coroutine and a Pydantic args_schema. They expose a standardized interface to the agent.
- Tool registry and discovery: A builder function constructs tools dynamically based on runtime context (e.g., presence of tokens or session payloads).
- Asynchronous execution: Tools are async coroutines; blocking operations are offloaded to threads to keep the event loop responsive.
- Validation and normalization: Pydantic models define strict input schemas; outputs are normalized to strings or structured JSON and sanitized when needed.
- Integration with agent framework: Tools are bound to the LLM, and LangGraph orchestrates tool invocation and message passing.

Key implementation references:
- StructuredTool creation and schemas: [react_tools.py](file://agents/react_tools.py#L61-L210), [react_tools.py](file://agents/react_tools.py#L524-L606)
- Tool builder and context injection: [react_tools.py](file://agents/react_tools.py#L609-L702)
- Async tool execution patterns: [react_tools.py](file://agents/react_tools.py#L217-L522)
- Agent graph and tool binding: [react_agent.py](file://agents/react_agent.py#L123-L175)
- Browser action tool and service: [tool.py](file://tools/browser_use/tool.py#L27-L48), [browser_use_service.py](file://services/browser_use_service.py#L11-L96)
- Prompt and sanitizer for structured outputs: [prompts/browser_use.py](file://prompts/browser_use.py#L5-L138), [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L61-L606)
- [react_tools.py](file://agents/react_tools.py#L609-L702)
- [react_tools.py](file://agents/react_tools.py#L217-L522)
- [react_agent.py](file://agents/react_agent.py#L123-L175)
- [tool.py](file://tools/browser_use/tool.py#L27-L48)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L138)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

## Architecture Overview
The tool system integrates frontend, backend, and external APIs through a consistent pattern:
- Frontend composes tool payloads and dispatches requests to backend endpoints.
- Backend agents bind tools to the LLM and route tool calls through LangGraph.
- Tools execute asynchronously, delegating blocking work to threads and returning normalized results.
- Services encapsulate domain-specific logic and prompt-driven generation when needed.
- Validation ensures inputs conform to schemas and outputs meet expectations.

```mermaid
sequenceDiagram
participant FE as "Frontend (executeAgent.ts)"
participant API as "Backend API"
participant Agent as "React Agent (react_agent.py)"
participant Tools as "Tool Registry (react_tools.py)"
participant Service as "Service (browser_use_service.py)"
participant Ext as "External API"
FE->>API : "POST /api/... with tool payload"
API->>Agent : "Invoke compiled graph with messages"
Agent->>Tools : "Bind tools and decide next step"
Tools->>Service : "Execute tool coroutine"
Service->>Ext : "Call external API or compute"
Ext-->>Service : "Response"
Service-->>Tools : "Normalized result"
Tools-->>Agent : "ToolMessage with result"
Agent-->>API : "Final LLM response"
API-->>FE : "JSON response"
```

**Diagram sources**
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L17-L298)
- [react_agent.py](file://agents/react_agent.py#L123-L175)
- [react_tools.py](file://agents/react_tools.py#L609-L702)
- [tool.py](file://tools/browser_use/tool.py#L27-L48)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)

## Detailed Component Analysis

### StructuredTool Interface and Schemas
- Each tool defines a Pydantic BaseModel schema that validates inputs and documents fields.
- Tools are wrapped as StructuredTool with a coroutine implementing the async logic.
- Standardized return values are normalized to strings or structured JSON.

Examples of schemas and tools:
- GitHub tool input schema and tool: [GitHubToolInput](file://agents/react_tools.py#L61-L68), [github_agent](file://agents/react_tools.py#L524-L529)
- Web search tool input schema and tool: [WebSearchToolInput](file://agents/react_tools.py#L70-L78), [websearch_agent](file://agents/react_tools.py#L531-L536)
- Website tool input schema and tool: [WebsiteToolInput](file://agents/react_tools.py#L80-L87), [website_agent](file://agents/react_tools.py#L538-L544)
- YouTube tool input schema and tool: [YouTubeToolInput](file://agents/react_tools.py#L89-L96), [youtube_agent](file://agents/react_tools.py#L545-L550)
- Gmail tools (fetch, send, list unread, mark read) with schemas and tools: [GmailToolInput](file://agents/react_tools.py#L98-L112), [GmailSendEmailInput](file://agents/react_tools.py#L114-L125), [GmailListUnreadInput](file://agents/react_tools.py#L127-L141), [GmailMarkReadInput](file://agents/react_tools.py#L143-L156), [gmail_* tools](file://agents/react_tools.py#L553-L582)
- Calendar tools (fetch, create) with schemas and tools: [CalendarToolInput](file://agents/react_tools.py#L158-L172), [CalendarCreateEventInput](file://agents/react_tools.py#L174-L199), [calendar_* tools](file://agents/react_tools.py#L585-L599)
- PyJIIT attendance tool schema and tool: [PyjiitAttendanceInput](file://agents/react_tools.py#L201-L210), [pyjiit_agent](file://agents/react_tools.py#L601-L606)
- Browser action tool schema and tool: [BrowserActionInput](file://tools/browser_use/tool.py#L12-L25), [browser_action_agent](file://tools/browser_use/tool.py#L43-L48)

Validation and normalization helpers:
- Ensures text or JSON output: [_ensure_text](file://agents/react_tools.py#L35-L45)
- Formats chat history for prompts: [_format_chat_history](file://agents/react_tools.py#L47-L59)

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L61-L210)
- [react_tools.py](file://agents/react_tools.py#L524-L606)
- [react_tools.py](file://agents/react_tools.py#L35-L59)
- [tool.py](file://tools/browser_use/tool.py#L12-L25)
- [tool.py](file://tools/browser_use/tool.py#L43-L48)

### Tool Registration and Discovery Mechanism
- Central registry: [AGENT_TOOLS](file://agents/react_tools.py#L702) and [build_agent_tools](file://agents/react_tools.py#L609-L702) assemble tools based on context.
- Conditional inclusion: Tools requiring credentials (e.g., Gmail, Calendar, PyJIIT) are added only when context supplies tokens/payloads.
- Dependency injection: Partial functions inject default tokens/payloads into tool coroutines.

```mermaid
flowchart TD
Start(["build_agent_tools(context)"]) --> ReadCtx["Read google_access_token<br/>and pyjiit_login_response"]
ReadCtx --> BaseTools["Add core tools:<br/>github, websearch, website, youtube,<br/>browser_action"]
BaseTools --> HasGoogle{"Has google_access_token?"}
HasGoogle --> |Yes| AddGmail["Add Gmail tools with default token"]
HasGoogle --> |No| SkipGmail["Skip Gmail tools"]
AddGmail --> HasPyjiit{"Has pyjiit_login_response?"}
SkipGmail --> HasPyjiit
HasPyjiit --> |Yes| AddPyjiit["Add PyJIIT tool with default payload"]
HasPyjiit --> |No| SkipPyjiit["Skip PyJIIT tool"]
AddPyjiit --> Done(["Return tools list"])
SkipPyjiit --> Done
```

**Diagram sources**
- [react_tools.py](file://agents/react_tools.py#L609-L702)

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L609-L702)

### Tool Execution Pipeline
- Agent graph: [GraphBuilder](file://agents/react_agent.py#L138-L175) compiles a StateGraph with an agent node and a ToolNode.
- Tool binding: [_create_agent_node](file://agents/react_agent.py#L123-L136) binds tools to the LLM.
- Message conversion: [_payload_to_langchain](file://agents/react_agent.py#L61-L78) and [_langchain_to_payload](file://agents/react_agent.py#L80-L121) normalize payloads between the agent and LangChain message types.

```mermaid
sequenceDiagram
participant Agent as "Agent"
participant LLM as "LLM Client"
participant Tools as "ToolNode"
participant Tool as "StructuredTool Coroutine"
Agent->>LLM : "Invoke with messages"
LLM-->>Agent : "AIMessage with tool_calls"
Agent->>Tools : "Dispatch tool_calls"
Tools->>Tool : "Call coroutine with validated args"
Tool-->>Tools : "Return normalized result"
Tools-->>Agent : "ToolMessage"
Agent-->>Agent : "Append ToolMessage and continue"
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L123-L175)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L123-L175)

### Asynchronous Operations and Blocking Work
- Async coroutines: Tools are async; blocking I/O is executed in threads using [asyncio.to_thread](file://agents/react_tools.py#L229-L235, file://agents/react_tools.py#L295-L297, file://agents/react_tools.py#L350-L351, file://agents/react_tools.py#L429-L430).
- Service-level async: [AgentService.generate_script](file://services/browser_use_service.py#L12-L18) runs LLM chains asynchronously and sanitizes results.

Guidelines:
- Keep coroutines non-blocking; offload network/API calls to threads.
- Wrap external calls with try/except and return user-friendly error strings.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L217-L522)
- [browser_use_service.py](file://services/browser_use_service.py#L12-L18)

### Error Handling Patterns
- Input validation: Pydantic schemas enforce required fields and constraints.
- Runtime error handling: Tools catch exceptions and return informative messages.
- Output sanitization: For browser action generation, [sanitize_json_actions](file://utils/agent_sanitizer.py#L20-L96) validates JSON structure and action semantics.

Common patterns:
- Token checks before invoking external APIs.
- Graceful fallbacks when no results are found.
- Logging and returning structured errors for downstream handling.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L279-L301)
- [react_tools.py](file://agents/react_tools.py#L334-L356)
- [react_tools.py](file://agents/react_tools.py#L402-L436)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

### Tool Discovery and Dependency Injection
- Discovery: [build_agent_tools](file://agents/react_tools.py#L609-L702) builds a tool list from a context dictionary.
- Injection: Default values are injected via partial functions to avoid requiring repeated arguments in tool calls.

Best practices:
- Pass credentials and session data through context rather than hardcoding.
- Keep tool constructors pure; defer side effects to coroutines.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L609-L702)

### Integration with the Agent Framework
- LangGraph workflow: [GraphBuilder.buildgraph](file://agents/react_agent.py#L154-L170) wires agent and tool nodes.
- ToolNode: Executes StructuredTool coroutines and posts ToolMessages back to the graph.
- Message normalization: Converts between application payloads and LangChain message types.

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L138-L175)

### Browser Action Tool and Service
- Tool schema: [BrowserActionInput](file://tools/browser_use/tool.py#L12-L25)
- Tool coroutine: [browser_action_agent](file://tools/browser_use/tool.py#L43-L48)
- Service: [AgentService.generate_script](file://services/browser_use_service.py#L11-L96) builds a prompt with DOM info and invokes an LLM chain.
- Prompt template: [SCRIPT_PROMPT](file://prompts/browser_use.py#L5-L138)
- Sanitization: [sanitize_json_actions](file://utils/agent_sanitizer.py#L20-L96) validates generated JSON action plans.

```mermaid
classDiagram
class BrowserActionInput {
+string goal
+string target_url
+dict dom_structure
+dict constraints
}
class AgentService {
+generate_script(goal, target_url, dom_structure, constraints) dict
}
class SCRIPT_PROMPT {
+ChatPromptTemplate
}
BrowserActionInput <.. AgentService : "validated input"
AgentService --> SCRIPT_PROMPT : "uses"
AgentService --> sanitize_json_actions : "validates output"
```

**Diagram sources**
- [tool.py](file://tools/browser_use/tool.py#L12-L48)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L138)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

**Section sources**
- [tool.py](file://tools/browser_use/tool.py#L12-L48)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L138)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

### External Tool Implementations
- Web search: [web_search_pipeline](file://tools/google_search/seach_agent.py#L14-L63) wraps Tavily search and normalizes results.
- Calendar (fetch): [get_calendar_events](file://tools/calendar/get_calender_events.py#L6-L23)
- Calendar (create): [create_calendar_event](file://tools/calendar/create_calender_events.py#L6-L41)
- Gmail (fetch): [get_latest_emails](file://tools/gmail/fetch_latest_mails.py#L4-L42)
- Gmail (send): [send_email](file://tools/gmail/send_email.py#L20-L31)

These tools are invoked asynchronously and return normalized JSON or strings.

**Section sources**
- [seach_agent.py](file://tools/google_search/seach_agent.py#L14-L63)
- [get_calender_events.py](file://tools/calendar/get_calender_events.py#L6-L23)
- [create_calender_events.py](file://tools/calendar/create_calender_events.py#L6-L41)
- [fetch_latest_mails.py](file://tools/gmail/fetch_latest_mails.py#L4-L42)
- [send_email.py](file://tools/gmail/send_email.py#L20-L31)

### Frontend Integration Payload Construction
- [executeAgent](file://extension/entrypoints/utils/executeAgent.ts#L17-L298) prepares tool-specific payloads, resolves active tab context, captures DOM when needed, and dispatches HTTP requests to backend endpoints.

Patterns:
- Extract explicit URLs from prompts for tools that require a URL.
- Inject tokens/session data from browser storage.
- Normalize payloads for different endpoints.

**Section sources**
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L17-L298)

## Dependency Analysis
The tool system exhibits low coupling and high cohesion:
- Tools depend on services and external APIs but remain thin wrappers around coroutines.
- Services encapsulate domain logic and prompt composition.
- Agents depend on tools via LangChain abstractions, enabling easy swapping and extension.

```mermaid
graph LR
RT["react_tools.py"] --> RTB["build_agent_tools"]
RTB --> SA["StructuredTool instances"]
SA --> Cor["Coroutine implementations"]
Cor --> Svc["services/*"]
Svc --> Ext["External APIs"]
RA["react_agent.py"] --> SA
EAT["executeAgent.ts"] --> RA
```

**Diagram sources**
- [react_tools.py](file://agents/react_tools.py#L609-L702)
- [react_agent.py](file://agents/react_agent.py#L123-L175)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L17-L298)

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L609-L702)
- [react_agent.py](file://agents/react_agent.py#L123-L175)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L17-L298)

## Performance Considerations
- Offload blocking operations: Use [asyncio.to_thread](file://agents/react_tools.py#L229-L235) for network/API calls to prevent blocking the event loop.
- Limit payload sizes: Browser action tools cap interactive elements and truncate long text to manage token usage.
- Respect rate limits: External APIs (e.g., Gmail, Calendar) set timeouts; consider retry/backoff strategies in future enhancements.
- Caching: The agent graph is cached via [lru_cache](file://agents/react_agent.py#L178-L180) to avoid recompilation overhead.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Missing credentials: Tools that require tokens return explicit messages when tokens are absent. Provide tokens via context or storage.
- Empty results: Some tools return “No results found” or “No unread messages found.” Verify inputs and external service availability.
- Validation failures: For browser actions, sanitization may fail if the LLM output is malformed. Review prompt instructions and ensure JSON-only output.
- Network errors: External API calls may fail due to transient conditions. Wrap calls with retries and log exceptions for diagnostics.

Debugging tips:
- Log tool inputs and outputs using the project’s logger.
- Inspect ToolMessages posted back to the agent to trace execution.
- Validate schemas locally using Pydantic models before invoking tools.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L279-L301)
- [react_tools.py](file://agents/react_tools.py#L334-L356)
- [react_tools.py](file://agents/react_tools.py#L402-L436)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

## Conclusion
The tool system leverages LangChain’s StructuredTool to provide a consistent, validated interface for diverse capabilities. Tools are registered dynamically based on context, executed asynchronously with robust error handling, and integrated seamlessly into the agent graph. Services encapsulate domain logic and prompt-driven generation, while frontend utilities prepare payloads and coordinate with the backend. This architecture supports extensibility, maintainability, and safe, predictable behavior across heterogeneous integrations.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Guidelines for Tool Interface Design
- Define a Pydantic BaseModel schema per tool with clear descriptions and constraints.
- Keep coroutines free of blocking I/O; use asyncio.to_thread for network/API calls.
- Normalize outputs to strings or structured JSON; use helper functions to ensure consistent formatting.
- Validate inputs early and return actionable error messages.
- Encapsulate external logic in services to promote testability and reuse.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L35-L59)
- [react_tools.py](file://agents/react_tools.py#L217-L522)

### Testing Strategies
- Unit tests for schemas: Validate required fields, constraints, and edge cases using Pydantic.
- Integration tests for tools: Mock external APIs and assert normalized outputs.
- Agent tests: Simulate tool invocation via ToolNode and verify ToolMessage handling.
- End-to-end tests: Use executeAgent.ts to drive real payloads and confirm end-to-end flows.

[No sources needed since this section provides general guidance]

### Performance Optimization Techniques
- Use thread pools for blocking operations; avoid synchronous network calls in coroutines.
- Limit and truncate payloads (e.g., interactive elements count and text length).
- Cache compiled agent graphs and frequently used resources.
- Apply timeouts and retries for external API calls.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L217-L522)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)

### Tool Lifecycle Management and Resource Cleanup
- Tools are stateless; rely on injected context for credentials.
- Services may hold references to LLM clients; ensure proper initialization and reuse.
- For long-running agents, periodically rebuild tool lists when context changes.

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L609-L702)
- [browser_use_service.py](file://services/browser_use_service.py#L11-L96)

### Debugging Approaches for Tool Development
- Enable logging in tool coroutines and services.
- Inspect LangChain messages and ToolMessages to trace execution.
- Validate LLM outputs with sanitizers and adjust prompts accordingly.
- Use small, isolated test cases to reproduce issues quickly.

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L61-L121)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)