# Dynamic script generation

## Introduction
This page explains the dynamic script generation system that transforms natural language goals into safe, executable browser actions. It covers the end-to-end pipeline from goal interpretation to validated action plans, the templating and prompting system, parameter injection, safety validation, sandboxing considerations, error handling, and execution monitoring. It also documents how agent decisions map to generated code, including fallback strategies and error recovery mechanisms.

## Project structure
The dynamic script generation spans backend services, routing, prompts, sanitization utilities, and the browser extension runtime:
- Backend API and service orchestration
- Prompt templates and LLM invocation
- Validation and sanitization
- Extension-side action execution and content script helpers
- Model schemas for request/response

```mermaid
graph TB
subgraph "Backend"
R["FastAPI Router<br/>/generate-script"]
S["AgentService<br/>generate_script()"]
P["SCRIPT_PROMPT<br/>ChatPromptTemplate"]
V["agent_sanitizer<br/>sanitize_json_actions()"]
M1["GenerateScriptRequest"]
M2["GenerateScriptResponse"]
end
subgraph "Agent Runtime"
RA["ReactAgentService<br/>generate_answer()"]
G["GraphBuilder<br/>LangGraph workflow"]
end
subgraph "Extension"
E["executeActions.ts<br/>executeBrowserActions()"]
C["content.ts<br/>performAction()/findElement()"]
end
R --> S
S --> P
S --> V
S --> M2
RA --> G
E --> C
M1 --> R
```

## Core components
- Prompt template and LLM chain for action plan generation
- Service orchestrating prompt assembly, LLM invocation, and validation
- Sanitization and safety checks for generated JSON action plans
- API router validating inputs and returning structured responses
- Extension utilities for executing actions and content script helpers
- Agent runtime for conversational reasoning and tool selection

Key responsibilities:
- Goal interpretation and action planning
- Parameter injection into prompt templates
- Safety validation and error reporting
- Execution coordination between backend and extension

## Architecture overview
The system follows a clear separation of concerns:
- Frontend sends a goal with optional DOM context and constraints.
- Backend composes a prompt with DOM information and constraints, invokes the LLM, validates the JSON action plan, and returns a structured response.
- The extension executes actions against the active tab, delegating DOM-specific actions to the content script.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "FastAPI Router"
participant Service as "AgentService"
participant Prompt as "SCRIPT_PROMPT"
participant LLM as "LLM"
participant Sanitizer as "agent_sanitizer"
participant Ext as "Extension"
Client->>Router : POST /generate-script
Router->>Service : generate_script(goal, target_url, dom_structure, constraints)
Service->>Prompt : format prompt with DOM + constraints
Service->>LLM : invoke chain
LLM-->>Service : raw response (JSON string)
Service->>Sanitizer : validate and sanitize JSON actions
Sanitizer-->>Service : action_plan or problems
Service-->>Router : GenerateScriptResponse
Router-->>Client : {ok, action_plan | error, problems}
Client->>Ext : execute actions (via messaging)
Ext->>Ext : executeBrowserActions()
Ext->>Ext : sendMessage(EXECUTE_ACTION) to active tab
```

## Detailed component analysis

### Prompt template and script generation
- The prompt defines available actions (DOM manipulation and tab/window control), selector best practices, and critical rules for safe and effective automation.
- The service composes a user prompt including goal, target URL, constraints, and a limited DOM snapshot of interactive elements.
- The LLM produces a JSON action plan; the service extracts the content and passes it to the sanitizer.

Validation highlights:
- Enforces presence of an actions array and per-action fields.
- Validates action types and required parameters (e.g., selector for CLICK/TYPE/SELECT, url for OPEN_TAB/NAVIGATE).
- Detects potentially dangerous EXECUTE_SCRIPT patterns.

### Action planning pipeline
The pipeline stages:
1. Input assembly: goal, target_url, dom_structure, constraints.
2. Prompt construction: DOM summary and constraints embedded into a structured prompt.
3. LLM invocation: ChatPromptTemplate chained to the LLM client.
4. Validation: JSON parsing, structure checks, and safety checks.
5. Response shaping: ok flag, action_plan, and optional problems/error.

```mermaid
flowchart TD
Start(["Start"]) --> BuildPrompt["Build Prompt<br/>with DOM + constraints"]
BuildPrompt --> InvokeLLM["Invoke LLM Chain"]
InvokeLLM --> Parse["Parse JSON Response"]
Parse --> Validate{"Valid JSON and Actions?"}
Validate --> |No| ReportProblems["Collect Problems/Error"]
Validate --> |Yes| ReturnPlan["Return Action Plan"]
ReportProblems --> End(["End"])
ReturnPlan --> End
```

### Script templating and parameter injection
- The prompt template is a ChatPromptTemplate with a system message enumerating actions and rules, plus user content constructed from the goal, target URL, constraints, and DOM snapshot.
- Parameter injection occurs by formatting the user prompt string with the provided inputs and limiting the number of interactive elements to control token usage.

Best practices reflected in the template:
- Prefer explicit selectors and avoid chrome:// pages for DOM actions.
- Prefer constructing full search URLs directly in OPEN_TAB.
- Encourage atomic, clearly described steps.

### Safety validation and sandboxing
Safety measures:
- JSON validation ensures required fields and correct types.
- EXECUTE_SCRIPT validation scans for dangerous patterns (e.g., eval-like constructs).
- Tab control actions require mandatory fields (e.g., url for OPEN_TAB/NAVIGATE).
- DOM actions are restricted to http/https contexts per prompt rules.

Sandboxing considerations:
- EXECUTE_SCRIPT is allowed but subject to basic pattern checks; it runs in the extension's content script context.
- DOM actions are delegated to the content script via message passing, reducing direct exposure of unsafe patterns in the extension host.

### Execution monitoring and extension integration
- The extension receives action lists and executes them sequentially with delays between actions.
- DOM actions are sent to the active tab via messaging; the content script performs element queries and interactions.
- The content script includes helpers for element finding and a small set of built-in actions for quick tasks.

```mermaid
sequenceDiagram
participant Ext as "Extension"
participant ActiveTab as "Active Tab"
participant Content as "Content Script"
Ext->>Ext : iterate actions[]
Ext->>ActiveTab : browser.tabs.sendMessage(EXECUTE_ACTION, action)
ActiveTab->>Content : handle message
Content->>Content : findElement(selector)
Content->>Content : dispatch events (click/type/etc.)
Content-->>ActiveTab : result
ActiveTab-->>Ext : result
Ext->>Ext : wait between actions
```

### Relationship between agent decisions and generated code
- The prompt template encodes decision rules: choose tab control vs DOM actions based on intent, prefer direct navigation for searches, and use precise selectors.
- The sanitizer enforces these rules at validation time, returning actionable feedback when plans violate constraints.
- The extension faithfully executes the validated plan, with content script helpers enabling DOM interactions.

Fallback and recovery:
- If validation fails, the API returns ok=false with problems; the caller can refine the goal or DOM context and retry.
- For runtime errors during execution, the extension logs failures and continues to the next action after a delay.

### Examples of generated scripts
Below are representative action plan structures produced by the system. These are conceptual examples derived from the prompt template and sanitizer rules.

- Click an element:
  - type: "CLICK"
  - selector: "<specific CSS selector>"
  - description: "<clear description>"

- Type into an input:
  - type: "TYPE"
  - selector: "<specific CSS selector>"
  - value: "<text to type>"
  - description: "<clear description>"

- Navigate to a search result page:
  - type: "OPEN_TAB"
  - url: "<full search URL>"
  - active: true
  - description: "<clear description>"

- Combined workflow (open tab, wait, type, click):
  - OPEN_TAB with url and active
  - WAIT with time
  - TYPE with selector and value
  - CLICK with selector

These examples reflect the prompt's preference for direct navigation URLs and atomic steps with clear descriptions.

### Agent runtime and conversational planning
While the dynamic script generation focuses on action plans, the agent runtime supports broader conversational reasoning:
- A LangGraph workflow coordinates an agent node and tool execution.
- The runtime normalizes messages and integrates tools, including a browser action tool that delegates to the script generation service.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Service as "ReactAgentService"
participant Graph as "GraphBuilder"
participant Agent as "Agent Node"
participant Tools as "ToolNode"
Client->>Service : messages (chat history + question)
Service->>Graph : compile workflow
Graph-->>Service : compiled graph
Service->>Agent : invoke with messages
Agent-->>Service : response
Service-->>Client : final answer
```

