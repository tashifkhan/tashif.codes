# Prompt engineering system

## Introduction
This page explains the prompt engineering system powering the agentic assistant. It covers the DEFAULT_SYSTEM_PROMPT structure and how it steers agent behavior across domains, the prompt injection validation pipeline, the prompt template architecture, and how domain-specific prompts are organized. It also documents prompt customization, context injection, dynamic prompt generation, and the interaction among system prompts, user messages, and tool responses that maintains coherent conversation flow. Finally, it outlines optimization techniques, testing strategies, and best practices for prompt engineering in agentic systems.

## Project structure
The prompt engineering system spans several modules:
- Agents orchestrate conversational loops and tool use, with a DEFAULT_SYSTEM_PROMPT guiding behavior.
- Prompts define domain-specific templates for GitHub repositories, websites, YouTube videos, and browser automation.
- Validation services detect prompt injection risks in website content.
- Utilities sanitize generated JSON action plans for browser automation.
- Core LLM configuration supports multiple providers and runtime selection.

```mermaid
graph TB
subgraph "Agents"
RA["React Agent<br/>DEFAULT_SYSTEM_PROMPT"]
RT["React Tools<br/>Domain Tools"]
end
subgraph "Prompts"
PR["React Template"]
PG["GitHub Template"]
PW["Website Template"]
PY["YouTube Template"]
PB["Browser Automation Template"]
PV["Prompt Injection Validator Template"]
end
subgraph "Validation"
SV["Website Validator Service"]
SAN["Agent Sanitizer"]
end
subgraph "Core"
LLM["LargeLanguageModel"]
CFG["Config"]
end
RA --> RT
RA --> LLM
RT --> PG
RT --> PW
RT --> PY
RA --> PB
SV --> PV
SV --> LLM
RA --> SAN
LLM --> CFG
```

## Core components
- DEFAULT_SYSTEM_PROMPT: Defines agent persona, memory of user-provided credentials, and explicit tool invocation policies for sensitive domains (e.g., JIIT attendance).
- Domain-specific prompt templates: GitHub, Website, YouTube, and Browser Automation templates encapsulate context framing and response formatting.
- Prompt injection validator: A dedicated template and service to flag potentially malicious website content.
- Agent sanitizer: Validates and sanitizes JSON action plans produced by the browser automation agent.
- LLM provider abstraction: Centralized configuration supporting multiple providers and runtime overrides.

## Architecture overview
The system composes prompts with LLM clients and orchestrates tool use through a LangGraph workflow. The DEFAULT_SYSTEM_PROMPT is prepended to conversation turns when absent, ensuring consistent grounding. Domain-specific chains inject context and enforce response formatting. Validation and sanitization occur at boundaries to mitigate risk.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "Routers"
participant Service as "ReactAgentService"
participant Agent as "React Agent"
participant Tools as "Domain Tools"
participant LLM as "LargeLanguageModel"
participant Validator as "Website Validator"
Client->>Router : POST /react-agent
Router->>Service : generate_answer(question, history, tokens, session)
Service->>Agent : run_react_agent(messages)
Agent->>Agent : prepend DEFAULT_SYSTEM_PROMPT if missing
Agent->>LLM : invoke(messages)
LLM-->>Agent : response (AIMessage)
Agent->>Tools : conditionally invoke tools
Tools-->>Agent : tool results (ToolMessage)
Agent-->>Service : final messages
Service-->>Router : answer
Router-->>Client : response
Client->>Validator : POST /validate-website
Validator->>Validator : parse HTML -> Markdown
Validator->>LLM : prompt_injection_validator
LLM-->>Validator : true/false
Validator-->>Client : is_safe
```

## Detailed component analysis

### DEFAULT_SYSTEM_PROMPT and agent behavior
- Purpose: Establishes agent persona, context retention, credential handling policy, and explicit tool invocation rules for sensitive domains.
- Behavior cues:
  - Maintain conversation context and remember user-provided information.
  - Automatically use available tools when beneficial; otherwise respond directly.
  - Credentials (e.g., Google access tokens, JIIT sessions) are handled automatically; do not ask users for them.
  - For JIIT attendance, call the dedicated tool immediately using existing session; if it fails, report expiration and instruct secure refresh without requesting credentials.

```mermaid
flowchart TD
Start(["Agent Turn Starts"]) --> CheckSys["Check if first message is SystemMessage"]
CheckSys --> |No| Prepend["Prepend DEFAULT_SYSTEM_PROMPT"]
CheckSys --> |Yes| Continue["Continue with existing messages"]
Prepend --> InvokeLLM["Invoke LLM with messages"]
Continue --> InvokeLLM
InvokeLLM --> ToolChoice{"Tool needed?"}
ToolChoice --> |Yes| ExecTool["Execute ToolNode"]
ToolChoice --> |No| End(["Return AIMessage"])
ExecTool --> PostExec["Append ToolMessage"]
PostExec --> InvokeLLM
```

### Prompt injection validation system
- Validator template: Requires a binary safety assessment ("true" or "false") after analyzing website markdown for prompt injection attempts.
- Service flow:
  - Convert HTML to Markdown.
  - Compose a validation chain using the validator template and the configured LLM.
  - Evaluate the model's response and return a boolean safety flag.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant Router as "/validate-website"
participant Service as "validate_website"
participant LLM as "LLM Client"
participant Model as "Validator Template"
FE->>Router : POST {html}
Router->>Service : validate_website(request)
Service->>Service : return_html_md(html)
Service->>Model : PromptTemplate(template=validator_template)
Service->>LLM : chain.invoke({markdown_text})
LLM-->>Service : response (true/false)
Service-->>FE : {is_safe}
```

