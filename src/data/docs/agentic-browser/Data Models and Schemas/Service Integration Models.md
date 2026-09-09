# Service integration models

## Introduction
This page describes the service integration schemas used across external services in the project. It focuses on request/response models for general service queries, crawler-specific structures, and GitHub integration models. It explains field definitions, validation rules, and transformation patterns, highlights shared patterns and service-specific variations, and outlines how these models relate to service implementations. Authentication data handling, rate-limiting considerations, and validation requirements are also addressed.

## Project structure
The service integration models are organized under a dedicated models namespace with separate packages for requests and responses. Supporting models include PyJIIT authentication payloads and YouTube video info structures. Services consume these models to orchestrate external integrations.

```mermaid
graph TB
subgraph "Models"
subgraph "Requests"
R_Ask["AskRequest"]
R_Crawl["CrawlerRequest"]
R_GitHub["GitHubRequest"]
R_React["ReactAgentRequest"]
R_Pyjiit["PyjiitLoginResponse"]
R_Website["WebsiteRequest"]
R_Subtitles["SubtitlesRequest"]
end
subgraph "Responses"
S_Ask["AskResponse"]
S_Crawl["CrawllerResponse"]
S_GitHub["GitHubResponse"]
S_React["ReactAgentResponse"]
S_Website["WebsiteResponse"]
S_Subtitles["SubtitlesResponse"]
end
M_YT["YTVideoInfo"]
end
subgraph "Services"
S_GitHub["GitHubService"]
end
R_Ask --> S_GitHub
R_Crawl --> S_GitHub
R_GitHub --> S_GitHub
R_React --> S_GitHub
R_Pyjiit --> S_GitHub
R_Website --> S_GitHub
R_Subtitles --> S_GitHub
S_GitHub --> S_Ask
S_GitHub --> S_Crawl
S_GitHub --> S_GitHub
S_GitHub --> S_React
S_GitHub --> S_Website
S_GitHub --> S_Subtitles
M_YT --> S_GitHub
```

## Core components
This section summarizes the primary request/response models used across services, highlighting shared fields and service-specific extensions.

- AskRequest/AskResponse
  - Purpose: General-purpose query with optional chat history and optional file attachment.
  - Fields:
    - AskRequest: url, question, chat_history (default empty list), attached_file_path (optional).
    - AskResponse: answer, video_title, video_channel.
  - Validation: Basic presence and type checks via Pydantic; url is validated as a URL in GitHubRequest variant.
  - Transformation: Used by services to construct prompts and parse LLM outputs.

- CrawlerRequest/CrawllerResponse
  - Purpose: Crawler-focused query with optional OAuth token, persisted PyJIIT login, client HTML, and optional file attachment.
  - Fields:
    - CrawlerRequest: question, chat_history (default empty list), google_access_token (alias support), pyjiit_login_response (alias support), client_html (optional), attached_file_path (optional).
    - CrawllerResponse: answer.
  - Validation: Aliased fields support tolerant parsing; Pydantic enforces presence/typing.
  - Transformation: Enables authenticated crawling and context injection.

- GitHubRequest/GitHubResponse
  - Purpose: GitHub repository Q&A with URL validation and optional attachments.
  - Fields:
    - GitHubRequest: url (HttpUrl), question, chat_history (default empty list), attached_file_path (optional).
    - GitHubResponse: content.
  - Validation: url enforced as HttpUrl; optional attachments supported.
  - Transformation: Converts repository to markdown, optionally attaches files, and invokes LLM chain.

- ReactAgentRequest/ReactAgentResponse
  - Purpose: Multi-turn conversational agent with structured messages and optional authentication.
  - Fields:
    - AgentMessage: role (enum-like literal), content (min length 1), name (optional), tool_call_id (optional), tool_calls (optional).
    - ReactAgentRequest: messages (non-empty list), google_access_token (alias support), pyjiit_login_response (alias support).
    - ReactAgentResponse: messages (final conversation state), output (latest assistant message).
  - Validation: Role constrained; content min length enforced; aliases supported.
  - Transformation: Aggregates tool calls and assistant replies into a final state.

- WebsiteRequest/WebsiteResponse
  - Purpose: Website-based Q&A with optional client HTML and file attachment.
  - Fields:
    - WebsiteRequest: url, question, chat_history (default empty list), client_html (optional), attached_file_path (optional).
    - WebsiteResponse: answer.
  - Validation: Basic presence/type checks; url treated as string.
  - Transformation: Supplies extracted page context to LLM.

- SubtitlesRequest/SubtitlesResponse
  - Purpose: Subtitle retrieval for a given video URL and language.
  - Fields:
    - SubtitlesRequest: url, lang (default "en").
    - SubtitlesResponse: subtitles.
  - Validation: Basic presence/type checks.
  - Transformation: Returns subtitle text for downstream processing.

