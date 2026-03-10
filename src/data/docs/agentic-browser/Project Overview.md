# Project Overview

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [main.py](file://main.py)
- [pyproject.toml](file://pyproject.toml)
- [core/config.py](file://core/config.py)
- [core/llm.py](file://core/llm.py)
- [mcp_server/server.py](file://mcp_server/server.py)
- [agents/react_agent.py](file://agents/react_agent.py)
- [agents/react_tools.py](file://agents/react_tools.py)
- [prompts/browser_use.py](file://prompts/browser_use.py)
- [tools/browser_use/tool.py](file://tools/browser_use/tool.py)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts)
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
Agentic Browser is a next-generation browser extension designed to act as an intelligent agent that understands and controls web content. Its mission is to bridge modern LLM reasoning with real browser interactivity, enabling users to issue natural-language commands that are translated into safe, human-approved actions on live web pages. The project emphasizes model-agnostic intelligence, privacy-respecting design, and open-source extensibility, positioning itself as an adaptive, secure platform for AI-driven web automation.

## Project Structure
The repository is organized into cohesive layers:
- Core runtime and configuration
- Agent orchestration and tooling
- MCP server for model-agnostic communication
- Browser extension (background, content scripts, UI)
- Services and tools for specialized workflows
- Prompts and utilities for grounded reasoning

```mermaid
graph TB
subgraph "Core"
CFG["core/config.py"]
LLM["core/llm.py"]
end
subgraph "Agent Runtime"
RA["agents/react_agent.py"]
RT["agents/react_tools.py"]
end
subgraph "MCP Server"
MCP["mcp_server/server.py"]
end
subgraph "Extension"
BG["extension/entrypoints/background.ts"]
CT["extension/entrypoints/content.ts"]
end
subgraph "Tools"
BA["tools/browser_use/tool.py"]
PU["prompts/browser_use.py"]
end
CFG --> LLM
RA --> RT
RA --> LLM
MCP --> LLM
MCP --> RT
BG --> RA
BG --> MCP
BA --> RA
PU --> BA
CT --> BG
```

**Diagram sources**
- [core/config.py](file://core/config.py#L1-L26)
- [core/llm.py](file://core/llm.py#L1-L215)
- [agents/react_agent.py](file://agents/react_agent.py#L1-L191)
- [agents/react_tools.py](file://agents/react_tools.py#L1-L721)
- [mcp_server/server.py](file://mcp_server/server.py#L1-L139)
- [tools/browser_use/tool.py](file://tools/browser_use/tool.py#L1-L49)
- [prompts/browser_use.py](file://prompts/browser_use.py#L1-L138)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L1-L800)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L1-L326)

**Section sources**
- [README.md](file://README.md#L1-L185)
- [pyproject.toml](file://pyproject.toml#L1-L34)

## Core Components
- Model-agnostic LLM integration: A unified adapter supporting multiple providers and local models.
- MCP-compliant server: Exposes tools and LLM generation via the Model Context Protocol.
- Agent orchestration: LangGraph-based ReAct agent with a rich toolset for web, calendar, email, and browser actions.
- Browser extension: Secure background and content scripts with declarative action execution.
- Prompt engineering: Specialized prompts for generating safe, structured action plans for browser automation.

**Section sources**
- [core/llm.py](file://core/llm.py#L21-L75)
- [mcp_server/server.py](file://mcp_server/server.py#L16-L80)
- [agents/react_agent.py](file://agents/react_agent.py#L138-L175)
- [agents/react_tools.py](file://agents/react_tools.py#L524-L702)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L137)

## Architecture Overview
Agentic Browser follows a layered architecture:
- Frontend: Extension UI and messaging channels
- Backend: FastAPI server and MCP server
- Agent runtime: LangGraph workflows and tooling
- LLM adapters: Provider-agnostic clients
- Safety: Guardrails and declarative action system

```mermaid
graph TB
subgraph "Extension"
UI["Sidepanel / Popup"]
WS["WebSocket Client"]
BG["Background Script"]
CT["Content Script"]
end
subgraph "Backend"
API["FastAPI Server"]
MCP["MCP Server"]
AG["Agent Orchestrator"]
end
subgraph "LLM Layer"
LLM["LargeLanguageModel"]
AD["Provider Adapters"]
end
subgraph "Tools"
BT["Browser Tools"]
WT["Web Tools"]
GT["Gmail/Calendar Tools"]
end
UI --> WS
WS --> BG
BG --> API
BG --> MCP
API --> AG
MCP --> AG
AG --> LLM
AG --> BT
AG --> WT
AG --> GT
LLM --> AD
CT --> BG
```

**Diagram sources**
- [main.py](file://main.py#L1-L58)
- [api/run.py](file://api/run.py#L1-L15)
- [mcp_server/server.py](file://mcp_server/server.py#L1-L139)
- [agents/react_agent.py](file://agents/react_agent.py#L1-L191)
- [agents/react_tools.py](file://agents/react_tools.py#L1-L721)
- [core/llm.py](file://core/llm.py#L1-L215)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L1-L800)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L1-L326)

## Detailed Component Analysis

### Mission and Objectives
- Model-agnostic intelligence: Seamless switching across providers and local models.
- Secure browser extension: WebExtensions-based design with explicit user approvals.
- Advanced agent workflows: RAG, persistent memory, and multi-step automation.
- Guardrails and transparency: User consent, logging, filtering, and allowlists.
- Open-source extensibility: Modular architecture for community contributions.

**Section sources**
- [README.md](file://README.md#L5-L62)

### Key Architectural Principles
- Model-agnostic design: Unified LLM adapter supports OpenAI, Anthropic, Ollama, and others.
- BYOKeys approach: Users supply their own API keys via environment or UI.
- MCP compliance: Structured tool definitions and standardized LLM invocation.
- Declarative action system: Natural language goals mapped to JSON action plans.

**Section sources**
- [README.md](file://README.md#L27-L33)
- [core/llm.py](file://core/llm.py#L21-L75)
- [mcp_server/server.py](file://mcp_server/server.py#L16-L80)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L137)

### Technical Stack Overview
- Agent orchestration: LangChain, LangGraph for stateful workflows.
- Browser control: WebExtensions API for tab/window control and DOM injection.
- LLM adapters: OpenRouter, Ollama, Anthropic, OpenAI, Hugging Face integrations.
- Backend agent: Python MCP server exposing tools and LLM generation.
- Retrieval and citation: Vector databases and RAG pipelines.
- Safety and guardrails: Logging, filtering, and explicit user consent.

**Section sources**
- [README.md](file://README.md#L66-L76)
- [pyproject.toml](file://pyproject.toml#L7-L29)

### Core Objectives in Practice
- Model-agnostic agent backend: Python, LangChain, MCP framework with provider adapters.
- Secure browser extension: Chrome/Firefox compatible via WebExtensions.
- Advanced agent workflows: RAG, persistent memory, multi-step tasks.
- Guardrails and transparency: User approval, logs, filtering, allowlists.
- Open-source extensibility: Modular tool and service architecture.

**Section sources**
- [README.md](file://README.md#L36-L63)

### Model-Agnostic LLM Adapter
The LLM adapter encapsulates provider-specific clients behind a unified interface. It supports multiple providers, validates API keys, and constructs client instances with configurable base URLs and models.

```mermaid
classDiagram
class LargeLanguageModel {
+string provider
+string model_name
+generate_text(prompt, system_message) str
+summarize_text(text) str
}
class Providers {
+dict PROVIDER_CONFIGS
}
LargeLanguageModel --> Providers : "uses"
```

**Diagram sources**
- [core/llm.py](file://core/llm.py#L78-L205)

**Section sources**
- [core/llm.py](file://core/llm.py#L21-L75)
- [core/llm.py](file://core/llm.py#L78-L205)

### MCP Server and Tooling
The MCP server exposes standardized tools for LLM generation, GitHub QA, website fetching, and HTML-to-markdown conversion. It dynamically initializes LLM clients based on incoming arguments and returns structured text content.

```mermaid
sequenceDiagram
participant Ext as "Extension"
participant BG as "Background Script"
participant MCP as "MCP Server"
participant LLM as "LargeLanguageModel"
Ext->>BG : "EXECUTE_AGENT_TOOL"
BG->>MCP : "call_tool(name, args)"
MCP->>LLM : "initialize(provider, model, api_key, base_url)"
LLM-->>MCP : "client instance"
MCP->>LLM : "generate_text(prompt, system_message)"
LLM-->>MCP : "text response"
MCP-->>BG : "TextContent(text)"
BG-->>Ext : "result"
```

**Diagram sources**
- [mcp_server/server.py](file://mcp_server/server.py#L83-L123)
- [core/llm.py](file://core/llm.py#L78-L205)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L516-L539)

**Section sources**
- [mcp_server/server.py](file://mcp_server/server.py#L16-L80)
- [mcp_server/server.py](file://mcp_server/server.py#L83-L123)

### Agent Orchestration and Tools
The ReAct agent uses LangGraph to alternate between reasoning and tool execution. It binds tools dynamically, manages conversation context, and converts between internal and external message formats.

```mermaid
flowchart TD
Start(["Start"]) --> Init["Initialize LLM and Tools"]
Init --> Loop{"Next Step"}
Loop --> |Agent| Plan["LLM decides next step"]
Plan --> ToolCheck{"Tool Needed?"}
ToolCheck --> |Yes| Exec["Execute Tool"]
ToolCheck --> |No| Reply["Generate Reply"]
Exec --> Loop
Reply --> Loop
Loop --> End(["End"])
```

**Diagram sources**
- [agents/react_agent.py](file://agents/react_agent.py#L138-L175)
- [agents/react_tools.py](file://agents/react_tools.py#L524-L702)

**Section sources**
- [agents/react_agent.py](file://agents/react_agent.py#L138-L175)
- [agents/react_tools.py](file://agents/react_tools.py#L524-L702)

### Browser Action Agent and Declarative Actions
The browser action agent translates natural language goals into JSON action plans. The prompt defines available actions (DOM manipulation and tab/window control) and enforces strict output formatting and selector selection rules.

```mermaid
sequenceDiagram
participant User as "User"
participant Agent as "ReAct Agent"
participant BA as "Browser Action Tool"
participant PU as "Prompt Chain"
participant BG as "Background Script"
participant CT as "Content Script"
User->>Agent : "Goal (e.g., search for flights)"
Agent->>BA : "generate_script(goal, dom_structure)"
BA->>PU : "invoke(prompt, llm_options)"
PU-->>BA : "JSON action plan"
BA-->>Agent : "action plan"
Agent-->>BG : "RUN_GENERATED_AGENT"
BG->>CT : "inject and execute actions"
CT-->>BG : "results"
BG-->>Agent : "status"
```

**Diagram sources**
- [tools/browser_use/tool.py](file://tools/browser_use/tool.py#L27-L40)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L137)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L470-L514)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L220-L323)

**Section sources**
- [tools/browser_use/tool.py](file://tools/browser_use/tool.py#L12-L48)
- [prompts/browser_use.py](file://prompts/browser_use.py#L5-L137)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L516-L539)

### Extension Messaging and Security
The extension uses explicit message types for agent tool execution, tab/window control, and action execution. Every action is logged and requires user consent, ensuring transparency and safety.

```mermaid
sequenceDiagram
participant UI as "Extension UI"
participant BG as "Background Script"
participant CT as "Content Script"
UI->>BG : "EXECUTE_ACTION"
BG->>CT : "PERFORM_ACTION"
CT-->>BG : "result"
BG-->>UI : "success/error"
```

**Diagram sources**
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L428-L449)
- [extension/entrypoints/content.ts](file://extension/entrypoints/content.ts#L198-L213)

**Section sources**
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L24-L128)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L428-L514)

## Dependency Analysis
The project relies on a curated set of libraries for LLM integration, web automation, and agent orchestration. The dependency graph highlights the central role of LangChain/LangGraph and MCP.

```mermaid
graph TB
LCA["langchain-core"]
LCG["langgraph"]
MCP["mcp"]
UVI["uvicorn"]
DOT["python-dotenv"]
LLM["core/llm.py"] --> LCA
LLM --> LCG
MCP["mcp_server/server.py"] --> MCP
API["api/run.py"] --> UVI
CFG["core/config.py"] --> DOT
```

**Diagram sources**
- [pyproject.toml](file://pyproject.toml#L7-L29)
- [core/llm.py](file://core/llm.py#L1-L18)
- [mcp_server/server.py](file://mcp_server/server.py#L1-L139)
- [api/run.py](file://api/run.py#L1-L15)
- [core/config.py](file://core/config.py#L1-L26)

**Section sources**
- [pyproject.toml](file://pyproject.toml#L7-L29)

## Performance Considerations
- Asynchronous tool execution: Tools leverage asyncio and thread pools to avoid blocking the main loop.
- Provider configuration caching: LLM clients are constructed on-demand with validated credentials.
- Minimal DOM manipulation: Content scripts inject only necessary scripts and dispatch minimal events.
- Efficient prompting: Prompt templates are concise and output-only JSON to reduce parsing overhead.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Missing environment variables: Ensure API keys and base URLs are configured in the environment.
- LLM initialization failures: Verify provider availability, base URLs, and model names.
- Extension action errors: Confirm tab permissions and that the content script is injected before execution.
- MCP tool errors: Validate tool names and argument schemas; check server logs for exceptions.

**Section sources**
- [core/config.py](file://core/config.py#L1-L26)
- [core/llm.py](file://core/llm.py#L13-L18)
- [core/llm.py](file://core/llm.py#L159-L205)
- [extension/entrypoints/background.ts](file://extension/entrypoints/background.ts#L516-L539)

## Conclusion
Agentic Browser delivers a model-agnostic, secure, and extensible platform for intelligent web automation. By combining MCP-compliant tooling, a declarative action system, and robust guardrails, it enables users to safely automate complex web tasks while maintaining control and transparency. The modular architecture invites community contributions and positions the project as a foundation for adaptive AI browser automation.