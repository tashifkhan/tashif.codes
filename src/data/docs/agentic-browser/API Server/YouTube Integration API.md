# YouTube integration API

## Introduction
This page describes the YouTube integration API endpoints for video processing operations. It covers video information retrieval, subtitle extraction, transcript generation, and video analysis workflows. For each endpoint, it specifies HTTP methods, URL patterns, request/response schemas, and authentication requirements. It also documents YouTube-specific authentication, quota management considerations, and processing limitations, along with client implementation examples and integration patterns for automating video content scenarios.

## Project structure
The YouTube integration is implemented as a FastAPI application with modular components:
- Router: Defines the API endpoint(s) for YouTube operations.
- Service: Orchestrates processing logic and integrates with LLMs and YouTube utilities.
- Tools: Provides YouTube utilities for video info extraction, subtitle retrieval, and transcript generation.
- Prompts: Implements a prompt chain to contextualize LLM responses with YouTube content.
- Models: Defines request/response schemas for YouTube-related operations.

```mermaid
graph TB
subgraph "API Layer"
R["routers/youtube.py<br/>Defines endpoint '/api/genai/youtube/'"]
end
subgraph "Service Layer"
S["services/youtube_service.py<br/>YouTubeService.generate_answer(...)"]
end
subgraph "Prompt Layer"
P["prompts/youtube.py<br/>youtube_chain, get_context, fetch_transcript"]
end
subgraph "Tools Layer"
TI["tools/youtube_utils/get_info.py<br/>get_video_info(...)"]
TS["tools/youtube_utils/get_subs.py<br/>get_subtitle_content(...), download_audio_and_transcribe(...)"]
TE["tools/youtube_utils/extract_id.py<br/>extract_video_id(...)"]
end
subgraph "Models"
MI["models/yt.py<br/>YTVideoInfo"]
MR1["models/requests/video_info.py<br/>VideoInfoRequest"]
MR2["models/requests/subtitles.py<br/>SubtitlesRequest"]
end
R --> S
S --> P
S --> TI
S --> TS
TI --> MI
P --> TS
P --> TI
TE --> TI
TE --> TS
```

## Core components
- YouTube Endpoint
  - Method: POST
  - Path: /api/genai/youtube/
  - Purpose: Answer questions about a YouTube video using video metadata and transcript.
  - Authentication: Not enforced by the endpoint; however, downstream operations may require credentials for external APIs.
  - Request Schema: See `AskRequest` (referenced by router).
  - Response Schema: JSON object containing an answer string.
  - Example Request Body:
    - url: string (required)
    - question: string (required)
    - chat_history: array of entries (optional)
    - attached_file_path: string (optional)
  - Example Response:
    - answer: string

- Video Info Retrieval
  - Functionality: Extracts video metadata via yt-dlp and optionally attaches a cleaned transcript.
  - Implementation: `get_video_info`
  - Model: `YTVideoInfo`

- Subtitle Extraction and Transcript Generation
  - Functionality: Retrieves subtitles for a preferred language, falls back to alternative languages, and finally to audio transcription using Whisper if needed.
  - Implementation: `get_subtitle_content` and `download_audio_and_transcribe`
  - Request Schema: `SubtitlesRequest`

- Video ID Extraction
  - Functionality: Parses YouTube URLs to extract the video ID.
  - Implementation: `extract_video_id`

## Architecture overview
The YouTube integration follows a layered architecture:
- API Router receives requests and delegates to the YouTube Service.
- YouTube Service orchestrates:
  - Optional direct GenAI processing when an attached file is provided.
  - Prompt chain processing for question answering using video context.
- Prompt Chain:
  - Fetches transcript via tools.
  - Builds a structured prompt and invokes the LLM client.
