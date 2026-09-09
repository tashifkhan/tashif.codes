# API overview

## Introduction
This page provides a detailed API overview for the FastAPI server. It explains the overall architecture, endpoint organization, routing structure, and how base URL patterns map to distinct service areas. It also covers application initialization, startup modes, logging configuration, and error handling strategies. Authentication mechanisms are documented in terms of access tokens passed via request bodies, and CORS configuration is noted as not being explicitly configured in the provided code. Health checks and monitoring interfaces are described, along with practical usage patterns and integration scenarios.

## Project structure
The API server is organized around a FastAPI application that aggregates multiple routers under distinct base prefixes. Each router corresponds to a functional area (e.g., GenAI, Google Search, Gmail, Calendar, PyJiit, React Agent, Website, Validator, Upload). The application can be started either as the API server or as an MCP server via a top-level entry point.

```mermaid
graph TB
A_main["main.py<br/>Entry point"] --> B_api_run["api/run.py<br/>run(host,port,reload)"]
B_api_run --> C_api_main["api/main.py<br/>FastAPI app + router mounts"]
C_api_main --> D_routers["routers/*<br/>Feature-specific routers"]
D_routers --> E_health["/api/genai/health"]
D_routers --> F_genai_github["/api/genai/github"]
D_routers --> G_genai_website["/api/genai/website"]
D_routers --> H_genai_youtube["/api/genai/youtube"]
D_routers --> I_google_search["/api/google-search"]
D_routers --> J_gmail["/api/gmail"]
D_routers --> K_calendar["/api/calendar"]
D_routers --> L_pyjiit["/api/pyjiit"]
D_routers --> M_genai_react["/api/genai/react"]
D_routers --> N_validator["/api/validator"]
D_routers --> O_agent["/api/agent"]
D_routers --> P_upload["/api/upload"]
```

## Core components
- Application factory and router mounts: The FastAPI app is created and routers are included under base prefixes to segment functionality by domain.
- Startup orchestration: A top-level script chooses between running the API server or the MCP server, delegating to the API runner.
- Configuration and logging: Environment variables drive runtime behavior and logging level; a shared logger getter is used across modules.
- Health endpoint: A dedicated router exposes a simple health check returning a structured response model.

Key implementation references:
- Application creation and router mounts: `api/main.py`
- Startup selection and API runner: `main.py`, `api/run.py`
- Configuration and logging: `core/config.py`, `core/config.py`
- Health response model: `models/response/health.py`
- Health handler: `routers/health.py`

## Architecture overview
The API follows a modular FastAPI architecture:
- Central app definition and router composition
- Feature-based routers grouped under base prefixes
- Request validation via Pydantic models
- Service-layer delegation per router
- Global exception handling returning standardized HTTP errors
- Optional root endpoint returning app metadata

```mermaid
graph TB
subgraph "API Layer"
APP["FastAPI app"]
R_HEALTH["/api/genai/health"]
R_GENAI_GITHUB["/api/genai/github"]
R_GENAI_WEBSITE["/api/genai/website"]
R_GENAI_YOUTUBE["/api/genai/youtube"]
R_GOOGLE_SEARCH["/api/google-search"]
R_GMAIL["/api/gmail"]
R_CALENDAR["/api/calendar"]
R_PYJIIT["/api/pyjiit"]
R_GENAI_REACT["/api/genai/react"]
R_VALIDATOR["/api/validator"]
R_AGENT["/api/agent"]
R_UPLOAD["/api/upload"]
end
subgraph "Service Layer"
S_GMAIL["GmailService"]
S_CALENDAR["CalendarService"]
end
APP --> R_HEALTH
APP --> R_GENAI_GITHUB
APP --> R_GENAI_WEBSITE
APP --> R_GENAI_YOUTUBE
APP --> R_GOOGLE_SEARCH
APP --> R_GMAIL
APP --> R_CALENDAR
APP --> R_PYJIIT
APP --> R_GENAI_REACT
APP --> R_VALIDATOR
APP --> R_AGENT
APP --> R_UPLOAD
R_GMAIL --> S_GMAIL
R_CALENDAR --> S_CALENDAR
```

## Detailed component analysis

### Endpoint organization and base URL patterns
Routers are mounted under the following base prefixes to separate service domains:
- GenAI family: /api/genai/health, /api/genai/github, /api/genai/website, /api/genai/youtube, /api/genai/react
- Google family: /api/google-search
- Productivity: /api/gmail, /api/calendar, /api/pyjiit
- Validation and utilities: /api/validator, /api/agent, /api/upload

These mounts are defined in the central app file and exported via the routers package.

