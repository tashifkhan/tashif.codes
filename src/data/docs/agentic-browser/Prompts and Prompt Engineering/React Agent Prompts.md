# React agent prompts

## Introduction
This page explains the React agent prompt system and patterns used to orchestrate tool-enabled reasoning and response generation. It covers:
- The core prompt structure that integrates available tools and manages conversation context
- How the agent decides whether to use tools and how it formats responses
- Dynamic tool injection based on runtime context
- Multi-turn conversation handling and context propagation
- Prompt variations for different domains (websites, GitHub repositories, YouTube videos)
- Best practices for prompt optimization, error handling, and debugging
- Scalability and performance considerations for production deployments

## Project structure
The React agent pipeline spans prompts, tools, agent orchestration, and service layers:
- Prompts define domain-specific templates and formatting expectations
- Tools encapsulate capabilities and inject structured parameters
- The agent orchestrates tool use via a LangGraph workflow
- Services assemble context and invoke the agent
- Routers expose the agent as an API endpoint

```mermaid
graph TB
subgraph "Prompts"
PR["prompts/react.py"]
PW["prompts/website.py"]
PG["prompts/github.py"]
PY["prompts/youtube.py"]
PB["prompts/browser_use.py"]
end
subgraph "Tools"
TR["agents/react_tools.py"]
TB["tools/browser_use/tool.py"]
end
subgraph "Agent"
RA["agents/react_agent.py"]
LL["core/llm.py"]
end
subgraph "Service"
RS["services/react_agent_service.py"]
MR["models/requests/react_agent.py"]
MR2["models/response/react_agent.py"]
end
subgraph "Router"
RR["routers/react_agent.py"]
end
PR --> RA
PW --> TR
PG --> TR
PY --> TR
PB --> TB
TR --> RA
LL --> RA
RS --> RA
RR --> RS
MR --> RS
MR2 --> RR
```

## Core components
- React prompt template: Defines the system-like framing for tool availability and usage instructions, parameterized with tools and the current question.
- Tool registry and builders: Define tool schemas, runtime augmentation (e.g., adding Google/Gmail/Calendar/PyJIIT tools when credentials are present), and structured tool coroutines.
- Agent graph: A LangGraph workflow that binds tools to the LLM, routes tool calls, and loops until completion.
- Service layer: Assembles context (chat history, client HTML, tokens, login payloads), injects page context as a SystemMessage, and invokes the compiled graph.
- Router: Exposes the agent via FastAPI, validating inputs and returning standardized responses.

Key implementation references:
- Prompt template and binding: `prompts/react.py`
- Agent graph and tool binding: `agents/react_agent.py`
- Tool builder and runtime augmentation: `agents/react_tools.py`
- Service context assembly and page context injection: `services/react_agent_service.py`
- Router input validation and response: `routers/react_agent.py`

## Architecture overview
The React agent follows a tool-use loop:
- The agent receives a conversation state (including a system message if missing)
- The LLM selects whether to use tools and produces tool calls
- The ToolNode executes tools and returns results
- The agent consumes tool outputs and continues reasoning until a final answer is produced

```mermaid
sequenceDiagram
participant Client as "Caller"
participant Router as "routers/react_agent.py"
participant Service as "services/react_agent_service.py"
participant Agent as "agents/react_agent.py"
participant Graph as "LangGraph Workflow"
participant Tools as "agents/react_tools.py"
participant LLM as "core/llm.py"
Client->>Router : POST "/" with question, chat_history, tokens
Router->>Service : generate_answer(...)
Service->>Agent : GraphBuilder(context).buildgraph()
Agent->>Graph : compile()
Service->>Graph : ainvoke(state)
Graph->>LLM : invoke(messages with tools bound)
LLM-->>Graph : AIMessage(tool_calls or final answer)
alt Tool calls present
Graph->>Tools : ToolNode.execute(tool_calls)
Tools-->>Graph : ToolMessage(results)
Graph->>LLM : append ToolMessage and continue
end
Graph-->>Service : final messages
Service-->>Router : answer
Router-->>Client : CrawllerResponse(answer)
```

## Detailed component analysis

### React prompt template and tool integration
- Purpose: Introduce the agent's role, enumerate available tools, and instruct tool invocation syntax. The template is parameterized with the formatted tools list and the incoming question.
- Dynamic tool integration: Tools are bound to the LLM at runtime via the agent node. The prompt itself does not change; the tool list injected into the LLM call determines which tools are available.
- Conversation context: The system message is prepended automatically if missing, ensuring continuity across turns.

References:
- Template definition and ChatPromptTemplate creation: `prompts/react.py`
- Automatic system message insertion and LLM binding: `agents/react_agent.py`

### Tool selection and execution loop
- Tool selection: The LLM chooses whether to use tools based on the conversation state and tool availability. Tool calls are parsed and executed by the ToolNode.
- Conditional routing: The graph routes to the ToolNode when tool_calls are detected; otherwise, it ends.
- Loop behavior: Results from tools are appended as ToolMessages, allowing the agent to continue reasoning until a final answer is produced.

References:
- Graph construction and conditional edges: `agents/react_agent.py`
- ToolNode usage: `agents/react_agent.py`

