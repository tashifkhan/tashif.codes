# Tool system

## Introduction
This page explains the Tool System architecture that powers modular agent capabilities. The system is built around a standardized tool interface, structured argument schemas, and a registration mechanism that dynamically composes tools based on runtime context. Tools encapsulate domain-specific functionality (e.g., browser automation, GitHub crawling, Gmail operations, calendar management, YouTube processing, website context extraction) and integrate smoothly with the agent runtime via LangChain's StructuredTool abstraction.

The Tool System emphasizes:
- Clear separation of concerns between tool definition, execution, and integration
- Strong input validation using Pydantic models
- Async-first execution patterns with thread pooling for blocking operations
- Extensibility through a simple interface and consistent registration workflow
- Reliable error handling and user-friendly messaging

## Project structure
The Tool System spans several layers:
- Tool definitions and registration live in the agent module
- Tool implementations reside under tools/<domain>
- Services orchestrate tool logic and external integrations
- Routers expose endpoints for direct API access
- Prompts and utilities support tool-specific workflows

```mermaid
graph TB
subgraph "Agent Layer"
RT["agents/react_tools.py"]
end
subgraph "Tools"
BT["tools/browser_use/tool.py"]
GC["tools/github_crawler/convertor.py"]
GS["tools/google_search/seach_agent.py"]
WC["tools/website_context/__init__.py"]
YU["tools/youtube_utils/__init__.py"]
end
subgraph "Services"
BUS["services/browser_use_service.py"]
GHS["services/github_service.py"]
GLS["services/gmail_service.py"]
end
subgraph "Routers"
GR["routers/github.py"]
GM["routers/gmail.py"]
CA["routers/calendar.py"]
YT["routers/youtube.py"]
end
RT --> BT
RT --> GC
RT --> GS
RT --> WC
RT --> YU
BT --> BUS
GC --> GHS
GS --> GS
WC --> WC
YU --> YU
GR --> GHS
GM --> GLS
CA --> CA
YT --> YT
```

## Core components
- Tool interface standard: Each tool is a StructuredTool with a typed Pydantic args_schema and a coroutine executor. Inputs are validated automatically; outputs are normalized to text or structured JSON.
- Registration mechanism: The agent builds a dynamic toolset from context (e.g., Google access tokens, PyJIIT session payloads). Tools are conditionally included to avoid unnecessary dependencies.
- Execution patterns: Tools run asynchronously; long-running or blocking operations are offloaded to threads to prevent blocking the event loop.
- Validation and sanitization: Tools normalize outputs and apply sanitization for generated JSON plans; routers validate inputs and enforce constraints.

Key implementation anchors:
- Tool registry and builders: `react_tools.py`
- Tool schemas and coroutines: `react_tools.py`
- Browser automation tool: `browser_use/tool.py`
- GitHub ingestion: `github_crawler/convertor.py`
- Web search pipeline: `google_search/seach_agent.py`
- Website context fetchers: `website_context/__init__.py`
- YouTube utilities: `youtube_utils/__init__.py`
- Gmail service: `services/gmail_service.py`
- Calendar router: `routers/calendar.py`
- YouTube router: `routers/youtube.py`

## Architecture overview
The Tool System follows a layered architecture:
- Agent layer defines tools and builds the toolset from context
- Tool layer implements domain-specific logic and integrates with services/utilities
- Service layer orchestrates external integrations and validations
- Router layer exposes endpoints for direct API access

```mermaid
graph TB
A["Agent Runtime<br/>agents/react_tools.py"] --> T1["Browser Tool<br/>tools/browser_use/tool.py"]
A --> T2["GitHub Tool<br/>tools/github_crawler/convertor.py"]
A --> T3["Web Search Tool<br/>tools/google_search/seach_agent.py"]
A --> T4["Website Tool<br/>tools/website_context/__init__.py"]
A --> T5["YouTube Tool<br/>tools/youtube_utils/__init__.py"]
T1 --> S1["Browser Use Service<br/>services/browser_use_service.py"]
T2 --> S2["GitHub Service<br/>services/github_service.py"]
T3 --> T3
T4 --> T4
T5 --> T5
R1["GitHub Router<br/>routers/github.py"] --> S2
R2["Gmail Router<br/>routers/gmail.py"] --> S3["Gmail Service<br/>services/gmail_service.py"]
R3["Calendar Router<br/>routers/calendar.py"] --> R3
R4["YouTube Router<br/>routers/youtube.py"] --> R4
```

## Detailed component analysis

### Tool interface standards
- StructuredTool: Each tool is a StructuredTool with a name, description, coroutine executor, and args_schema. Inputs are validated automatically by Pydantic.
- Args schemas: Define required fields, constraints (min/max values), and descriptions. Examples include GitHubToolInput, WebsiteToolInput, YouTubeToolInput, GmailToolInput, CalendarToolInput, and PyjiitAttendanceInput.
- Output normalization: Tools return either plain text or structured JSON. A helper ensures consistent stringification of outputs.