### Health check endpoint
- Path: GET /api/genai/health
- Handler: Returns a structured response indicating service health
- Response model: HealthResponse with status and message fields

```mermaid
sequenceDiagram
participant C as "Client"
participant A as "FastAPI app"
participant H as "Health Router"
participant M as "HealthResponse"
C->>A : "GET /api/genai/health"
A->>H : "Dispatch to health handler"
H->>M : "Construct response model"
H-->>A : "HealthResponse"
A-->>C : "200 OK with {status,message}"
```

### Website answer endpoint
- Path: POST /api/genai/website
- Request model: WebsiteRequest (validated in router)
- Service: WebsiteService injected via dependency
- Behavior: Validates presence of URL and question; delegates to service; returns answer in a dictionary
- Error handling: Raises HTTP 400 for missing fields; wraps unexpected errors as HTTP 500

```mermaid
sequenceDiagram
participant C as "Client"
participant A as "FastAPI app"
participant W as "Website Router"
participant S as "WebsiteService"
participant L as "Logger"
C->>A : "POST /api/genai/website"
A->>W : "Dispatch to website()"
W->>W : "Validate url and question"
W->>S : "generate_answer(url, question, chat_history, client_html)"
S-->>W : "Answer string"
W-->>A : "{answer : ...}"
A-->>C : "200 OK"
Note over W,L : "On error, log and raise HTTP 400/500"
```

### Google search endpoint
- Path: POST /api/google-search
- Request model: SearchRequest with query and optional max_results
- Service: GoogleSearchService injected via dependency
- Behavior: Validates query; calls service.search; returns results in a dictionary
- Error handling: Raises HTTP 400 for invalid input; wraps unexpected errors as HTTP 500

```mermaid
sequenceDiagram
participant C as "Client"
participant A as "FastAPI app"
participant G as "GoogleSearch Router"
participant S as "GoogleSearchService"
C->>A : "POST /api/google-search"
A->>G : "Dispatch to google_search()"
G->>G : "Validate query"
G->>S : "search(query, max_results)"
S-->>G : "Results list"
G-->>A : "{\"results\" : [...]}"
A-->>C : "200 OK"
Note over G : "On error, raise HTTP 400/500"
```

### Gmail endpoints
- Paths:
  - POST /api/gmail/unread
  - POST /api/gmail/latest
  - POST /api/gmail/mark_read
  - POST /api/gmail/send
- Request models: UnreadRequest, LatestRequest, MarkReadRequest, SendEmailRequest (all require access_token)
- Service: GmailService injected via dependency
- Behavior: Validates required fields; calls appropriate service methods; returns structured results
- Error handling: Raises HTTP 400 for missing fields; wraps unexpected errors as HTTP 500

```mermaid
sequenceDiagram
participant C as "Client"
participant A as "FastAPI app"
participant GM as "Gmail Router"
participant S as "GmailService"
C->>A : "POST /api/gmail/send"
A->>GM : "Dispatch to send_message()"
GM->>GM : "Validate access_token, to, subject"
GM->>S : "send_message(access_token, to, subject, body)"
S-->>GM : "Result dict"
GM-->>A : "{\"result\" : \"sent\",\"details\" : ...}"
A-->>C : "200 OK"
Note over GM : "On error, raise HTTP 400/500"
```

### Calendar endpoints
- Paths:
  - POST /api/calendar/events
  - POST /api/calendar/create
- Request models: EventsRequest (requires access_token), CreateEventRequest (requires access_token, summary, start_time, end_time)
- Service: CalendarService injected via dependency
- Behavior: Validates required fields and ISO 8601 timestamps; calls service methods; returns structured results
- Error handling: Raises HTTP 400 for invalid input; wraps unexpected errors as HTTP 500

```mermaid
flowchart TD
Start(["Request Received"]) --> Validate["Validate access_token and fields"]
Validate --> FieldsOK{"Required fields present?"}
FieldsOK --> |No| Err400["Raise HTTP 400"]
FieldsOK --> |Yes| TimeFmt["Check ISO 8601 format"]
TimeFmt --> TimeOK{"Valid ISO 8601?"}
TimeOK --> |No| Err400b["Raise HTTP 400"]
TimeOK --> |Yes| CallSvc["Call CalendarService"]
CallSvc --> Result["Return structured response"]
Err400 --> End(["End"])
Err400b --> End
Result --> End
```

### React agent endpoint
- Path: POST /api/genai/react
- Request model: CrawlerRequest (validated in router)
- Service: ReactAgentService injected via dependency
- Behavior: Validates question; delegates to service.generate_answer; returns CrawllerResponse
- Error handling: Raises HTTP 400 for missing question; wraps unexpected errors as HTTP 500