### Context management and multi-turn conversations
- Chat history: The service converts prior entries into Human/System/AI messages and appends them to the state.
- Page context: When client HTML is provided, it is converted to markdown and injected as a SystemMessage to inform the agent about the current page.
- Message normalization: Payloads are normalized to LangChain message types, preserving tool_calls and tool_call_id.

References:
- Chat history conversion and page context injection: `services/react_agent_service.py`
- Payload normalization helpers: `agents/react_agent.py`

### Domain-Specific prompt variations
- Website QA: Combines server-fetched and client-rendered contexts, prioritizing client context for accuracy.
- GitHub repository QA: Uses repository summary, file tree, and content to answer coding questions.
- YouTube QA: Builds context from video info and transcripts, with strict scope limitations.
- Browser automation script generation: Produces JSON action plans for Chrome extension automation.

References:
- Website prompt and chain: `prompts/website.py`
- GitHub prompt and chain: `prompts/github.py`
- YouTube prompt and chain: `prompts/youtube.py`
- Browser automation prompt: `prompts/browser_use.py`

### Tool registry and parameter injection patterns
- Tool schemas: Each tool defines a Pydantic model specifying parameters and constraints.
- Runtime augmentation: Tools are conditionally added based on context (e.g., Google access tokens, PyJIIT session payload).
- Partial application: Default credentials are injected via partial to avoid requiring explicit parameters in every call.

References:
- Tool schemas and coroutines: `agents/react_tools.py`
- Conditional tool addition: `agents/react_tools.py`
- Browser automation tool: `tools/browser_use/tool.py`

### Response generation and formatting
- Final answer extraction: The service returns the content of the last assistant message.
- Standardized responses: The router wraps the answer in a response model.

References:
- Final message extraction: `services/react_agent_service.py`
- Response model: `models/response/react_agent.py`
- Router response: `routers/react_agent.py`

### API and request contracts
- Request model: Supports messages, optional Google access token, and PyJIIT login payload.
- Response model: Returns the final messages and the assistant's output.

References:
- Request model: `models/requests/react_agent.py`
- Response model: `models/response/react_agent.py`

## Dependency analysis
- LLM provider abstraction: The agent relies on a unified LLM client configured via environment variables and provider parameters.
- Tool-to-agent coupling: Tools are registered and bound to the LLM inside the agent node; the prompt template remains decoupled from tool specifics.
- Service-to-agent coupling: The service constructs the graph with context-aware tools and feeds the conversation state.

```mermaid
graph LR
LL["core/llm.py"] --> RA["agents/react_agent.py"]
RA --> RT["agents/react_tools.py"]
RS["services/react_agent_service.py"] --> RA
RR["routers/react_agent.py"] --> RS
PW["prompts/website.py"] --> RT
PG["prompts/github.py"] --> RT
PY["prompts/youtube.py"] --> RT
PB["prompts/browser_use.py"] --> TB["tools/browser_use/tool.py"]
```

## Performance considerations
- Tool binding overhead: Binding tools to the LLM increases prompt size; keep tool descriptions concise and only include necessary tools.
- Graph caching: The agent graph is cached via LRU cache to avoid repeated compilation costs.
- Async I/O: Tools perform blocking operations in threads; ensure thread pool sizing aligns with concurrency needs.
- Prompt size limits: For long chat histories or large page contexts, consider truncation strategies or summarization before invoking the agent.
- Provider latency: Choose providers and models appropriate for your latency SLAs; configure base URLs and API keys correctly.

References:
- Graph caching: `agents/react_agent.py`
- Threaded tool execution: `agents/react_tools.py`

## Troubleshooting guide
- Missing API keys or base URLs: Initialization of the LLM client validates provider configuration; errors surface during initialization.
- Tool execution failures: Tools wrap exceptions and return error messages; check service logs for details.
- Unexpected tool calls: Verify tool schemas and ensure parameters match the expected types.
- Conversation state anomalies: Confirm that payloads are normalized to LangChain messages and that tool_call_id and tool_calls are preserved.

References:
- LLM initialization and error handling: `core/llm.py`
- Tool error handling: `agents/react_tools.py`
- Payload normalization: `agents/react_agent.py`

## Conclusion
The React agent prompt system combines a flexible tool registry with a LangGraph-driven reasoning loop. The prompt template focuses on tool availability and invocation syntax, while dynamic tool injection and context management enable reliable, multi-domain responses. By using structured tool schemas, careful context assembly, and provider-agnostic LLM configuration, the system supports scalable deployment and maintainable prompt engineering.

## Appendices

### Prompt template customization checklist
- Keep tool descriptions concise and actionable
- Clearly specify tool invocation syntax and constraints
- Include fallback responses for unavailable data
- Align formatting expectations with downstream parsers

References:
- Prompt template: `prompts/react.py`

### Best practices for prompt optimization
- Use explicit instructions for tool usage and response formatting
- Inject only necessary context to reduce token usage
- Validate and sanitize inputs to prevent prompt injection
- Monitor tool call success rates and refine tool schemas accordingly

References:
- Prompt injection validator template: `prompts/prompt_injection_validator.py`