- Tools:
  - Retrieve video info and subtitles.
  - Generate transcripts via Whisper fallback.

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router (/api/genai/youtube/)"
participant S as "YouTubeService"
participant P as "Prompt Chain"
participant T as "Tools (get_info/get_subs)"
C->>R : POST /api/genai/youtube/ {url, question, chat_history, attached_file_path}
R->>S : generate_answer(url, question, chat_history, attached_file_path)
alt attached_file_path provided
S->>S : Upload file to GenAI and prepare multimodal content
else no attached file
S->>P : Invoke youtube_chain with {url, question, chat_history}
P->>T : fetch_transcript(url)
T-->>P : transcript text
P->>P : Build prompt and call LLM
end
S-->>R : answer
R-->>C : {answer}
```

## Detailed component analysis

### Endpoint: POST /api/genai/youtube/
- Purpose: Answer questions about a YouTube video using video metadata and transcript.
- Authentication: Not enforced at the endpoint level.
- Request Validation:
  - url and question are required; otherwise returns 400.
- Processing:
  - Converts chat history to a string.
  - Calls YouTubeService.generate_answer.
- Response:
  - JSON with answer field.

```mermaid
flowchart TD
Start(["POST /api/genai/youtube/"]) --> Validate["Validate url and question"]
Validate --> Valid{"Valid?"}
Valid --> |No| Err400["Return 400 Bad Request"]
Valid --> |Yes| Prepare["Prepare chat history string"]
Prepare --> CallService["Call YouTubeService.generate_answer(url, question, chat_history, attached_file_path)"]
CallService --> Return["Return {answer}"]
```

### YouTubeService: generate_answer
- Behavior:
  - If attached_file_path is provided, uploads the file to GenAI and constructs multimodal content including optional transcript and chat history.
  - Otherwise, uses the prompt chain to answer the question based on video context.
- Error Handling:
  - Returns a user-friendly message on failures.

```mermaid
flowchart TD
Start(["generate_answer(url, question, chat_history, attached_file_path)"]) --> HasFile{"attached_file_path provided?"}
HasFile --> |Yes| GenAIUpload["Upload file to GenAI client"]
GenAIUpload --> TryTranscript["Attempt to fetch YouTube transcript"]
TryTranscript --> BuildContent["Build multimodal content list"]
BuildContent --> CallGenAI["Call GenAI generate_content"]
CallGenAI --> ReturnAnswer["Return response text"]
HasFile --> |No| UseChain["Invoke youtube_chain with {url, question, chat_history}"]
UseChain --> ReturnAnswer
```

### Prompt chain: youtube_chain
- Context Retrieval:
  - fetch_transcript(url): Downloads subtitles, cleans them, and returns a processed transcript string.
- Prompt Construction:
  - Uses a structured prompt template that instructs the LLM to answer questions strictly from the provided context and schema.
- Execution:
  - Composed pipeline: get_context → prompt → LLM → parser.

```mermaid
flowchart TD
A["get_context({url})"] --> B["fetch_transcript(url)"]
B --> C["processed_transcript(...)"]
C --> D["PromptTemplate with context, question, chat_history"]
D --> E["LLM client"]
E --> F["StrOutputParser"]
```

### Subtitle extraction and transcript generation
- Priority:
  1) Preferred language subtitles (manual + auto-generated + auto-translated) in a single pass.
  2) Alternative language from available tracks.
  3) Whisper audio transcription fallback.
- Error Handling:
  - Handles rate limits, unavailable videos, and subtitle errors gracefully.
  - Cleans up temporary directories after processing.

```mermaid
flowchart TD
Start(["get_subtitle_content(url, lang=en)"]) --> SinglePass["Single-pass: preferred language subs"]
SinglePass --> Found{"Found content?"}
Found --> |Yes| Return1["Return content"]
Found --> |No| AltLang["Find alternative language"]
AltLang --> AltFound{"Alternative found?"}
AltFound --> |Yes| TryAlt["Download and extract alt-lang subs"]
TryAlt --> AltContent{"Alt content?"}
AltContent --> |Yes| Return2["Return alt content"]
AltContent --> |No| Whisper["Fallback: download audio and transcribe with Whisper"]
AltFound --> |No| Whisper
Whisper --> Return3["Return transcript"]
```

### Video info retrieval
- Uses yt-dlp to extract metadata and optionally attach a cleaned transcript.
- Known error detection prevents returning error messages as valid transcripts.

```mermaid
flowchart TD
Start(["get_video_info(video_url)"]) --> YTDLP["yt-dlp extract_info"]
YTDLP --> BuildMap["Build YTVideoInfo map from metadata"]
BuildMap --> FetchSubs["get_subtitle_content(url)"]
FetchSubs --> IsError{"Is error message?"}
IsError --> |Yes| Skip["Skip transcript"]
IsError --> |No| Clean["processed_transcript(...)"]
Clean --> Attach["Attach transcript to video_data"]
Skip --> Return["Return YTVideoInfo"]
Attach --> Return
```

### Video ID extraction
- Supports youtube.com and youtu.be domains.
- Parses query parameters or path to extract the video ID.

```mermaid
flowchart TD
Start(["extract_video_id(url)"]) --> Parse["Parse URL hostname and query"]
Parse --> HostType{"Host type?"}
HostType --> |youtube.com/www.youtube.com| GetParam["Extract 'v' param"]
HostType --> |youtu.be| GetPath["Take path after '/'"]
GetParam --> Return["Return video ID or None"]
GetPath --> Return
```

## Dependency analysis
- Router depends on YouTubeService.
- YouTubeService depends on:
  - Prompt chain (youtube_chain) for non-file processing.
  - Tools for subtitle and video info retrieval.
- Prompt chain depends on:
  - Tools for transcript fetching and processing.
- Models define request/response schemas used across components.

```mermaid
graph LR
R["routers/youtube.py"] --> S["services/youtube_service.py"]
S --> P["prompts/youtube.py"]
S --> TI["tools/youtube_utils/get_info.py"]
S --> TS["tools/youtube_utils/get_subs.py"]
P --> TS
P --> TI
TI --> M["models/yt.py"]
R --> MR["models/requests/ask.py"]
```

## Performance considerations
- Subtitle Retrieval:
  - Single-pass retrieval minimizes API calls and avoids rate limiting.
  - Fallback to Whisper transcription adds latency; consider caching results.
- Whisper Transcription:
  - Uses a lightweight model by default; adjust model size/device for accuracy/performance trade-offs.
- Temporary Files:
  - Ensure cleanup of temporary directories to prevent disk pressure.
- Rate Limits:
  - yt-dlp and external services may throttle; implement retries with exponential backoff and circuit breaker patterns.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Common Issues:
  - Video unavailable: Returned when the video cannot be accessed.
  - Subtitles not available: Handled by falling back to Whisper transcription.
  - Rate limited (429): Detected and triggers Whisper fallback.
  - Unexpected errors: Logged and returned as user-friendly messages.
- Logging:
  - Extensive logging is used across tools and services to aid debugging.

## Conclusion
The YouTube Integration API provides a reliable foundation for video content automation. It supports question answering using video metadata and transcripts, with intelligent fallbacks to ensure resilience. By using modular components and clear schemas, it enables flexible client integrations for diverse automation scenarios.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API reference

- Endpoint: POST /api/genai/youtube/
  - Description: Answers questions about a YouTube video using video metadata and transcript.
  - Authentication: Not enforced at the endpoint.
  - Request JSON Schema:
    - url: string (required)
    - question: string (required)
    - chat_history: array of entries (optional)
    - attached_file_path: string (optional)
  - Response JSON Schema:
    - answer: string
  - Example Request:
    - {
      "url": "https://www.youtube.com/watch?v=...",
      "question": "What is this video about?",
      "chat_history": [],
      "attached_file_path": null
    }
  - Example Response:
    - {
      "answer": "This video is about..."
    }

### YouTube-Specific authentication and quota management
- External API Credentials:
  - GenAI client requires an API key via environment variables.
  - Downstream tools may rely on yt-dlp and Whisper; ensure appropriate quotas and rate limits are respected.
- Recommendations:
  - Store API keys securely and rotate them periodically.
  - Implement retry logic and circuit breakers for rate-limited endpoints.
  - Monitor logs for frequent rate-limit or availability errors.

### Client implementation examples
- Basic Question Answering:
  - Send a POST request to /api/genai/youtube/ with url and question.
  - Use chat_history for conversational context.
- File-Attached Processing:
  - Provide attached_file_path to use multimodal GenAI capabilities.
  - Ensure the file is accessible to the server process.
- Subtitle Retrieval:
  - Use SubtitlesRequest schema to specify url and desired language.
  - Handle fallback to Whisper when subtitles are unavailable.

### Integration patterns
- Content Automation Scenarios:
  - Summarization: Use question templates to summarize video content.
  - Topic Extraction: Use tags, categories, and transcript for topic discovery.
  - Sentiment Analysis: Use transcript to infer sentiment.
  - Related Content Discovery: Use tags and categories to suggest related topics.
- Best Practices:
  - Cache video metadata and transcripts to reduce repeated downloads.
  - Validate YouTube URLs and extract IDs before processing.
  - Respect rate limits and implement graceful degradation to Whisper fallback.