Implementation anchors:
- StructuredTool definitions and schemas: `react_tools.py`
- Output normalization helpers: `react_tools.py`

### Registration mechanisms
- Static toolset: AGENT_TOOLS provides a baseline set of tools (GitHub, web search, website, YouTube, browser automation).
- Dynamic toolset builder: build_agent_tools(context) adds Google and PyJIIT tools when credentials/payloads are present in context. It uses partial to inject default tokens/payloads into tool coroutines.

Implementation anchors:
- Static toolset and builder: `react_tools.py`

### Execution patterns
- Async-first design: Tools are coroutines. Long-running or blocking operations are executed in threads using asyncio.to_thread to avoid blocking the event loop.
- Example patterns:
  - Web search tool: bounded results and thread-offloaded pipeline invocation
  - Gmail tools: token validation and thread-offloaded operations
  - Calendar tools: ISO 8601 validation and thread-offloaded creation
  - Browser automation: service-based generation of JSON action plans with sanitization

Implementation anchors:
- Tool coroutines and thread offloading: `react_tools.py`
- Browser automation service: `browser_use_service.py`

### Browser automation tools
- Purpose: Generate a JSON action plan for browser tasks given a goal, target URL, DOM structure, and constraints.
- Implementation:
  - Tool schema defines goal, target_url, dom_structure, and constraints
  - Coroutine invokes AgentService.generate_script
  - Service composes a prompt, invokes an LLM, sanitizes the result, and returns structured action plan

```mermaid
sequenceDiagram
participant Agent as "Agent Runtime"
participant Tool as "Browser Tool"
participant Service as "AgentService"
participant LLM as "LLM"
Agent->>Tool : "Invoke with goal, target_url, dom_structure, constraints"
Tool->>Service : "generate_script(goal, target_url, dom_structure, constraints)"
Service->>LLM : "Invoke prompt with formatted DOM info"
LLM-->>Service : "Raw action plan"
Service->>Service : "Sanitize and validate JSON"
Service-->>Tool : "{ok, action_plan} or {ok : false, problems}"
Tool-->>Agent : "Normalized result"
```

### GitHub crawler tools
- Purpose: Convert a GitHub repository to markdown (tree, summary, content), then answer questions using a retrieval-augmented chain.
- Implementation:
  - URL normalization and ingestion (async/sync fallback)
  - Optional file attachment processing via Google AI SDK
  - LLM-based answer generation with chat history support

```mermaid
flowchart TD
Start(["Tool Entry"]) --> Normalize["Normalize GitHub URL"]
Normalize --> Ingest["Ingest repository (async/sync)"]
Ingest --> AttachCheck{"Attached file?"}
AttachCheck --> |Yes| Upload["Upload file to Google AI"]
Upload --> Compose["Compose contents with repo data and chat history"]
Compose --> GenAI["Generate content via Google AI"]
GenAI --> ReturnAI["Return AI response"]
AttachCheck --> |No| Chain["Build LLM chain with repo data"]
Chain --> Answer["Invoke chain with question and history"]
Answer --> ReturnText["Return LLM response"]
ReturnAI --> End(["Exit"])
ReturnText --> End
```

### Gmail integration tools
- Purpose: Fetch latest emails, list unread messages, mark messages as read, and send emails using OAuth access tokens.
- Implementation:
  - Service methods wrap tool functions and centralize error logging
  - Routers validate presence of access_token and enforce max result bounds

```mermaid
sequenceDiagram
participant Client as "Caller"
participant Router as "Gmail Router"
participant Service as "GmailService"
participant Tool as "Gmail Tools"
Client->>Router : "POST /gmail/latest {access_token, max_results}"
Router->>Router : "Validate inputs"
Router->>Service : "fetch_latest_messages(token, max_results)"
Service->>Tool : "get_latest_emails(token, max_results)"
Tool-->>Service : "Messages"
Service-->>Router : "Messages"
Router-->>Client : "{messages : ...}"
```

### Calendar management tools
- Purpose: Retrieve upcoming events and create new events using OAuth access tokens.
- Implementation:
  - Routers validate ISO 8601 timestamps and enforce max result bounds
  - Tools delegate to service-layer logic for event operations

```mermaid
sequenceDiagram
participant Client as "Caller"
participant Router as "Calendar Router"
participant Service as "CalendarService"
Client->>Router : "POST /calendar/create {access_token, summary, start_time, end_time}"
Router->>Router : "Validate ISO 8601 timestamps"
Router->>Service : "create_event(token, summary, start_time, end_time, description)"
Service-->>Router : "Event details"
Router-->>Client : "{result : created, event : ...}"
```

### YouTube processing utilities
- Purpose: Extract video IDs, fetch subtitles, and retrieve video info for downstream tooling.
- Implementation:
  - Utility functions exposed via __init__.py
  - Router answers questions about videos using YouTube service

