# Tool integration system

## Introduction
This page explains the tool integration system within the AI agent framework. It focuses on how tools are defined as StructuredTool instances, how the AGENT_TOOLS registry is constructed, how tools are selected and invoked via tools_condition, and how tool outputs are integrated back into the agent's message flow. It also covers tool registration, parameter validation, error handling, context management, and how to add new tools to the ecosystem.

## Project structure
The tool integration spans several layers:
- Agent orchestration and graph definition live in the agents module.
- Tools are defined in agents/react_tools.py and individual tool modules under tools/.
- The browser action tool bridges the agent to the extension's automation capabilities.
- The frontend extension constructs payloads and routes commands to backend APIs.
- Backend services compile the agent graph and execute tool workflows.

```mermaid
graph TB
subgraph "Frontend Extension"
EA["executeAgent.ts"]
AM["agent-map.ts"]
end
subgraph "Backend API"
RA_R["routers/react_agent.py"]
RA_S["services/react_agent_service.py"]
end
subgraph "Agent Runtime"
RA_P["agents/react_agent.py"]
RT["agents/react_tools.py"]
TN["langgraph ToolNode"]
end
subgraph "Tools"
BA["tools/browser_use/tool.py"]
GS["tools/google_search/seach_agent.py"]
WC["tools/website_context/html_md.py"]
BUS["services/browser_use_service.py"]
AS["utils/agent_sanitizer.py"]
end
EA --> AM
EA --> RA_R
RA_R --> RA_S
RA_S --> RA_P
RA_P --> TN
TN --> RT
RT --> BA
RT --> GS
RT --> WC
BA --> BUS
BUS --> AS
```

## Core components
- AGENT_TOOLS registry: A list of StructuredTool instances built dynamically from context. It includes core tools plus contextual tools (e.g., Gmail, Calendar, PyJIIT) when credentials are provided.
- Tool definitions: Each tool is a StructuredTool with a coroutine and a Pydantic args_schema for parameter validation.
- ToolNode execution pattern: LangGraph ToolNode executes tools and returns ToolMessage outputs that feed back into the agent.
- tools_condition: Conditional edge that routes the agent to ToolNode when tool_calls are predicted or when the agent decides to use tools.
- Context propagation: The agent receives credentials and optional page context via the service layer and passes them to the tool builder.

## Architecture overview
The system integrates frontend commands, backend orchestration, and tool execution into a cohesive pipeline.

```mermaid
sequenceDiagram
participant FE as "Extension Frontend"
participant API as "FastAPI Router"
participant SVC as "ReactAgentService"
participant G as "LangGraph Workflow"
participant AN as "Agent Node"
participant TN as "ToolNode"
participant TL as "Tools"
FE->>API : "POST /api/genai/react" with payload
API->>SVC : "generate_answer(question, context)"
SVC->>G : "compile(GraphBuilder(context))"
G->>AN : "invoke(messages)"
AN-->>G : "AIMessage(tool_calls?)"
alt "Has tool_calls"
G->>TN : "invoke(tool_calls)"
TN->>TL : "StructuredTool(coroutine)"
TL-->>TN : "ToolMessage(output)"
TN-->>G : "ToolMessage"
G->>AN : "continue loop"
else "No tool_calls"
G-->>SVC : "final AIMessage"
end
SVC-->>API : "answer"
API-->>FE : "response"
```

## Detailed component analysis

### AGENT_TOOLS registry and StructuredTool instances
- The registry is built by build_agent_tools(context) which:
  - Loads default tools (GitHub, web search, website, YouTube, browser action).
  - Conditionally adds Gmail and Calendar tools when a Google access token is present.
  - Conditionally adds PyJIIT tool when a login session payload is present.
- Each tool is a StructuredTool with:
  - name and description for LLM tool selection.
  - args_schema (Pydantic model) for input validation.
  - coroutine implementing the tool logic.

Examples of tool registration and validation:
- GitHub tool: Validates URL and question, converts repository to markdown, and queries a chain.
- Web search tool: Validates query and max_results bounds, runs Tavily search, and formats results.
- Website tool: Fetches page markdown and answers questions.
- YouTube tool: Uses transcript and metadata to answer questions.
- Gmail tools: Validate access tokens and enforce max result bounds; handle errors gracefully.
- Calendar tools: Validate time ranges and access tokens; handle errors gracefully.
- PyJIIT tool: Validates session payload and handles mapping of registration codes to IDs.
- Browser action tool: Accepts goal, target_url, DOM structure, and constraints; generates an action plan.

### Tool selection mechanism and agent decision flow
- The agent node binds the LLM to the available tools and generates an AIMessage that may include tool_calls.
- tools_condition routes to ToolNode when tool_calls are detected; otherwise it ends the loop.
- The ToolNode executes tools and returns ToolMessage outputs that include tool_call_id, enabling the agent to continue reasoning.

```mermaid
flowchart TD
Start(["Agent Node"]) --> CheckTC{"tool_calls present?"}
CheckTC --> |Yes| ToTool["Route to ToolNode"]
CheckTC --> |No| End(["End Loop"])
ToTool --> Exec["Execute StructuredTool"]
Exec --> Out["Produce ToolMessage"]
Out --> Back["Feed back to Agent Node"]
Back --> Start
```

