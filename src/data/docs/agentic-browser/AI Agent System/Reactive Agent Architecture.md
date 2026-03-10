# Reactive Agent Architecture

<cite>
**Referenced Files in This Document**
- [react_agent.py](file://agents/react_agent.py)
- [react_tools.py](file://agents/react_tools.py)
- [react_agent_service.py](file://services/react_agent_service.py)
- [react_agent.py (router)](file://routers/react_agent.py)
- [react_agent.py (request model)](file://models/requests/react_agent.py)
- [react_agent.py (response model)](file://models/response/react_agent.py)
- [llm.py](file://core/llm.py)
- [agent-map.ts](file://extension/entrypoints/sidepanel/lib/agent-map.ts)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts)
- [tool.py](file://tools/browser_use/tool.py)
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

## Introduction
This document explains the reactive agent architecture built on LangGraph. It focuses on the state machine design, message handling, the reactive loop, the GraphBuilder workflow construction and caching, normalization functions for cross-format compatibility, system prompt configuration, and performance optimizations. It also illustrates agent state transitions, conditional edges, and the end-to-end execution pattern from API to tool invocation.

## Project Structure
The reactive agent spans Python backend services and TypeScript frontend orchestration:
- Backend: LangGraph workflow, agent state, message normalization, tool registry, and service/router layers.
- Frontend: Extension utilities that prepare payloads and invoke backend endpoints.

```mermaid
graph TB
subgraph "Extension (Frontend)"
EXTSVC["executeAgent.ts"]
MAP["agent-map.ts"]
end
subgraph "FastAPI Backend"
ROUTER["routers/react_agent.py"]
SERVICE["services/react_agent_service.py"]
AGENT["agents/react_agent.py"]
TOOLS["agents/react_tools.py"]
LLM["core/llm.py"]
end
EXTSVC --> ROUTER
MAP --> EXTSVC
ROUTER --> SERVICE
SERVICE --> AGENT
AGENT --> TOOLS
AGENT --> LLM
```

**Diagram sources**
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L1-L299)
- [agent-map.ts](file://extension/entrypoints/sidepanel/lib/agent-map.ts#L1-L80)
- [react_agent.py (router)](file://routers/react_agent.py#L1-L57)
- [react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [react_agent.py](file://agents/react_agent.py#L1-L191)
- [react_tools.py](file://agents/react_tools.py#L1-L721)
- [llm.py](file://core/llm.py#L1-L215)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L1-L191)
- [react_tools.py](file://agents/react_tools.py#L1-L721)
- [react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [react_agent.py (router)](file://routers/react_agent.py#L1-L57)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L1-L299)
- [agent-map.ts](file://extension/entrypoints/sidepanel/lib/agent-map.ts#L1-L80)
- [llm.py](file://core/llm.py#L1-L215)

## Core Components
- AgentState: TypedDict representing the conversation state with an annotated messages field that accumulates LangChain messages.
- Message normalization: Bidirectional converters between external payloads and LangChain message types.
- GraphBuilder: Constructs and compiles the LangGraph workflow, caching the compiled graph.
- Tool registry: Centralized collection of structured tools, optionally augmented with contextual tokens/session data.
- System prompt: A default system message injected at the start of the message sequence when absent.

Key responsibilities:
- State machine: Agent node produces an LLM response; conditional edges route to tool execution when tool calls are detected; tool execution returns ToolMessages; loop continues until no tool calls remain.
- Payload conversion: Ensures consistent message roles, content, and tool call/tool call IDs across boundaries.
- Tool binding: The agent node binds available tools to the LLM to enable tool-use prompting.

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L40-L78)
- [react_agent.py](file://agents/react_agent.py#L123-L135)
- [react_agent.py](file://agents/react_agent.py#L138-L176)
- [react_agent.py](file://agents/react_agent.py#L178-L191)
- [react_tools.py](file://agents/react_tools.py#L609-L721)

## Architecture Overview
The reactive loop is a LangGraph StateGraph with:
- Nodes: agent and tool_execution.
- Edges: START → agent; agent → tool_execution if tool calls; tool_execution → agent; agent → END when no tool calls.

```mermaid
flowchart TD
START(["Start"]) --> AgentNode["Agent Node<br/>LLM with tools bound"]
AgentNode --> Decision{"Has tool calls?"}
Decision --> |Yes| ToolExec["Tool Execution Node<br/>Run selected tools"]
ToolExec --> AgentNode
Decision --> |No| End(["End"])
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L154-L170)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L154-L170)

## Detailed Component Analysis

### LangGraph State Machine and AgentState Typing
- AgentState defines a single key messages with an annotation that merges incoming messages into the state.
- The agent node ensures a system message is present at the head of the sequence before invoking the LLM.

```mermaid
classDiagram
class AgentState {
+messages : Annotated[Sequence[BaseMessage], add_messages]
}
class AgentNode {
+invoke(state) -> dict
}
AgentNode --> AgentState : "reads/writes"
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L40-L42)
- [react_agent.py](file://agents/react_agent.py#L123-L135)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L40-L42)
- [react_agent.py](file://agents/react_agent.py#L128-L133)

### Message Normalization Functions
Normalization bridges external payloads and LangChain message types:
- _payload_to_langchain: Converts external role/content/tool_call_id/tool_calls into SystemMessage, AIMessage, ToolMessage, or HumanMessage.
- _langchain_to_payload: Serializes LangChain messages back to external payloads, preserving tool_calls and tool_call_id.

```mermaid
flowchart LR
P["External Payload"] --> N1["_payload_to_langchain"]
N1 --> LC["LangChain Messages"]
LC --> N2["_langchain_to_payload"]
N2 --> P2["External Payload"]
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L61-L78)
- [react_agent.py](file://agents/react_agent.py#L80-L120)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L52-L58)
- [react_agent.py](file://agents/react_agent.py#L61-L78)
- [react_agent.py](file://agents/react_agent.py#L80-L120)

### GraphBuilder: Workflow Construction and Caching
- Builds a StateGraph with agent and tool_execution nodes.
- Uses tools_condition to decide routing after agent inference.
- Compiles the graph once and caches it for reuse.
- Supports dynamic tool sets via context or explicit tool lists.

```mermaid
classDiagram
class GraphBuilder {
-tools : list[StructuredTool]
-_compiled : CompiledGraph
+buildgraph() CompiledGraph
+__call__() CompiledGraph
}
GraphBuilder --> "1" StateGraph : "constructs"
GraphBuilder --> "1" ToolNode : "wraps tools"
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L138-L176)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L138-L176)
- [react_agent.py](file://agents/react_agent.py#L178-L180)

### Tool Registry and Dynamic Tool Binding
- Tools are assembled centrally, optionally enriched with contextual tokens/session data.
- The agent node binds the tool list to the LLM to enable tool-use prompting.

```mermaid
sequenceDiagram
participant Caller as "Caller"
participant GB as "GraphBuilder"
participant AG as "Agent Node"
participant TN as "ToolNode"
participant LLM as "LLM Client"
Caller->>GB : __call__()
GB-->>Caller : CompiledGraph
Caller->>AG : ainvoke(state)
AG->>LLM : ainvoke(messages with tools bound)
LLM-->>AG : AIMessage(tool_calls?)
alt tool_calls present
AG-->>TN : route to tool_execution
TN-->>AG : ToolMessage
AG->>LLM : ainvoke(updated messages)
else no tool_calls
AG-->>Caller : final state
end
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L123-L135)
- [react_agent.py](file://agents/react_agent.py#L154-L170)
- [react_tools.py](file://agents/react_tools.py#L609-L721)

**Section sources**
- [react_tools.py](file://agents/react_tools.py#L609-L721)
- [react_agent.py](file://agents/react_agent.py#L126-L133)

### System Prompt Configuration
- A default system message is constructed and prepended to the message sequence if none exists.
- This ensures consistent behavior and role context for the agent.

```mermaid
flowchart TD
S["Start"] --> CheckSys{"First message is SystemMessage?"}
CheckSys --> |No| Inject["Prepend DEFAULT_SYSTEM_PROMPT"]
CheckSys --> |Yes| Continue["Proceed"]
Inject --> Continue
```

**Diagram sources**
- [react_agent.py](file://agents/react_agent.py#L128-L133)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L25-L34)
- [react_agent.py](file://agents/react_agent.py#L128-L133)

### End-to-End Execution Pattern
- Frontend composes a request payload and invokes the FastAPI endpoint.
- Router validates inputs and delegates to the service.
- Service builds the state (optionally injecting page context) and invokes the compiled graph.
- Graph executes the reactive loop and returns the final state.

```mermaid
sequenceDiagram
participant Ext as "Extension"
participant API as "FastAPI Router"
participant Svc as "ReactAgentService"
participant G as "Compiled Graph"
participant Tools as "Tools"
Ext->>API : POST "/"
API->>Svc : generate_answer(...)
Svc->>G : ainvoke(state)
G->>G : agent -> tools_condition
alt tool_calls
G->>Tools : execute selected tools
Tools-->>G : ToolMessage
G->>G : agent
else no tool_calls
G-->>Svc : final state
end
Svc-->>API : answer
API-->>Ext : response
```

**Diagram sources**
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L114-L127)
- [react_agent.py (router)](file://routers/react_agent.py#L18-L38)
- [react_agent_service.py](file://services/react_agent_service.py#L17-L145)
- [react_agent.py](file://agents/react_agent.py#L154-L170)

**Section sources**
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L114-L127)
- [react_agent.py (router)](file://routers/react_agent.py#L18-L38)
- [react_agent_service.py](file://services/react_agent_service.py#L17-L145)
- [react_agent.py](file://agents/react_agent.py#L154-L170)

## Dependency Analysis
- agents/react_agent.py depends on core/llm.py for the LLM client and agents/react_tools.py for the tool registry.
- services/react_agent_service.py orchestrates request preparation and invokes the compiled graph.
- routers/react_agent.py exposes the API endpoint.
- Frontend extension utilities construct payloads and call the backend.

```mermaid
graph LR
EXT["executeAgent.ts"] --> RTR["routers/react_agent.py"]
RTR --> SVC["services/react_agent_service.py"]
SVC --> AG["agents/react_agent.py"]
AG --> TL["agents/react_tools.py"]
AG --> LM["core/llm.py"]
```

**Diagram sources**
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L1-L299)
- [react_agent.py (router)](file://routers/react_agent.py#L1-L57)
- [react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [react_agent.py](file://agents/react_agent.py#L1-L191)
- [react_tools.py](file://agents/react_tools.py#L1-L721)
- [llm.py](file://core/llm.py#L1-L215)

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L1-L191)
- [react_tools.py](file://agents/react_tools.py#L1-L721)
- [react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [react_agent.py (router)](file://routers/react_agent.py#L1-L57)
- [executeAgent.ts](file://extension/entrypoints/utils/executeAgent.ts#L1-L299)
- [llm.py](file://core/llm.py#L1-L215)

## Performance Considerations
- Graph compilation and caching:
  - GraphBuilder compiles the workflow once and stores it for reuse.
  - A process-level LRU cache wraps GraphBuilder to avoid repeated compilation.
- Tool execution offloading:
  - Long-running tools are executed asynchronously and often offloaded to threads to prevent blocking the LLM invocation loop.
- Payload normalization:
  - Content normalization avoids serialization errors and reduces downstream parsing overhead.
- System prompt injection:
  - Ensures consistent initial context without recomputation.

Recommendations:
- Keep the tool list stable across invocations to maximize cache hits.
- Prefer streaming responses at the API boundary if needed, while retaining synchronous graph execution semantics.
- Monitor tool latency and consider batching where appropriate.

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L178-L180)
- [react_agent.py](file://agents/react_agent.py#L154-L170)
- [react_tools.py](file://agents/react_tools.py#L233-L247)

## Troubleshooting Guide
Common issues and mitigations:
- Missing system message:
  - Symptom: Unexpected behavior at start.
  - Resolution: The agent node automatically prepends the default system message if the first message is not a SystemMessage.
- Tool call parsing failures:
  - Symptom: Tool execution not triggered or malformed ToolMessage.
  - Resolution: Ensure tool_calls are properly serialized and tool_call_id is preserved during normalization.
- Tool execution errors:
  - Symptom: Exceptions raised inside tools.
  - Resolution: Tools already wrap exceptions and return error strings; ensure upstream handlers surface these gracefully.
- LLM initialization problems:
  - Symptom: Runtime errors when constructing the LLM client.
  - Resolution: Verify provider configuration, API keys, and base URLs.

Operational tips:
- Log intermediate states and messages to diagnose routing loops or missing tool calls.
- Validate request payloads against the request/response models to prevent runtime mismatches.

**Section sources**
- [react_agent.py](file://agents/react_agent.py#L128-L133)
- [react_agent.py](file://agents/react_agent.py#L80-L120)
- [react_agent.py](file://agents/react_agent.py#L178-L180)
- [react_tools.py](file://agents/react_tools.py#L294-L301)
- [llm.py](file://core/llm.py#L197-L205)

## Conclusion
The reactive agent leverages LangGraph’s StateGraph to implement a robust, tool-augmented reasoning loop. AgentState encapsulates conversation context, normalization functions maintain cross-format consistency, and GraphBuilder’s compilation and caching minimize overhead. The system prompt guides behavior, while conditional edges ensure seamless transitions between reasoning and tool execution. Together, these components deliver a scalable, extensible agent architecture suitable for browser-centric tasks and beyond.