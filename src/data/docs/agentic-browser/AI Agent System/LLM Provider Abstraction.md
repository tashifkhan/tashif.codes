# LLM provider abstraction

## Introduction
This page explains the Large Language Model (LLM) provider abstraction layer that enables a model-agnostic design across multiple LLM providers (OpenAI, Anthropic, Google, Ollama, DeepSeek, OpenRouter). It covers provider configuration, credential management, model selection, and the binding mechanism that connects LLM clients with tool definitions for function calling. It also documents provider switching, fallback behavior, performance characteristics, and security considerations for API key management.

## Project structure
The LLM abstraction spans three main areas:
- Core provider abstraction and configuration
- MCP server integration for tool-based invocation
- Agent orchestration with tool binding and function calling

```mermaid
graph TB
subgraph "Core"
LLM["LargeLanguageModel<br/>core/llm.py"]
CFG["Config loader<br/>core/config.py"]
end
subgraph "MCP Server"
MCP["MCP Tool Registry<br/>mcp_server/server.py"]
end
subgraph "Agents"
REACT["ReAct Agent Graph<br/>agents/react_agent.py"]
TOOLS["Agent Tools Library<br/>agents/react_tools.py"]
end
subgraph "Extension UI"
UI["Unified Settings Menu<br/>extension/.../UnifiedSettingsMenu.tsx"]
end
CFG --> LLM
MCP --> LLM
REACT --> LLM
REACT --> TOOLS
UI --> MCP
```

## Core components
- LargeLanguageModel: Central abstraction that encapsulates provider selection, credential resolution, base URL handling, and model instantiation. It exposes a simple generate_text method for text generation and preserves provider-specific parameters via kwargs.
- Provider configuration registry: A centralized PROVIDER_CONFIGS mapping that defines provider class, environment variables, default models, and parameter mappings.
- MCP tool integration: The MCP server registers a llm.generate tool that constructs a LargeLanguageModel instance with runtime parameters and executes generation.
- Agent orchestration: The ReAct agent binds tools to the LLM client and routes between agent steps and tool execution nodes.

Key responsibilities:
- Provider switching: Choose provider at runtime via provider parameter.
- Credential management: Prefer environment variables; optionally accept API keys directly.
- Model selection: Allow explicit model override or use provider defaults.
- Function calling: Bind tools to the LLM client for structured tool invocation.

## Architecture overview
The abstraction maintains a model-agnostic interface while delegating provider-specific behavior to LangChain wrappers. The MCP server and agent pipeline consume this abstraction uniformly.

```mermaid
sequenceDiagram
participant UI as "Extension UI<br/>UnifiedSettingsMenu.tsx"
participant MCP as "MCP Server<br/>mcp_server/server.py"
participant LLM as "LargeLanguageModel<br/>core/llm.py"
participant LC as "LangChain Provider"
UI->>MCP : "llm.generate" with provider, model, api_key, base_url
MCP->>LLM : Construct with arguments
LLM->>LC : Instantiate provider client with mapped params
MCP->>LLM : generate_text(prompt, system_message)
LLM->>LC : invoke(messages)
LC-->>LLM : Response
LLM-->>MCP : Text content
MCP-->>UI : Tool result
```

## Detailed component analysis

### LargeLanguageModel abstraction
The LargeLanguageModel class centralizes provider configuration and client creation. It:
- Validates provider selection against a registry of supported providers.
- Resolves API keys from environment variables or direct parameters.
- Applies base URL precedence: explicit base_url > base_url_override > base_url_env.
- Supports provider-specific parameter mapping via param_map.
- Initializes the underlying LangChain client and exposes generate_text.

```mermaid
classDiagram
class LargeLanguageModel {
+string provider
+string model_name
+generate_text(prompt, system_message) str
+summarize_text(text) str
}
class ProviderConfig {
+class client_class
+str api_key_env
+str base_url_env
+str base_url_override
+str default_model
+dict param_map
}
LargeLanguageModel --> ProviderConfig : "uses registry"
```

### Provider configuration system
The PROVIDER_CONFIGS registry defines:
- Provider class: LangChain client class to instantiate.
- Environment variables: Names for API keys and base URLs.
- Defaults: Default model per provider.
- Parameter mapping: How internal parameter names map to provider-specific constructor parameters.

Supported providers include Google, OpenAI, Anthropic, Ollama, DeepSeek, and OpenRouter. Each entry controls credential and URL resolution behavior.

### Credential management and environment variables
- API keys: Loaded from environment variables when configured for the provider. If missing, initialization raises a clear error instructing how to provide the key.
- Base URLs: Explicit base_url overrides provider-specific defaults; base_url_override exists for providers like DeepSeek/OpenRouter; base_url_env is used for providers like Ollama.
- Default API key: The core configuration module exports a default Google API key for convenience, but provider-specific keys are preferred.

Security considerations:
- API keys are handled via environment variables and optional direct parameters.
- The abstraction prints warnings when an API key is provided for a provider that does not require one.
- The MCP server accepts api_key and base_url at runtime; ensure these are transmitted securely and not logged.

### Model selection patterns
- Explicit model override: Pass model_name to LargeLanguageModel to override provider defaults.
- Provider defaults: If no model_name is provided, the provider's default is used.
- MCP tool: The llm.generate tool accepts a model parameter to override defaults at runtime.

Best practices:
- Pin models explicitly in production for reproducibility.
- Use provider defaults for experimentation; switch to explicit models for stability.

