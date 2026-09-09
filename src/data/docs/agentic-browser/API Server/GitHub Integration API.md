# GitHub integration API

## Introduction
This page describes the GitHub integration API that enables repository analysis and contextual Q&A powered by a large language model. It supports:
- Repository ingestion via a normalized GitHub URL
- Context-aware question answering using repository summary, file tree, and content
- Optional file attachment processing via a cloud generative AI SDK
- Chat history integration for conversational context
- Reliable error handling and user-friendly messages for common failure modes

The API exposes a single endpoint that accepts a GitHub repository URL and a question, returning a Markdown-formatted answer derived from the repository context.

## Project structure
The GitHub integration spans several modules:
- API router: defines the endpoint and request/response models
- Service layer: orchestrates ingestion, optional file attachment processing, and LLM invocation
- Prompt pipeline: constructs a structured prompt with repository context and guidelines
- Tooling: converts a GitHub repository into a unified markdown-like context
- Configuration: loads environment variables and logging

```mermaid
graph TB
Client["Client"] --> API["FastAPI App<br/>/api/genai/github"]
API --> Router["GitHub Router<br/>POST /"]
Router --> Service["GitHubService"]
Service --> Tool["GitHub Crawler<br/>convert_github_repo_to_markdown"]
Service --> Prompt["Prompt Chain<br/>get_chain()"]
Service --> LLM["LargeLanguageModel"]
Service --> Config["Environment Config"]
Tool --> Gitingest["gitingest<br/>ingest_async/ingest"]
```

## Core components
- Endpoint: POST /api/genai/github
- Request body: GitHubRequest (URL, question, optional chat history, optional attached file path)
- Response body: GitHubResponse (content)
- Authentication: Not enforced by the endpoint; clients should secure access as appropriate for their deployment
- Rate limiting: Not implemented in the endpoint; consider upstream rate limiting and retries

