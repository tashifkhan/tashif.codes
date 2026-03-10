# Validation and Error Handling

<cite>
**Referenced Files in This Document**
- [models/requests/website.py](file://models/requests/website.py)
- [models/response/website.py](file://models/response/website.py)
- [models/requests/react_agent.py](file://models/requests/react_agent.py)
- [models/response/react_agent.py](file://models/response/react_agent.py)
- [models/yt.py](file://models/yt.py)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py)
- [services/website_validator_service.py](file://services/website_validator_service.py)
- [routers/react_agent.py](file://routers/react_agent.py)
- [routers/website_validator.py](file://routers/website_validator.py)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py)
- [tools/pyjiit/wrapper.py](file://tools/pyjiit/wrapper.py)
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
This document explains the validation and error handling patterns used across the application’s model schemas and services. It focuses on:
- Pydantic validation rules and configuration
- Custom sanitization and prompt injection detection
- Error response formats and exception handling
- Input validation workflows and security considerations
- Debugging techniques and performance optimization strategies

## Project Structure
The validation and error handling spans several layers:
- Request/response models using Pydantic
- Routers that enforce basic input checks and translate exceptions
- Services that orchestrate validation, sanitization, and LLM-based checks
- Utilities for sanitization and prompt injection detection
- Domain-specific exception classes for robust error signaling

```mermaid
graph TB
subgraph "Routers"
RA["routers/react_agent.py"]
WV["routers/website_validator.py"]
end
subgraph "Services"
RAS["services/react_agent_service.py"]
WVS["services/website_validator_service.py"]
end
subgraph "Models"
RAM["models/requests/react_agent.py"]
RAR["models/response/react_agent.py"]
WRM["models/requests/website.py"]
WRR["models/response/website.py"]
YTM["models/yt.py"]
end
subgraph "Utilities"
SAN["utils/agent_sanitizer.py"]
PINJ["prompts/prompt_injection_validator.py"]
end
subgraph "Exceptions"
PYEX["tools/pyjiit/exceptions.py"]
PYWR["tools/pyjiit/wrapper.py"]
end
RA --> RAS
WV --> WVS
RAS --> RAM
RAS --> RAR
WVS --> WRM
WVS --> WRR
RAS --> SAN
WVS --> PINJ
PYWR --> PYEX
```

**Diagram sources**
- [routers/react_agent.py](file://routers/react_agent.py#L1-L57)
- [routers/website_validator.py](file://routers/website_validator.py#L1-L15)
- [services/react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [services/website_validator_service.py](file://services/website_validator_service.py#L1-L38)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L1-L45)
- [models/response/react_agent.py](file://models/response/react_agent.py#L1-L15)
- [models/requests/website.py](file://models/requests/website.py#L1-L11)
- [models/response/website.py](file://models/response/website.py#L1-L6)
- [models/yt.py](file://models/yt.py#L1-L17)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)
- [tools/pyjiit/wrapper.py](file://tools/pyjiit/wrapper.py#L1-L646)

**Section sources**
- [routers/react_agent.py](file://routers/react_agent.py#L1-L57)
- [routers/website_validator.py](file://routers/website_validator.py#L1-L15)
- [services/react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [services/website_validator_service.py](file://services/website_validator_service.py#L1-L38)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L1-L45)
- [models/response/react_agent.py](file://models/response/react_agent.py#L1-L15)
- [models/requests/website.py](file://models/requests/website.py#L1-L11)
- [models/response/website.py](file://models/response/website.py#L1-L6)
- [models/yt.py](file://models/yt.py#L1-L17)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)
- [tools/pyjiit/wrapper.py](file://tools/pyjiit/wrapper.py#L1-L646)

## Core Components
- Pydantic models define strict input contracts and defaults:
  - WebsiteRequest: validates URL, question, optional chat history, optional client HTML, and optional file path.
  - WebsiteValidatorRequest/Response: validates HTML input and produces a boolean safety flag.
  - AgentMessage and ReactAgentRequest: enforce message roles, minimum lengths, optional tool metadata, aliases for legacy fields, and whitespace trimming.
  - ReactAgentResponse: ensures final messages and output content are present.
  - YTVideoInfo: typed fields for YouTube metadata with defaults and optional transcript/captions.
- Router-level validation:
  - React agent endpoint enforces presence of question and converts errors to HTTP exceptions.
  - Website validator endpoint exposes a dedicated route returning a Pydantic response model.
- Sanitization utilities:
  - JSON action plan sanitizer validates structure, required fields, and action safety (including disallowed script patterns).
  - Legacy JS sanitizer detects disallowed patterns for backward compatibility.
- Prompt injection detection:
  - Website validator service converts HTML to Markdown and queries an LLM with a prompt designed to detect injection attempts.
- Exception taxonomy:
  - Domain-specific exceptions for API errors, login/session states, and account-related failures.

**Section sources**
- [models/requests/website.py](file://models/requests/website.py#L1-L11)
- [models/response/website.py](file://models/response/website.py#L1-L6)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L1-L45)
- [models/response/react_agent.py](file://models/response/react_agent.py#L1-L15)
- [models/yt.py](file://models/yt.py#L1-L17)
- [routers/react_agent.py](file://routers/react_agent.py#L18-L38)
- [routers/website_validator.py](file://routers/website_validator.py#L12-L14)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)
- [services/website_validator_service.py](file://services/website_validator_service.py#L9-L37)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)

## Architecture Overview
The validation pipeline integrates router-level checks, Pydantic model validation, and service-layer sanitization and LLM-based safety checks.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "routers/react_agent.py"
participant Service as "services/react_agent_service.py"
participant San as "utils/agent_sanitizer.py"
participant LLM as "LLM (via core.llm)"
participant Model as "models/requests/react_agent.py"
Client->>Router : "POST / (CrawlerRequest)"
Router->>Router : "Validate question presence"
Router->>Service : "generate_answer(question, ...)"
Service->>Model : "Pydantic validation of inputs"
Service->>San : "Sanitize JSON action plans (if applicable)"
Service->>LLM : "Invoke model with context"
LLM-->>Service : "Response"
Service-->>Router : "Answer string"
Router-->>Client : "200 OK with CrawllerResponse"
```

**Diagram sources**
- [routers/react_agent.py](file://routers/react_agent.py#L18-L38)
- [services/react_agent_service.py](file://services/react_agent_service.py#L16-L145)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L27-L44)

## Detailed Component Analysis

### Pydantic Validation Rules and Configuration
- WebsiteRequest
  - Enforces presence of URL and question.
  - chat_history defaults to an empty list; client_html and attached_file_path are optional.
  - No explicit length constraints are applied at the model level.
- WebsiteValidatorRequest/Response
  - WebsiteValidatorRequest accepts raw HTML; WebsiteValidatorResponse returns a boolean flag indicating safety.
- AgentMessage
  - role is constrained to a fixed set of literal values.
  - content has a minimum length constraint; whitespace is stripped globally via model configuration.
  - tool_call_id and tool_calls support aliases for backward compatibility.
- ReactAgentRequest
  - messages must be a non-empty list.
  - google_access_token supports aliasing for legacy clients; whitespace normalization enabled.
  - pyjiit_login_response is optional and can accept either a Pydantic model or dict.
- ReactAgentResponse
  - Ensures final messages and output content are present.
- YTVideoInfo
  - Provides sensible defaults for all fields; transcripts and captions are optional.

```mermaid
classDiagram
class WebsiteRequest {
+string url
+string question
+dict[] chat_history
+string client_html
+string attached_file_path
}
class WebsiteValidatorRequest {
+string html
}
class WebsiteValidatorResponse {
+bool is_safe
}
class AgentMessage {
+Literal role
+string content
+string name
+string tool_call_id
+List tool_calls
}
class ReactAgentRequest {
+AgentMessage[] messages
+string google_access_token
+PyjiitLoginResponse pyjiit_login_response
}
class ReactAgentResponse {
+AgentMessage[] messages
+string output
}
class YTVideoInfo {
+string title
+string description
+int duration
+string uploader
+string upload_date
+int view_count
+int like_count
+string[] tags
+string[] categories
+string captions
+string transcript
}
ReactAgentRequest --> AgentMessage : "contains"
ReactAgentResponse --> AgentMessage : "contains"
```

**Diagram sources**
- [models/requests/website.py](file://models/requests/website.py#L5-L11)
- [models/response/website.py](file://models/response/website.py#L4-L6)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L10-L44)
- [models/response/react_agent.py](file://models/response/react_agent.py#L10-L15)
- [models/yt.py](file://models/yt.py#L5-L17)

**Section sources**
- [models/requests/website.py](file://models/requests/website.py#L1-L11)
- [models/response/website.py](file://models/response/website.py#L1-L6)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L1-L45)
- [models/response/react_agent.py](file://models/response/react_agent.py#L1-L15)
- [models/yt.py](file://models/yt.py#L1-L17)

### Router-Level Validation and Error Handling
- React agent endpoint
  - Validates that the question is present; otherwise raises an HTTP 400.
  - Delegates to the service; any unhandled exceptions are caught and mapped to HTTP 500 with a sanitized detail.
- Website validator endpoint
  - Uses a Pydantic response model to serialize the safety result.

```mermaid
flowchart TD
Start(["Request received"]) --> CheckQuestion["Check 'question' field"]
CheckQuestion --> HasQuestion{"Present?"}
HasQuestion --> |No| HTTP400["Raise HTTP 400 Bad Request"]
HasQuestion --> |Yes| CallService["Call ReactAgentService.generate_answer"]
CallService --> HandleError{"Exception raised?"}
HandleError --> |Yes| HTTP500["Raise HTTP 500 Internal Server Error"]
HandleError --> |No| ReturnOK["Return CrawllerResponse"]
HTTP400 --> End(["Exit"])
HTTP500 --> End
ReturnOK --> End
```

**Diagram sources**
- [routers/react_agent.py](file://routers/react_agent.py#L23-L56)

**Section sources**
- [routers/react_agent.py](file://routers/react_agent.py#L18-L56)
- [routers/website_validator.py](file://routers/website_validator.py#L12-L14)

### Website Validator Service: Prompt Injection Detection
- Converts HTML to Markdown.
- Constructs a prompt template designed to detect prompt injection attempts.
- Invokes an LLM chain and interprets the result to produce a boolean safety flag.

```mermaid
sequenceDiagram
participant Router as "routers/website_validator.py"
participant Service as "services/website_validator_service.py"
participant HTMLMD as "tools.website_context.html_md"
participant Prompt as "prompts/prompt_injection_validator.py"
participant LLM as "core.llm"
Router->>Service : "validate_website(request)"
Service->>HTMLMD : "return_html_md(html)"
HTMLMD-->>Service : "markdown"
Service->>Prompt : "PromptTemplate(template, variables)"
Service->>LLM : "chain.invoke({markdown_text})"
LLM-->>Service : "result.content"
Service->>Service : "Parse 'true'/'false'"
Service-->>Router : "WebsiteValidatorResponse(is_safe)"
```

**Diagram sources**
- [services/website_validator_service.py](file://services/website_validator_service.py#L17-L37)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)

**Section sources**
- [services/website_validator_service.py](file://services/website_validator_service.py#L1-L38)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)

### Agent Sanitizer: JSON Action Plan Validation
- Removes code fences and trims input.
- Parses JSON and validates top-level structure and actions list.
- Enforces required fields per action type and applies safety checks for custom scripts.
- Returns parsed data and a list of validation problems.

```mermaid
flowchart TD
S(["Input text"]) --> Strip["Remove code fences and trim"]
Strip --> TryParse{"JSON parse ok?"}
TryParse --> |No| ReportErr["Append 'Invalid JSON' problem"] --> ReturnNull["Return None + problems"]
TryParse --> |Yes| ValidateStruct["Validate 'actions' array presence and type"]
ValidateStruct --> ActionsOk{"Valid actions?"}
ActionsOk --> |No| ReturnNull
ActionsOk --> |Yes| LoopActions["Iterate actions"]
LoopActions --> CheckType["Check 'type' in allowed set"]
CheckType --> TypeOk{"Valid type?"}
TypeOk --> |No| RecordProblem["Record invalid type problem"] --> NextAction["Next action"]
TypeOk --> |Yes| CheckFields["Check required fields per type"]
CheckFields --> ScriptSafety["Check script for dangerous patterns"]
ScriptSafety --> NextAction
NextAction --> |More| LoopActions
NextAction --> |Done| Done["Return data + problems"]
```

**Diagram sources**
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

**Section sources**
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)

### Exception Handling and Security Considerations
- Domain-specific exceptions:
  - APIError, LoginError, SessionError, SessionExpired, NotLoggedIn, AccountAPIError.
- Wrapper behavior:
  - Authentication guard checks session presence and raises appropriate exceptions.
  - HTTP responses are validated; unauthorized responses trigger session expiration handling.
- Security implications:
  - Prompt injection detection via LLM reduces risk of instruction contamination.
  - JSON action plan sanitizer enforces structural integrity and blocks known dangerous patterns.
  - Legacy JS sanitizer provides additional safeguards for older code paths.

```mermaid
classDiagram
class APIError
class LoginError
class SessionError
class SessionExpired
class NotLoggedIn
class AccountAPIError
APIError <|-- LoginError
SessionError <|-- SessionExpired
SessionError <|-- NotLoggedIn
```

**Diagram sources**
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)

**Section sources**
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)
- [tools/pyjiit/wrapper.py](file://tools/pyjiit/wrapper.py#L27-L46)
- [services/website_validator_service.py](file://services/website_validator_service.py#L17-L37)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L63-L74)

## Dependency Analysis
- Routers depend on services and Pydantic models for request/response shaping.
- Services depend on models for validation, on utilities for sanitization, and on LLMs for safety decisions.
- Exceptions are centralized under a domain module and used by wrappers to signal state transitions.

```mermaid
graph LR
RA["routers/react_agent.py"] --> RAS["services/react_agent_service.py"]
RA --> RAM["models/requests/react_agent.py"]
RAS --> RAM
RAS --> RAR["models/response/react_agent.py"]
WV["routers/website_validator.py"] --> WVS["services/website_validator_service.py"]
WVS --> WRM["models/requests/website.py"]
WVS --> WRR["models/response/website.py"]
WVS --> PINJ["prompts/prompt_injection_validator.py"]
RAS --> SAN["utils/agent_sanitizer.py"]
PYWR["tools/pyjiit/wrapper.py"] --> PYEX["tools/pyjiit/exceptions.py"]
```

**Diagram sources**
- [routers/react_agent.py](file://routers/react_agent.py#L1-L57)
- [services/react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [routers/website_validator.py](file://routers/website_validator.py#L1-L15)
- [services/website_validator_service.py](file://services/website_validator_service.py#L1-L38)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L1-L45)
- [models/response/react_agent.py](file://models/response/react_agent.py#L1-L15)
- [models/requests/website.py](file://models/requests/website.py#L1-L11)
- [models/response/website.py](file://models/response/website.py#L1-L6)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [tools/pyjiit/wrapper.py](file://tools/pyjiit/wrapper.py#L1-L646)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)

**Section sources**
- [routers/react_agent.py](file://routers/react_agent.py#L1-L57)
- [services/react_agent_service.py](file://services/react_agent_service.py#L1-L154)
- [routers/website_validator.py](file://routers/website_validator.py#L1-L15)
- [services/website_validator_service.py](file://services/website_validator_service.py#L1-L38)
- [models/requests/react_agent.py](file://models/requests/react_agent.py#L1-L45)
- [models/response/react_agent.py](file://models/response/react_agent.py#L1-L15)
- [models/requests/website.py](file://models/requests/website.py#L1-L11)
- [models/response/website.py](file://models/response/website.py#L1-L6)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompts/prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [tools/pyjiit/wrapper.py](file://tools/pyjiit/wrapper.py#L1-L646)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)

## Performance Considerations
- Prefer minimal validation overhead by leveraging Pydantic’s built-in constraints (e.g., min_length, literal enums).
- Avoid repeated parsing by caching intermediate results when feasible (e.g., Markdown conversion).
- Limit LLM calls to necessary inputs; batch or cache where appropriate.
- Use streaming or chunked processing for large documents to reduce latency.
- Apply early exits in sanitizers to avoid unnecessary work when inputs fail basic checks.

## Troubleshooting Guide
- Router-level 400 errors:
  - Ensure the question field is present and non-empty.
  - Verify request body matches the expected model shape.
- Router-level 500 errors:
  - Inspect service logs for underlying exceptions.
  - Confirm that the service returns a string on error rather than raising unhandled exceptions.
- Website validation failures:
  - Confirm HTML is well-formed before invoking the validator.
  - Review LLM response interpretation logic for unexpected content.
- JSON action plan issues:
  - Validate that actions arrays contain required fields per action type.
  - Check for disallowed script patterns flagged by the sanitizer.
- Exception classification:
  - Distinguish between session-related and API-level errors to apply correct retry/backoff strategies.

**Section sources**
- [routers/react_agent.py](file://routers/react_agent.py#L23-L56)
- [services/react_agent_service.py](file://services/react_agent_service.py#L147-L153)
- [services/website_validator_service.py](file://services/website_validator_service.py#L17-L37)
- [utils/agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)
- [tools/pyjiit/exceptions.py](file://tools/pyjiit/exceptions.py#L1-L23)

## Conclusion
The application employs a layered validation strategy combining Pydantic models, router-level checks, sanitization utilities, and LLM-based safety assessments. Exceptions are explicitly modeled to improve observability and error handling. By adhering to these patterns, developers can maintain robust input validation, secure processing, and predictable error reporting across the system.