### ToolNode execution pattern and message integration
- ToolNode executes the registered StructuredTool coroutines.
- Tool outputs are normalized to ToolMessage with tool_call_id so the agent can correlate tool results with the original tool_calls.
- The agent continues the loop until no further tool_calls are generated.

```mermaid
sequenceDiagram
participant AN as "Agent Node"
participant TN as "ToolNode"
participant T as "StructuredTool"
participant M as "ToolMessage"
AN->>TN : "AIMessage with tool_calls"
TN->>T : "coroutine(args)"
T-->>TN : "result"
TN-->>AN : "ToolMessage(tool_call_id, content)"
AN-->>AN : "Reason and decide next step"
```

### Tool registration, parameter validation, and error handling
- Registration:
  - Tools are declared as StructuredTool instances with args_schema.
  - build_agent_tools dynamically augments tools based on context (tokens, session payloads).
- Parameter validation:
  - Pydantic models define required fields, types, and constraints (e.g., URL formats, numeric ranges).
- Error handling:
  - Tools wrap external calls in try/except and return informative error strings.
  - Some tools enforce bounds (e.g., max_results) and normalize inputs.
  - Action plan generation includes sanitization to prevent unsafe patterns.

### Tool execution context management and state preservation
- Context injection:
  - ReactAgentService builds a context dictionary from incoming request fields (e.g., google_access_token, pyjiit_login_response, client_html).
  - GraphBuilder(context) passes this context to build_agent_tools, enabling conditional tool availability.
- Page context:
  - When client_html is provided, the service converts it to markdown and injects it as a SystemMessage to guide the agent.
- State preservation:
  - The agent maintains a messages list; ToolMessage preserves tool_call_id to correlate tool outputs with tool_calls.

### Relationship between agent tools and the broader tool ecosystem
- Tool modules encapsulate domain-specific logic:
  - Web search via Tavily.
  - Website context conversion to markdown.
  - Browser automation via an LLM-generated action plan.
- The browser action tool bridges the agent to the extension's automation:
  - It accepts goal, target_url, DOM structure, and constraints.
  - It delegates to AgentService to generate a validated action plan.

### Adding new tools to the ecosystem
To add a new tool:
1. Define a Pydantic args_schema for input validation.
2. Implement a coroutine that performs the tool logic and returns a string or structured output.
3. Wrap it as a StructuredTool with name, description, args_schema, and coroutine.
4. Register it in build_agent_tools(context) to make it available when appropriate.
5. Optionally, add frontend routing and payload construction in the extension if the tool needs UI integration.

```mermaid
flowchart TD
A["Define args_schema"] --> B["Implement coroutine"]
B --> C["Create StructuredTool"]
C --> D["Register in build_agent_tools"]
D --> E["Expose via API or extension"]
```

## Dependency analysis
- Agents depend on:
  - LangGraph ToolNode and tools_condition for execution control.
  - AGENT_TOOLS registry for available tools.
- Tools depend on:
  - External services (e.g., Tavily, Gmail, Calendar APIs).
  - Internal services (e.g., AgentService for browser automation).
- Frontend depends on:
  - AgentMap to route commands to backend endpoints.
  - executeAgent to construct payloads and handle responses.

```mermaid
graph LR
RT["agents/react_tools.py"] --> RA["agents/react_agent.py"]
RA --> LG["langgraph ToolNode"]
LG --> RT
EA["extension/.../executeAgent.ts"] --> API["routers/react_agent.py"]
API --> SVC["services/react_agent_service.py"]
SVC --> RA
BA["tools/browser_use/tool.py"] --> BUS["services/browser_use_service.py"]
BUS --> AS["utils/agent_sanitizer.py"]
```

## Performance considerations
- Async execution: Tools use asyncio.to_thread for blocking operations to avoid blocking the event loop.
- Bounds enforcement: Tools cap max_results and similar parameters to control resource usage.
- Payload minimization: Tools return concise summaries or structured outputs; avoid returning overly large documents.
- Caching: GraphBuilder uses caching to avoid recompiling the workflow.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing credentials:
  - Symptom: Tools return messages indicating missing tokens or session data.
  - Resolution: Ensure google_access_token and/or pyjiit_login_response are provided in the request context.
- Tool execution errors:
  - Symptom: Tool outputs include error strings.
  - Resolution: Inspect tool-specific error handling and logs; verify external API keys and scopes.
- Action plan validation failures:
  - Symptom: Generated action plans are rejected due to missing fields or unsafe patterns.
  - Resolution: Review agent-sanitizer validations and adjust action plan generation logic.
- Frontend routing:
  - Symptom: Commands do not reach the intended backend endpoint.
  - Resolution: Verify agent-map entries and executeAgent payload construction.

## Conclusion
The tool integration system combines a reliable AGENT_TOOLS registry, strict parameter validation, and resilient error handling to enable reliable agent-driven workflows. Tools are structured as LangGraph-compatible StructuredTool instances, selected via tools_condition, and executed through ToolNode. Context is propagated from frontend to backend and injected into the agent runtime, while tool outputs are integrated back into the message flow. The system supports easy addition of new tools and safe automation via validated action plans.