### Prompt template architecture and domain organization
- GitHub template:
  - Inputs: repository summary, file tree, relevant file content, question, optional chat history.
  - Guidelines emphasize reliance on provided context, concise answers, Markdown formatting, and code block usage.
- Website template:
  - Inputs: server-fetched context, client-rendered context, question, optional chat history.
  - Guidelines prioritize client context for dynamic content, structured summaries, headings-based TOC, and precise quoting of metadata.
- YouTube template:
  - Inputs: processed transcript/context, question, optional chat history.
  - Guidelines focus on duration conversion, statistics quoting, thematic analysis, and avoiding out-of-scope claims.
- Browser automation template:
  - Inputs: DOM and tab control actions, with explicit JSON schema and examples.
  - Rules govern selector specificity, preferred direct search URLs, and constraints on unsafe actions.

```mermaid
classDiagram
class PromptTemplates {
+github_prompt
+website_prompt
+youtube_prompt
+browser_script_prompt
+injection_validator_prompt
}
class Chains {
+github_chain
+website_chain
+youtube_chain
+browser_script_chain
+validator_chain
}
PromptTemplates --> Chains : "compose with LLM"
```

### Security measures against malicious input
- Prompt injection detection:
  - Dedicated validator template and service to assess website content safety.
  - Returns a boolean flag enabling downstream decisions (e.g., block or sanitize).
- Browser automation safeguards:
  - Strict JSON schema validation for action plans.
  - Disallows unsafe patterns (e.g., eval, innerHTML assignment).
  - Enforces required fields per action type (e.g., url for OPEN_TAB/NAVIGATE, selector/value for DOM actions).

```mermaid
flowchart TD
A["Receive Action Plan JSON"] --> B["Strip code fences"]
B --> C["Parse JSON"]
C --> D{"Has 'actions' array?"}
D --> |No| E["Reject: Missing actions"]
D --> |Yes| F["Validate each action"]
F --> G{"Type valid?"}
G --> |No| H["Record invalid type"]
G --> |Yes| I{"Required fields present?"}
I --> |No| H
I --> |Yes| J{"Dangerous patterns?"}
J --> |Yes| H
J --> |No| K["Accept"]
```

### Prompt customization, context injection, and dynamic generation
- Customization anchors:
  - DEFAULT_SYSTEM_PROMPT: Adjust persona, credential handling, and tool invocation policies.
  - Domain templates: Modify guidelines, response formatting, and context framing.