## Architecture overview
The request lifecycle:
1. Client sends a POST request with a GitHub URL and question
2. Router validates presence of required fields and delegates to the service
3. Service normalizes the URL, ingests repository content, optionally attaches a file, and invokes the prompt chain
4. The prompt chain builds a structured prompt and queries the LLM
5. The response is returned as a Markdown-formatted string

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "FastAPI App"
participant Router as "GitHub Router"
participant Service as "GitHubService"
participant Tool as "convert_github_repo_to_markdown"
participant Prompt as "get_chain()"
participant LLM as "LargeLanguageModel"
Client->>API : "POST /api/genai/github"
API->>Router : "Dispatch request"
Router->>Service : "generate_answer(url, question, chat_history, attached_file_path)"
Service->>Tool : "convert_github_repo_to_markdown(url)"
Tool-->>Service : "InjestedContent(summary, tree, content)"
Service->>Prompt : "invoke(chain)"
Prompt->>LLM : "generate_content(prompt)"
LLM-->>Prompt : "response"
Prompt-->>Service : "Markdown answer"
Service-->>Router : "content"
Router-->>Client : "{ content }"
```

## Detailed component analysis

### Endpoint definition
- Method: POST
- Path: /api/genai/github
- Request JSON schema:
  - url: string (HTTP URL; must resolve to a GitHub repository)
  - question: string (required)
  - chat_history: array of objects (optional)
  - attached_file_path: string (optional; absolute path to a local file)
- Response JSON schema:
  - content: string (Markdown-formatted answer)

Behavior highlights:
- Validates presence of question and url
- Returns structured error messages for invalid inputs or ingestion failures
- Supports optional file attachment processing via a cloud generative AI SDK

### Service layer
Responsibilities:
- Normalize GitHub URL to repository root
- Ingest repository content (summary, tree, content)
- Optionally attach a file and query a cloud generative AI SDK
- Build and execute the prompt chain with repository context
- Return user-friendly error messages for common failure modes

Key logic:
- URL normalization strips non-repository path segments (e.g., commits, issues, pulls, tree, blob)
- Repository content is truncated to a maximum character limit to fit within LLM context windows
- Error handling differentiates between invalid URLs, inaccessible repositories, and token limit exceeded scenarios

```mermaid
flowchart TD
Start(["Entry: generate_answer"]) --> Normalize["Normalize GitHub URL"]
Normalize --> Ingest["Ingest repository content"]
Ingest --> IngestOK{"Ingestion OK?"}
IngestOK --> |No| HandleError["Return user-friendly error"]
IngestOK --> |Yes| AttachFile{"Attached file?"}
AttachFile --> |Yes| UploadFile["Upload file via cloud SDK"]
UploadFile --> BuildPrompt["Build prompt with repo context + chat history"]
BuildPrompt --> CallLLM["Call cloud SDK generate_content"]
CallLLM --> ReturnAnswer["Return response text"]
AttachFile --> |No| BuildPrompt2["Build prompt with repo context + chat history"]
BuildPrompt2 --> InvokeChain["Invoke LangChain chain"]
InvokeChain --> ReturnAnswer
```

### Prompt pipeline
The prompt pipeline composes:
- A system message instructing the model to answer solely from repository context
- Repository summary, file tree, and relevant content
- Optional chat history
- A user question
- Formatting guidelines for Markdown responses

The pipeline uses a LangChain chain with a prompt template and an LLM client, returning a string response.

### GitHub crawler tool
The crawler:
- Normalizes GitHub URLs to repository root
- Uses asynchronous ingestion when available, otherwise falls back to synchronous ingestion
- Truncates repository content to a maximum length to fit within LLM context windows
- Returns a structured content object containing summary, tree, and content

```mermaid
classDiagram
class InjestedContent {
+string tree
+string summary
+string content
}
class GitHubCrawler {
+_normalize_github_url(url) string
+convert_github_repo_to_markdown(repo_link) InjestedContent
}
GitHubCrawler --> InjestedContent : "returns"
```

### Configuration and environment
- Google API key is loaded from environment variables for optional file attachment processing
- Logging level is configurable via environment variables

## Dependency analysis
The GitHub integration depends on:
- FastAPI router for endpoint definition
- Pydantic models for request/response validation
- LangChain for prompt composition and LLM invocation
- gitingest for repository ingestion
- Optional cloud generative AI SDK for file attachment processing

```mermaid
graph LR
Router["routers/github.py"] --> Service["services/github_service.py"]
Service --> Tool["tools/github_crawler/convertor.py"]
Service --> Prompt["prompts/github.py"]
Service --> Config["core/config.py"]
Prompt --> LLM["LargeLanguageModel"]
Tool --> Gitingest["gitingest"]
```

## Performance considerations
- Repository content truncation: The crawler enforces a maximum content length to prevent exceeding LLM context windows. This preserves the tree and summary for navigation and structure while limiting large file content.
- Asynchronous ingestion: When available, asynchronous ingestion reduces latency in the request path.
- Optional file attachments: Uploading and processing attached files adds overhead; use judiciously and ensure the file size remains within SDK limits.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Invalid or non-repository URL:
  - Symptom: Error indicating the URL does not point to a valid repository root
  - Resolution: Navigate to the main repository page (e.g., github.com/owner/repo)
- Repository access errors:
  - Symptom: Could not access the repository; ensure the URL is correct and the repository is public
  - Resolution: Verify repository visibility and URL correctness
- Repository too large:
  - Symptom: Token limit exceeded even after truncation
  - Resolution: Ask about a specific file or directory instead of the entire repository
- Attached file processing errors:
  - Symptom: Failure to process the attached file
  - Resolution: Confirm the file path exists and the environment has a valid Google API key configured

## Conclusion
The GitHub integration API provides a streamlined pathway to analyze repositories and answer contextual questions. By normalizing URLs, truncating content, and using a structured prompt pipeline, it delivers reliable, Markdown-formatted answers. Optional file attachment support extends capabilities for multimodal workflows. For production deployments, consider adding authentication, rate limiting, and observability around ingestion and LLM calls.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API reference

- Base URL: /api/genai/github
- Method: POST
- Path: /
- Headers:
  - Content-Type: application/json
- Request body schema:
  - url: string (HTTP URL; must resolve to a GitHub repository)
  - question: string (required)
  - chat_history: array of objects (optional)
  - attached_file_path: string (optional; absolute path to a local file)
- Response body schema:
  - content: string (Markdown-formatted answer)

Example request payload:
- url: "https://github.com/example/repo"
- question: "Explain the main entry point"
- chat_history: [] or [{"role": "user", "content": "..."},...]
- attached_file_path: null or "/absolute/path/to/file"

Example response payload:
- content: "Markdown-formatted answer..."

Authentication:
- Not enforced by the endpoint; secure access according to your deployment needs

Rate limiting:
- Not implemented in the endpoint; implement upstream controls as needed

Webhook integration:
- Not implemented in this API; integrate external webhooks at the application boundary if required

Repository context extraction:
- The service normalizes the URL to the repository root and truncates content to fit within LLM context windows
