# Troubleshooting & FAQ

## Update summary
**Changes Made**
- Updated logging section to reflect the removal of verbose debug logging mode and improved logging levels
- Removed references to temporary logging enhancements that are no longer part of the codebase
- Updated troubleshooting guidance to match current logging capabilities
- Revised performance considerations to reflect simplified logging approach

## Introduction
This page provides detailed troubleshooting and Frequently Asked Questions for the TalentSync-Normies platform. It covers installation and environment setup issues, Docker configuration pitfalls, runtime errors and debugging techniques, performance tuning, AI/ML and NLP pipeline failures, and frontend-specific problems such as build errors, routing, and authentication. It also includes practical debugging tools and techniques for different environments, along with actionable answers to common questions about system requirements, feature limitations, and usage scenarios.

## Project structure
The platform consists of:
- Backend: Python FastAPI application with AI/ML integrations, logging, and middleware.
- Frontend: Next.js application with PWA, PostHog instrumentation, and strict browser bundling rules.
- Database: PostgreSQL managed via Docker Compose.
- AI/ML assets: NLP model artifacts and pickled vectorizers packaged inside the backend container.

```mermaid
graph TB
subgraph "Docker Orchestration"
DC["docker-compose.yaml"]
end
subgraph "Backend"
BD["backend/Dockerfile"]
ENV_B[".env (backend)"]
PY["pyproject.toml"]
MAIN["app/main.py"]
LOG["app/core/logging.py"]
EXC["app/core/exceptions.py"]
SET["app/core/settings.py"]
end
subgraph "Frontend"
FD["frontend/Dockerfile"]
ENV_F[".env (frontend)"]
PKG["package.json"]
NEXT["next.config.js"]
ERR["lib/error-utils.ts"]
end
DB["PostgreSQL (external service)"]
DC --> BD
DC --> FD
DC --> DB
BD --> ENV_B
FD --> ENV_F
MAIN --> LOG
MAIN --> EXC
MAIN --> SET
FD --> NEXT
FD --> ERR
BD --> PY
FD --> PKG
```

## Core components
- Logging and request tracing: Structured logs with request IDs, access logs, and configurable log levels.
- Exception hierarchy: Centralized HTTP exception types for consistent error responses.
- Settings and configuration: Environment-driven configuration with caching and optional external keys.
- Middleware: CORS, request/response logging, and request ID propagation.
- Frontend error extraction: Utility to normalize thrown errors into user-friendly messages.

Key implementation references:
- Logging configuration and request ID propagation: `backend/app/core/logging.py`
- Exception types: `backend/app/core/exceptions.py`
- Settings and environment loading: `backend/app/core/settings.py`
- Request/response logging middleware: `backend/app/main.py`
- Frontend error normalization: `frontend/lib/error-utils.ts`

## Architecture overview
High-level runtime flow:
- Frontend communicates with backend via internal Docker network.
- Backend exposes API routes grouped by feature areas.
- PostgreSQL stores application data; migrations are executed during frontend startup.
- AI/ML processing relies on configured LLM provider and model settings.

```mermaid
sequenceDiagram
participant Client as "Browser"
participant FE as "Frontend (Next.js)"
participant BE as "Backend (FastAPI)"
participant DB as "PostgreSQL"
Client->>FE : "HTTP request"
FE->>BE : "Fetch /api/v1/... or /api/v2/..."
BE->>DB : "Execute queries/migrations"
DB-->>BE : "Rows/Affected rows"
BE-->>FE : "JSON response"
FE-->>Client : "Render UI"
```

## Detailed component analysis

### Backend logging and tracing
- Request ID propagation via context variable ensures correlation across logs.
- Access logs capture client address, method, path, and status code.
- Log level respects settings and defaults to INFO for access logs.

```mermaid
flowchart TD
Start(["Incoming HTTP request"]) --> BuildID["Build request ID"]
BuildID --> BindCtx["Bind request ID to context"]
BindCtx --> CallNext["Call downstream handler"]
CallNext --> CaptureResp["Capture response body chunks"]
CaptureResp --> ComputeDuration["Compute duration"]
ComputeDuration --> LogReq["Log request payload"]
LogReq --> LogResp["Log response payload + duration"]
LogResp --> ResetCtx["Reset context"]
ResetCtx --> End(["Return response"])
```