- Context injection:
  - GitHub: Inject repository summary, file tree, and relevant file content.
  - Website: Inject server-fetched and client-rendered markdown contexts.
  - YouTube: Inject processed transcript/context derived from video metadata.
  - Browser automation: Inject DOM structure and action examples to guide JSON plans.
- Dynamic generation:
  - Chains assemble prompt templates with LLM clients and parsers.
  - Provider configuration enables runtime selection and parameterization.

### Relationship between system prompts, user messages, and tool responses
- Conversation flow:
  - System message is prepended when missing to anchor behavior.
  - User messages are appended; tool responses are converted to ToolMessages and re-enter the loop.
  - ToolNode executes selected tools; results feed back into the LLM for grounded responses.
- Coherence:
  - DEFAULT_SYSTEM_PROMPT ensures consistent persona and policies.
  - Domain templates frame context precisely, reducing ambiguity.
  - Tool responses provide verifiable facts, anchoring further reasoning.

```mermaid
sequenceDiagram
participant Agent as "Agent"
participant LLM as "LLM"
participant Tools as "Tools"
Agent->>Agent : normalize messages
Agent->>LLM : invoke(messages)
LLM-->>Agent : AIMessage
Agent->>Tools : condition
Tools-->>Agent : ToolMessage
Agent->>LLM : invoke(messages + ToolMessage)
LLM-->>Agent : AIMessage (final)
```

## Dependency analysis
- Agent-to-tool coupling:
  - The React Agent builds a toolset from context and invokes them conditionally.
  - Tools depend on domain-specific prompt chains and external services.
- Template-to-provider coupling:
  - All prompt chains bind to the configured LLM client.
  - Provider configuration is centralized and validated at runtime.
- Validation-to-template coupling:
  - Validator service composes the injection template with the LLM client.

```mermaid
graph LR
RA["React Agent"] --> RT["React Tools"]
RT --> GH["GitHub Chain"]
RT --> WT["Website Chain"]
RT --> YT["YouTube Chain"]
RA --> BR["Browser Script Chain"]
SV["Validator Service"] --> PV["Injection Validator Template"]
GH --> LLM["LLM Client"]
WT --> LLM
YT --> LLM
BR --> LLM
PV --> LLM
LLM --> CFG["Provider Config"]
```

## Performance considerations
- Prompt composition overhead:
  - Reuse compiled prompt chains and cached LLM clients to minimize repeated construction.
- Tool latency:
  - Asynchronous tool execution prevents blocking; batch and limit concurrent tool calls where appropriate.
- Validation cost:
  - Apply validator selectively to untrusted website content; cache results when feasible.
- Provider tuning:
  - Adjust temperature and model selection per task; use smaller models for validation and larger ones for synthesis.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Prompt injection flagged as unsafe:
  - Verify website content; if legitimate, adjust validator template or thresholds.
  - Ensure HTML-to-Markdown parsing is intact.
- Browser automation failures:
  - Validate JSON action plan structure and required fields.
  - Review disallowed patterns and selector specificity.
- Tool invocation errors:
  - Confirm context availability (tokens, session payloads).
  - Inspect tool argument schemas and bounds.
- LLM initialization issues:
  - Check provider configuration, API keys, and base URLs.

## Conclusion
The prompt engineering system integrates a reliable DEFAULT_SYSTEM_PROMPT, domain-specific templates, and layered validation to maintain safety and coherence. By composing templates with configurable LLM clients, injecting rich context, and enforcing strict sanitization, the system supports reliable agentic behavior across diverse domains. Adopting the recommended optimization and testing strategies will further improve reliability and performance.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Best practices for prompt engineering in agentic systems
- Keep system prompts concise yet explicit about roles, constraints, and credential handling.
- Frame domain templates with clear input schemas and response formatting rules.
- Inject only verified, minimal context to reduce noise and hallucinations.
- Use validators and sanitizers at boundaries to mitigate prompt injection and unsafe actions.
- Test prompts across representative scenarios and iterate with small, targeted changes.

[No sources needed since this section provides general guidance]