- PyjiitLoginResponse
  - Purpose: Authentication payload from PyJIIT portal with derived session metadata.
  - Fields: raw_response, regdata, institute, instituteid, memberid, userid, token, expiry, clientid, membertype, name.
  - Validation: Nested typed fields; populate_by_name enabled.
  - Transformation: Provides JWT token and session identifiers for authenticated requests.

- YTVideoInfo
  - Purpose: Structured metadata for YouTube videos.
  - Fields: title, description, duration, uploader, upload_date, view_count, like_count, tags, categories, captions, transcript.
  - Validation: Defaults ensure safe fallbacks; optional fields accommodate missing data.
  - Transformation: Normalizes scraped or API-derived video metadata.

## Architecture overview
The service integration architecture follows a clear separation of concerns:
- Models define strict request/response schemas with validation.
- Services consume models, transform inputs, and produce outputs.
- Authentication payloads (e.g., PyJIIT) are embedded in requests to enable secure access to protected resources.
- Some services conditionally attach files or inject chat history to enrich prompts.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Service as "GitHubService"
participant Tool as "convert_github_repo_to_markdown"
participant LLM as "Prompt Chain"
Client->>Service : "generate_answer(GitHubRequest)"
Service->>Tool : "convert_github_repo_to_markdown(url)"
Tool-->>Service : "Repository content object"
alt "Attached file present"
Service->>Service : "Upload file via Google AI SDK"
Service->>LLM : "Invoke with content + file + chat history + question"
else "No attached file"
Service->>LLM : "Invoke with summary/tree/content + question + chat history"
end
LLM-->>Service : "Answer text"
Service-->>Client : "GitHubResponse(content)"
```

## Detailed component analysis

### AskRequest/AskResponse
- Shared pattern: Accepts a URL and question, supports optional chat history and an attached file path.
- Validation: Pydantic enforces field presence/type; url is validated as a URL in GitHubRequest variant.
- Transformation: Services use these fields to build prompts and parse LLM outputs into answer/video metadata.

```mermaid
flowchart TD
Start(["Build Ask Request"]) --> AddURL["Add url and question"]
AddURL --> AddHistory["Add optional chat_history"]
AddHistory --> AddFile["Add optional attached_file_path"]
AddFile --> Validate["Pydantic validation"]
Validate --> UseInService["Service consumes fields to generate answer"]
UseInService --> End(["Produce AskResponse"])
```

### CrawlerRequest/CrawllerResponse
- Shared pattern: Supports chat history, optional OAuth token, persisted PyJIIT login, client HTML, and attached file.
- Validation: Aliased fields tolerate minor typos during deserialization; defaults ensure safe handling.
- Transformation: Enables authenticated crawling and contextual enrichment via client HTML and attachments.

```mermaid
classDiagram
class CrawlerRequest {
+string question
+list chat_history
+string google_access_token
+PyjiitLoginResponse pyjiit_login_response
+string client_html
+string attached_file_path
}
class CrawllerResponse {
+string answer
}
CrawlerRequest --> CrawllerResponse : "produces"
```

### GitHubRequest/GitHubResponse
- Shared pattern: Validates URL as HttpUrl; supports optional chat history and attached file.
- Validation: Strict URL validation; optional fields allow flexible invocation.
- Transformation: Converts repository to markdown, optionally attaches files, and invokes LLM chain to produce content.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Service as "GitHubService"
participant Tool as "convert_github_repo_to_markdown"
participant LLM as "Prompt Chain"
Client->>Service : "GitHubRequest(url, question, ...)"
Service->>Tool : "Fetch repo"
Tool-->>Service : "Repo content"
Service->>LLM : "Invoke with context + question"
LLM-->>Service : "Answer"
Service-->>Client : "GitHubResponse(content)"
```

### ReactAgentRequest/ReactAgentResponse
- Shared pattern: Messages carry roles and optional tool calls; supports authentication via OAuth and PyJIIT login.
- Validation: Role constrained; content minimum length enforced; aliases improve robustness.
- Transformation: Aggregates final conversation state and assistant output for downstream consumption.

```mermaid
classDiagram
class AgentMessage {
+string role
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
ReactAgentRequest --> AgentMessage : "contains"
ReactAgentResponse --> AgentMessage : "contains"
```

### WebsiteRequest/WebsiteResponse
- Shared pattern: Accepts URL and question with optional client HTML and attached file.
- Validation: Basic presence/type checks; chat history defaults to empty list.
- Transformation: Supplies page context to LLM for targeted answers.