```mermaid
flowchart TD
QStart(["Question + URL"]) --> Extract["Extract Video ID"]
Extract --> Info["Get Video Info"]
Extract --> Subs["Get Subtitle Content"]
Info --> Combine["Combine metadata + transcript"]
Subs --> Combine
Combine --> Answer["Answer via service/router"]
Answer --> QEnd(["Response"])
```

### Website context extraction tools
- Purpose: Convert HTML to markdown and fetch markdown for a given URL to enable question answering.
- Implementation:
  - Exposed via website_context/__init__.py
  - Used by website_agent tool to answer questions about a page

### Google search tool
- Purpose: Perform web search using Tavily and return summarized results.
- Implementation:
  - Pipeline sets max_results and maps Tavily response to expected format
  - Tool caps results and summarizes snippets for downstream use

### PyJIIT attendance tool
- Purpose: Fetch attendance data from the JIIT web portal using a session payload.
- Implementation:
  - Validates session payload and adapts to nested structures
  - Hardcoded semester mapping and regex parsing for subject codes
  - Runs blocking IO in a thread

## Dependency analysis
- Tool-to-service coupling:
  - Browser tool depends on AgentService for action plan generation
  - GitHub tool depends on GitHubService and ingestion utilities
  - Gmail tool depends on GmailService and tool functions
- Router-to-service coupling:
  - GitHub router depends on GitHubService
  - Gmail router depends on GmailService
  - Calendar router validates inputs and delegates to service logic
  - YouTube router depends on YouTube service
- External dependencies:
  - LangChain StructuredTool and TavilySearch
  - Pydantic for input validation
  - Optional Google AI SDK for file attachments

```mermaid
graph TB
RT["agents/react_tools.py"] --> BT["tools/browser_use/tool.py"]
RT --> GC["tools/github_crawler/convertor.py"]
RT --> GS["tools/google_search/seach_agent.py"]
RT --> WC["tools/website_context/__init__.py"]
RT --> YU["tools/youtube_utils/__init__.py"]
BT --> BUS["services/browser_use_service.py"]
GC --> GHS["services/github_service.py"]
GS --> GS
WC --> WC
YU --> YU
GR["routers/github.py"] --> GHS
GM["routers/gmail.py"] --> GLS["services/gmail_service.py"]
CA["routers/calendar.py"] --> CA
YT["routers/youtube.py"] --> YT
```

## Performance considerations
- Async execution: Use asyncio.to_thread for blocking operations to maintain responsiveness.
- Input bounding: Tools cap max_results and truncate content to fit model context windows.
- Token limits: Repository content is truncated to a safe upper bound to prevent context overflow.
- Prompt composition: Browser automation service limits interactive element listings to reduce token usage.
- External API throttling: Respect rate limits for external services (e.g., Tavily, Gmail, Calendar).

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing credentials:
  - Gmail/Calendar tools require access tokens; errors instruct providing tokens or include them in the tool call.
- Invalid input formats:
  - Calendar tools enforce ISO 8601 timestamps; GitHub router validates URL and question presence.
  - Web search tool bounds max_results; website tool trims summaries.
- External service failures:
  - GitHub ingestion handles invalid URLs and inaccessible repositories with user-friendly messages.
  - Gmail service logs exceptions and re-raises for router handling.
- Action plan validation:
  - Browser automation service returns validation problems and raw response for debugging.

## Conclusion
The Tool System provides a reliable, extensible framework for agent capabilities. By adhering to a consistent tool interface, strong input validation, and asynchronous execution patterns, it enables modular addition of new tools. The dynamic registration mechanism allows tools to adapt to runtime context, while routers and services ensure reliable integration with external systems.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Guidelines for creating custom tools
- Define a Pydantic args_schema with clear field descriptions and constraints
- Implement a coroutine executor that:
  - Validates inputs
  - Handles errors gracefully and returns user-friendly messages
  - Offloads blocking operations to threads when needed
- Wrap tool logic in a service if it interacts with external APIs
- Register the tool in the agent toolset and conditionally include it via build_agent_tools when appropriate
- Add a router endpoint if exposing the tool via API

[No sources needed since this section provides general guidance]

### Tool validation and error handling best practices
- Use Pydantic validators to enforce input constraints
- Normalize outputs consistently (strings or JSON)
- Log errors early and propagate meaningful messages
- For external APIs, handle common failure modes (invalid tokens, rate limits, timeouts)

[No sources needed since this section provides general guidance]

### Security considerations
- Never embed secrets in tool code; pass tokens via context or request parameters
- Validate and sanitize inputs to prevent injection attacks
- Limit tool capabilities to least privilege scopes
- Avoid printing sensitive data in logs

[No sources needed since this section provides general guidance]

### Resource management and debugging
- Use bounded max_results and content truncation to manage memory and compute
- Enable structured logging and return minimal diagnostic details in responses
- For browser automation, sanitize and validate generated JSON plans before returning

[No sources needed since this section provides general guidance]