### Exception handling
- Centralized exception types for consistent HTTP responses.
- Useful for surfacing meaningful errors to clients and simplifying error handling logic.

```mermaid
classDiagram
class BaseAppException {
+status_code : int
+detail : any
+headers : dict
}
class NotFoundException
class BadRequestException
class UnauthorizedException
class ForbiddenException
class ServerErrorException
class ServiceUnavailableException
BaseAppException <|-- NotFoundException
BaseAppException <|-- BadRequestException
BaseAppException <|-- UnauthorizedException
BaseAppException <|-- ForbiddenException
BaseAppException <|-- ServerErrorException
BaseAppException <|-- ServiceUnavailableException
```

### Frontend error extraction utility
- Extracts a readable message from thrown values reliably handling Error instances, strings, and object-like structures.

```mermaid
flowchart TD
InErr["unknown error"] --> IsError{"Is instance of Error?"}
IsError --> |Yes| ReturnMsg["Return error.message"]
IsError --> |No| IsString{"Is string?"}
IsString --> |Yes| ReturnStr["Return string"]
IsString --> |No| HasMessage{"Has message field?"}
HasMessage --> |Yes| ReturnObjMsg["Return message field"]
HasMessage --> |No| DefaultMsg["Return generic message"]
```

### AI/ML and NLP pipeline
- LLM configuration supports multiple providers and models via settings.
- NLTK data and pickled artifacts are bundled in the backend image.
- Interview-related timeouts and session limits are configurable.

```mermaid
flowchart TD
Start(["LLM request"]) --> LoadCfg["Load LLM settings"]
LoadCfg --> Provider{"Provider selected?"}
Provider --> |Google| UseGoogle["Use Google GenAI"]
Provider --> |Other| UseAlt["Use alternate provider/base"]
UseGoogle --> ModelSel["Select model"]
UseAlt --> ModelSel
ModelSel --> RunProc["Run inference"]
RunProc --> End(["Return structured result"])
```

## Dependency analysis
- Backend Python dependencies are declared in pyproject.toml with pinned versions and optional sources.
- Frontend dependencies include Next.js, PostHog, Prisma client, and UI libraries.
- Analysis tools (Jupyter, scikit-learn, NLTK) are present in the analysis directory.

```mermaid
graph LR
PY["pyproject.toml"] --> FA["fastapi"]
PY --> LC["langchain*"]
PY --> NP["numpy"]
PY --> PM["pydantic-settings"]
PKG["package.json"] --> NX["next"]
PKG --> PH["posthog-js"]
PKG --> PR["@prisma/client"]
PKG --> RB["react"]
AN["analysis/requirements.txt"] --> SK["scikit-learn"]
AN --> NL["nltk"]
AN --> MV["motor"]
```

## Performance considerations
- Logging overhead: Enable DEBUG selectively in development; production defaults reduce noise.
- Middleware latency: Request/response logging reads bodies; avoid enabling in high-throughput production without capacity planning.
- Interview code execution timeout: Tune based on compute resources and safety requirements.
- Frontend PWA and asset proxying: Ensure PostHog proxy rules are intact to avoid extra hops.

Practical tips:
- Set LOG_LEVEL to INFO in production and enable DEBUG only for targeted investigations.
- Monitor response durations captured in access logs for hotspots.
- Adjust interview timeouts and session max age per workload.
- Verify PostHog rewrites and static asset proxying in next.config.js.

## Troubleshooting guide

### Installation and environment setup

Common issues:
- Dependency conflicts between Python packages and system packages.
- Missing environment variables causing configuration failures.
- Incorrect Docker build args or stage assumptions.

Resolutions:
- Use the provided Dockerfiles and compose file to ensure consistent environments.
- Validate.env files for both backend and frontend; ensure DATABASE_URL and API keys are present.
- For Python dependencies, rely on uv-based installation in the backend Dockerfile.
- For Bun/Next.js, ensure lockfile integrity and production-only installs in the frontend Dockerfile.

### Docker configuration errors

Symptoms:
- Containers fail to start or crash immediately.
- Port conflicts or networking issues between services.
- Frontend fails to migrate or seed on startup.

Checks:
- Confirm service dependencies and order: db then backend, then frontend.
- Ensure NEXTAUTH_URL and BACKEND_URL are correctly set for internal Docker networking.
- Verify volume mounts for uploads and NLTK data paths.
- Confirm port exposure for frontend (3000) and backend (8000).