```mermaid
sequenceDiagram
participant C as "Client"
participant A as "FastAPI app"
participant RA as "ReactAgent Router"
participant S as "ReactAgentService"
C->>A : "POST /api/genai/react"
A->>RA : "Dispatch to agent_bhai()"
RA->>RA : "Validate question"
RA->>S : "generate_answer(question, chat_history, ...)"
S-->>RA : "Answer string"
RA-->>A : "CrawllerResponse"
A-->>C : "200 OK"
Note over RA : "On error, raise HTTP 400/500"
```

### Application initialization, middleware, and global settings
- Application creation: FastAPI app is instantiated with title and version.
- Router mounts: Routers are imported from the routers package and mounted under base prefixes.
- Root endpoint: Optional GET "/" returns app metadata.
- No explicit middleware or CORS configuration is present in the provided code.
- Logging: Centralized logger getter is used across modules; environment variables control debug level and backend host/port.

### Authentication mechanisms
- Access tokens are passed via request bodies for sensitive operations:
  - Gmail: access_token required for all endpoints
  - Calendar: access_token required for all endpoints
  - Website: no token required in the endpoint shown
  - Google Search: no token required in the endpoint shown
- The code does not implement bearer token middleware or route guards; token validation occurs inside each endpoint's request model and service invocation.

### CORS configuration
- No explicit CORS configuration is present in the provided code. If cross-origin requests are needed, configure CORS in the FastAPI app before including routers.

[No sources needed since this section provides general guidance]

### Error handling strategies
- Centralized try/catch blocks in each endpoint:
  - Raise HTTP 400 for invalid input (missing fields, malformed data)
  - Wrap unexpected exceptions as HTTP 500 with sanitized details
- Services log exceptions internally; endpoints re-raise as HTTP exceptions to maintain consistent error responses.

### Monitoring interfaces
- Health endpoint: GET /api/genai/health provides a simple readiness/liveness indicator.
- Logging: Centralized logger is used across modules; environment controls verbosity.

### Basic API usage patterns and integration scenarios
- Start the API server:
  - Run the top-level script and choose API mode, or pass the --api flag.
  - The API listens on host and port configured via environment variables.
- Example flows:
  - Website QA: POST to /api/genai/website with a URL and question; receive an answer.
  - Google Search: POST to /api/google-search with a query and optional max_results; receive results.
  - Gmail operations: Use access_token in request bodies to list unread messages, fetch latest messages, mark read, or send emails.
  - Calendar operations: Use access_token to list events or create events with ISO 8601 start/end times.
  - Health check: GET /api/genai/health to verify service availability.

## Dependency analysis
The API module composes routers and services with clear separation of concerns. Routers depend on service classes, which encapsulate tool integrations. The central app depends on the routers package for imports and mounts.

```mermaid
graph LR
MAIN["api/main.py"] --> RINIT["routers/__init__.py"]
MAIN --> HEALTH["routers/health.py"]
MAIN --> WEBSITE["routers/website.py"]
MAIN --> GOOGLE["routers/google_search.py"]
MAIN --> GMAIL["routers/gmail.py"]
MAIN --> CALENDAR["routers/calendar.py"]
MAIN --> REACT["routers/react_agent.py"]
WEBSITE --> WSVC["WebsiteService"]
GOOGLE --> GSS["GoogleSearchService"]
GMAIL --> GSVC["GmailService"]
CALENDAR --> CSVC["CalendarService"]
REACT --> RAS["ReactAgentService"]
```

## Performance considerations
- Keep request payloads minimal; avoid unnecessary fields to reduce parsing overhead.
- Validate inputs early in routers to fail fast and reduce downstream processing.
- Reuse injected services per request to minimize initialization costs.
- Monitor logs and adjust logging level via environment variables for production deployments.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Health check failures:
  - Verify GET /api/genai/health returns the expected status and message.
- 400 Bad Request errors:
  - Ensure required fields are present (e.g., query, access_token, question).
- 500 Internal Server Errors:
  - Inspect logs for exception traces; services already log exceptions internally.
- Startup issues:
  - Confirm environment variables for host/port and debug level are set appropriately.
  - Use the top-level script to select API mode and run the server.

## Conclusion
The FastAPI server organizes functionality into clearly separated routers under distinct base prefixes, enabling modular development and clear ownership of features. The application initializes cleanly, exposes a health endpoint, and handles errors consistently. Authentication is token-based and validated at the router level. While CORS and middleware are not configured in the provided code, the architecture supports easy addition of such features. The documented endpoints and usage patterns provide a solid foundation for integrating clients and extending functionality.

## Appendices
- Startup command and mode selection are handled by the top-level script, which delegates to the API runner.