### Binding mechanism for function calling
The ReAct agent binds tools to the LLM client using LangGraph's bind_tools. This enables the LLM to produce structured tool calls that the agent's ToolNode executes.

```mermaid
sequenceDiagram
participant Agent as "Agent Node<br/>react_agent.py"
participant Bound as "Bound LLM<br/>bind_tools()"
participant Tool as "ToolNode<br/>react_agent.py"
participant LLM as "LargeLanguageModel<br/>core/llm.py"
Agent->>Bound : invoke(messages)
Bound->>LLM : invoke(messages)
LLM-->>Bound : Response with tool_calls
Bound-->>Agent : Response
Agent->>Tool : Execute tool_calls
Tool-->>Agent : Tool results
Agent-->>Agent : Continue loop
```

### Tool definitions and contextual binding
The agent tools library builds a dynamic tool set based on context (e.g., Google access tokens, PyJIIT session payloads). Tools are wrapped as StructuredTool instances with typed schemas. The GraphBuilder compiles the workflow and caches it.

- Dynamic tool augmentation: Tools requiring credentials are conditionally included based on context.
- Structured schemas: Inputs are validated using Pydantic models.
- Caching: The compiled graph is cached to avoid repeated compilation overhead.

### MCP tool integration
The MCP server exposes a llm.generate tool that:
- Accepts provider, model, api_key, base_url, temperature, and prompt/system_message.
- Constructs a LargeLanguageModel instance with these parameters.
- Invokes generate_text and returns the result as text content.

This enables external clients (e.g., the extension UI) to request LLM generation with provider flexibility.

### Provider switching examples
- Runtime switching: The MCP tool accepts a provider parameter; pass "openai", "anthropic", "google", "ollama", "deepseek", or "openrouter".
- UI-driven switching: The extension settings menu enumerates LLM options and persists selections in local storage.
- Environment-driven defaults: The core configuration loads environment variables; providers without API keys (e.g., Ollama) rely on base_url_env.

### Fallback mechanisms
- Model fallback: If no model_name is provided, the provider's default is used.
- Base URL fallback: base_url_override is applied when present; otherwise base_url_env is required for providers that need it.
- Initialization errors: Clear error messages guide users to set environment variables or pass parameters directly.

Note: There is no automatic provider fallback chain in the current implementation. If a provider fails to initialize, the caller should explicitly retry with another provider.

### Performance considerations
- Client reuse: The default LLM instance is created once and reused across the app. Consider similar caching for MCP-invoked LLM instances if used frequently.
- Message composition: The abstraction composes system and human messages; keep prompts concise to reduce latency.
- Temperature tuning: Lower temperature improves determinism; higher temperature increases creativity.
- Tool execution: ToolNode execution adds latency; batch related tool calls when possible.

[No sources needed since this section provides general guidance]

### Security considerations
- API key handling: Prefer environment variables over hardcoding. The abstraction validates presence for providers that require keys.
- Base URL exposure: Ensure base_url_env is set appropriately for local/private endpoints.
- UI transmission: The extension UI sends api_key and base_url to the MCP server; ensure transport security and avoid logging sensitive values.
- Least privilege: Use provider-specific keys and restrict scopes to the minimum required.

## Dependency analysis
The LLM abstraction relies on LangChain providers and is integrated into the MCP server and agent pipeline.

```mermaid
graph TB
PY["pyproject.toml"]
LLM["core/llm.py"]
MCP["mcp_server/server.py"]
REACT["agents/react_agent.py"]
PY --> LLM
PY --> MCP
PY --> REACT
MCP --> LLM
REACT --> LLM
```

## Performance considerations
- Initialization cost: Creating a provider client is relatively expensive; reuse instances where possible.
- Prompt size: Keep prompts succinct to minimize latency and token usage.
- Tool batching: Group related tool calls to reduce round-trips.
- Concurrency: Use async patterns (as in the agent pipeline) to overlap I/O-bound operations.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Unsupported provider: Ensure the provider is one of the supported values; the abstraction raises a clear error with allowed options.
- Missing API key: For providers requiring keys, set the appropriate environment variable or pass api_key directly.
- Missing base URL: Some providers require base_url_env; set it or pass base_url explicitly.
- Initialization failures: The abstraction surfaces detailed error messages; check API keys, base URLs, and model names.

## Conclusion
The LLM provider abstraction layer delivers a model-agnostic interface across multiple providers while preserving provider-specific capabilities. It integrates cleanly with the MCP server and agent pipeline, enabling dynamic provider selection, secure credential handling, and structured function calling. By using environment variables, explicit parameters, and a centralized configuration registry, the system supports flexible deployment scenarios and strong security hygiene.

## Appendices

### Provider configuration reference
- Google: Requires GOOGLE_API_KEY; default model gemini-2.5-flash.
- OpenAI: Requires OPENAI_API_KEY; default model gpt-5-mini.
- Anthropic: Requires ANTHROPIC_API_KEY; default model claude-4-sonnet.
- Ollama: No API key; requires OLLAMA_BASE_URL; default model llama3.
- DeepSeek: Requires DEEPSEEK_API_KEY; uses base_url_override.
- OpenRouter: Requires OPENROUTER_API_KEY; uses base_url_override.

### MCP tool schema summary
- Tool: llm.generate
- Properties: prompt (required), system_message, provider (enum), model, api_key, base_url, temperature (default 0.4)
- Behavior: Creates a LargeLanguageModel with provided parameters and returns generated text