```mermaid
flowchart TD
Start(["Build Website Request"]) --> AddFields["Add url, question, optional client_html and attached_file_path"]
AddFields --> Validate["Pydantic validation"]
Validate --> UseInService["Service uses fields to generate answer"]
UseInService --> End(["Produce WebsiteResponse"])
```

### SubtitlesRequest/SubtitlesResponse
- Shared pattern: Retrieves subtitles for a given video URL and language.
- Validation: Basic presence/type checks; default language ensures robustness.
- Transformation: Returns subtitle text for downstream processing.

```mermaid
flowchart TD
Start(["Build Subtitles Request"]) --> AddURL["Add url"]
AddURL --> AddLang["Add optional lang (default 'en')"]
AddLang --> Validate["Pydantic validation"]
Validate --> UseInService["Service retrieves subtitles"]
UseInService --> End(["Produce SubtitlesResponse"])
```

### PyjiitLoginResponse
- Shared pattern: Encapsulates PyJIIT portal response and derived session metadata.
- Validation: Nested typed fields; populate_by_name enabled for consistent field access.
- Transformation: Provides JWT token and identifiers for authenticated requests across services.

```mermaid
classDiagram
class PyjiitLoginResponse {
+PyjiitRawResponse raw_response
+PyjiitRegData regdata
+string institute
+string instituteid
+string memberid
+string userid
+string token
+datetime expiry
+string clientid
+string membertype
+string name
}
class PyjiitRawResponse {
+PyjiitRegData regdata
+string clientidforlink
}
class PyjiitRegData {
+string bypass
+string clientid
+string userDOB
+string name
+string lastvisitdate
+string membertype
+string enrollmentno
+string userid
+string expiredpassword
+PyjiitInstituteEntry[] institutelist
+string memberid
+string token
}
class PyjiitInstituteEntry {
+string label
+string value
}
PyjiitLoginResponse --> PyjiitRawResponse : "has"
PyjiitRawResponse --> PyjiitRegData : "has"
PyjiitRegData --> PyjiitInstituteEntry : "contains"
```

### YTVideoInfo
- Shared pattern: Normalizes YouTube metadata with sensible defaults.
- Validation: Defaults prevent missing-field errors; optional fields handle sparse data.
- Transformation: Standardizes video info for downstream consumers.

```mermaid
classDiagram
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
```

## Dependency analysis
The models are decoupled from service implementations, enabling reuse across services. Authentication payloads (PyJIIT) are embedded in requests to support authenticated flows. Services selectively use subsets of request fields and map outputs to response models.

```mermaid
graph LR
R_Ask["AskRequest"] --> S_GitHub["GitHubService"]
R_Crawl["CrawlerRequest"] --> S_GitHub
R_GitHub["GitHubRequest"] --> S_GitHub
R_React["ReactAgentRequest"] --> S_GitHub
R_Pyjiit["PyjiitLoginResponse"] --> S_GitHub
R_Website["WebsiteRequest"] --> S_GitHub
R_Subtitles["SubtitlesRequest"] --> S_GitHub
S_GitHub --> S_Ask["AskResponse"]
S_GitHub --> S_Crawl["CrawllerResponse"]
S_GitHub --> S_GitHubResp["GitHubResponse"]
S_GitHub --> S_React["ReactAgentResponse"]
S_GitHub --> S_Website["WebsiteResponse"]
S_GitHub --> S_Subtitles["SubtitlesResponse"]
```

## Performance considerations
- Truncation and context limits: Services may truncate large repository content to fit model context windows.
- File uploads: Attaching large files increases payload size; consider chunking or streaming where applicable.
- Tokenization: Prefer summarization and selective content inclusion to reduce token usage.
- Caching: Reuse processed repository summaries and transcripts when possible.
- Rate limiting: Respect provider quotas; implement retries with exponential backoff for throttled requests.

## Troubleshooting guide
Common issues and resolutions:
- Invalid GitHub URL: Ensure the URL points to the repository root; otherwise, return a clear message instructing to navigate to the main repository page.
- Access failures: Verify repository visibility and URL correctness; return actionable guidance for 404 or clone-related errors.
- Context window exceeded: For very large repositories, suggest narrowing the question to specific files or directories.
- Attached file processing: If file upload fails, log the error and return a user-friendly message.
- Authentication: Validate PyJIIT token presence and expiry; ensure aliases are handled consistently.

## Conclusion
The service integration models provide a consistent, validated foundation for interacting with external services. Shared patterns enable cross-service compatibility, while service-specific variants address unique requirements such as authentication, file attachments, and specialized transformations. By adhering to these schemas and using the outlined best practices, developers can implement reliable integrations with predictable validation, error handling, and performance characteristics.