### Runtime errors: debugging and log analysis

**Updated** Removed references to verbose debug logging mode and improved logging levels that were part of temporary logging enhancements.

Techniques:
- Correlate logs using X-Request-ID header returned by backend responses.
- Inspect access logs for client address, method, path, and status code.
- Use DEBUG mode temporarily to increase verbosity during investigations.

Tools:
- Request/response logging middleware captures payloads and durations.
- Centralized exception types help standardize error surfaces.

### Performance issues

Slow API responses:
- Review access logs for long-duration requests.
- Check for blocking operations in routes or services.
- Validate LLM provider availability and rate limits.

Memory usage optimization:
- Reduce DEBUG logging in production.
- Limit concurrent interview sessions and code execution timeouts.
- Monitor container memory limits and scale accordingly.

Database query tuning:
- Ensure migrations run successfully on frontend startup.
- Use connection pooling and appropriate indexes as per Prisma schema.

### AI/ML and NLP pipeline failures

Symptoms:
- LLM provider errors or invalid API keys.
- Missing or corrupted model artifacts.
- Interview code execution timeouts or sandbox issues.

Checks:
- Verify GOOGLE_API_KEY or alternate LLM API key/base are set.
- Confirm NLTK data path exists in the backend image.
- Adjust interview timeouts and session limits.

### Frontend-Specific problems

Build errors:
- Production-only dependencies are installed in the final stage.
- Ensure prisma generate runs before build/start.
- Validate NEXT_PUBLIC_* variables passed as build args if used.

Routing issues:
- Verify rewrites for PostHog static assets and API endpoints.
- Ensure skipTrailingSlashRedirect is enabled for PostHog compatibility.

Authentication failures:
- Confirm NEXTAUTH_URL matches the external URL used by users.
- Validate NEXTAUTH_SECRET and provider credentials in.env.

### Debugging tools and techniques

**Updated** Removed references to verbose debug logging mode and improved logging levels.

- Backend:
  - Enable DEBUG via settings for targeted investigations.
  - Use request ID propagation to trace end-to-end flows.
  - Inspect access logs for anomalies.

- Frontend:
  - Use error-utils to normalize thrown errors in UI.
  - Validate PostHog proxy rules and static asset delivery.
  - Confirm NEXT_PUBLIC variables are correctly injected.

## Conclusion
By using the built-in logging, exception handling, and environment-driven configuration, most issues in TalentSync-Normies can be diagnosed quickly. Use Docker Compose as the single source of truth for environment setup, and rely on request IDs and access logs for correlation. For AI/ML and NLP concerns, validate provider credentials and model artifacts. For frontend issues, focus on build stages, PostHog configuration, and authentication settings.

## Appendices

### Frequently asked questions

Q: What are the system requirements?
- Backend requires Python 3.13 and sufficient CPU/RAM for LLM inference and PDF processing.
- Frontend requires Node/Bun compatible with Next.js 16 and Prisma.
- PostgreSQL 16 is used in containers; ensure host has adequate disk space for volumes.

Q: Why does the frontend fail to start with migration errors?
- Migrations run via a one-shot container stage; ensure db is healthy and credentials are correct.
- Check that DATABASE_URL and NEXTAUTH_URL are set appropriately for the environment.

Q: How do I fix authentication issues?
- Ensure NEXTAUTH_URL matches the external URL.
- Verify NEXTAUTH_SECRET and provider credentials in.env.
- Confirm cookies and redirects are allowed by CORS settings.

Q: How can I improve slow API responses?
- Reduce DEBUG logging in production.
- Investigate long-duration requests via access logs.
- Tune interview timeouts and session limits.

Q: What should I check if LLM calls fail?
- Confirm GOOGLE_API_KEY or alternate LLM API key/base are set.
- Verify model name and provider configuration.
- Check network connectivity and rate limits.

Q: How do I handle NLTK/NLP model errors?
- Ensure NLTK data path is mounted and initialized in the backend image.
- Rebuild backend image if artifacts are missing.

Q: Why are PostHog events not recorded?
- Verify PostHog rewrites and static asset proxy rules.
- Confirm NEXT_PUBLIC_POSTHOG_* variables are set.