## Dependency analysis
- Router depends on AgentService and models for request/response.
- AgentService composes SCRIPT_PROMPT and invokes the LLM, then applies agent_sanitizer.
- Extension utilities depend on browser APIs for tab management and content script messaging.
- The agent runtime composes tools and a LangGraph workflow.

```mermaid
graph LR
Router["routers/browser_use.py"] --> Service["services/browser_use_service.py"]
Service --> Prompt["prompts/browser_use.py"]
Service --> Sanitizer["utils/agent_sanitizer.py"]
Service --> Models["models/response/agent.py"]
Router --> ModelsReq["models/requests/agent.py"]
ExtExec["extension/.../executeActions.ts"] --> ExtContent["extension/.../content.ts"]
AgentSvc["services/react_agent_service.py"] --> AgentGraph["agents/react_agent.py"]
AgentGraph --> Tools["tools/browser_use/tool.py"]
```

## Performance considerations
- Limit DOM snapshots: The service truncates interactive elements to reduce token usage.
- Batch execution delays: The extension introduces small delays between actions to prevent overwhelming the page.
- Validation overhead: JSON parsing and safety checks occur synchronously; keep action plans concise and atomic.
- Prompt caching: Consider caching repeated prompts or using a smaller subset of DOM data when feasible.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Invalid JSON or missing fields:
  - The sanitizer reports problems; refine the goal or provide a richer DOM context.
- Missing required fields for actions:
  - Ensure selector for DOM actions and url for tab actions.
- Dangerous EXECUTE_SCRIPT patterns:
  - Simplify or avoid custom scripts; rely on supported DOM actions.
- Extension execution failures:
  - Check console logs for action errors; ensure the active tab is reachable and the selector is correct.
- API validation errors:
  - The endpoint returns ok=false with problems; address reported issues and retry.

## Conclusion
The dynamic script generation system combines a structured prompt template, reliable validation, and extension-based execution to safely transform natural language goals into executable browser actions. By enforcing strict validation rules, limiting DOM context, and using message-passing for DOM operations, the system balances flexibility with safety. The agent runtime complements this by enabling broader conversational planning, while the API and extension layers provide clear integration points for execution monitoring and error recovery.
