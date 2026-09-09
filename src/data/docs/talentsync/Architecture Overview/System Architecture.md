# System architecture

## Introduction
This page describes the system architecture of the TalentSync-Normies platform. The system follows a microservices architecture with three primary components:
- Frontend: Next.js application serving the user interface and client-side logic.
- Backend: FastAPI service exposing REST APIs and orchestrating AI/ML workflows.
- AI/ML Service: Integrated LangChain-based pipeline for resume analysis, ATS evaluation, cover letter generation, cold outreach, and interview assistance.
- Database: PostgreSQL storing user data, resumes, analyses, and related artifacts.

The platform is containerized with Docker and orchestrated via docker-compose. It supports development and production deployments with distinct compose configurations.

## Project structure
The repository is organized into four major areas:
- frontend: Next.js application with TypeScript, Prisma ORM, and UI components.
- backend: FastAPI application with routing, middleware, AI/ML integrations, and data models.
- analysis: Jupyter notebook and ML assets for resume analysis experiments.
-.github/workflows: CI/CD pipeline configuration for deployment.

```mermaid
graph TB
subgraph "Frontend"
FE_APP["Next.js App<br/>Dockerfile (multi-stage)"]
end
subgraph "Backend"
BE_API["FastAPI App<br/>Routes, Middleware, LLM Config"]
end
subgraph "AI/ML"
LC["LangChain Integrations<br/>Graphs, Agents, Tools"]
end
subgraph "Data"
DB["PostgreSQL"]
end
FE_APP --> |"HTTP API"| BE_API
BE_API --> |"Prisma ORM"| DB
BE_API --> |"LangChain Calls"| LC
LC --> |"External LLM Providers"| EXTL["LLM Providers"]
```

## Core components
- Frontend (Next.js)
  - Responsible for presentation, user interactions, and API consumption.
  - Uses Prisma for database operations and NextAuth for authentication.
  - Built with a multi-stage Dockerfile optimized for production.
- Backend (FastAPI)
  - Exposes REST endpoints under /api/v1 and /api/v2.
  - Implements request ID tracing, request/response logging, and CORS.
  - Integrates LangChain for AI/ML workflows and supports multiple LLM providers.
- AI/ML Service
  - LangChain graphs and agents for structured workflows (e.g., ATS evaluation).
  - Supports tooling (e.g., Tavily search) and provider-agnostic LLM selection.
- Database (PostgreSQL)
  - Schema includes users, roles, resumes, analyses, interview requests, and LLM configurations.
  - Migrations and seeding orchestrated during container startup.

## Architecture overview
The system employs a clear separation of concerns:
- Presentation Layer: Next.js handles UI rendering, routing, and client-side state.
- Business Logic Layer: FastAPI manages authentication, request validation, orchestration, and persistence via Prisma.
- Data Layer: PostgreSQL persists all application data with Prisma-generated client.

Communication patterns:
- Frontend communicates with Backend via HTTP REST endpoints.
- Backend integrates with external LLM providers through LangChain abstractions.
- Database access is performed through Prisma ORM in the frontend and backend.

```mermaid
graph TB
Client["Browser/App"]
NextApp["Next.js Frontend"]
BE["FastAPI Backend"]
PRISMA["Prisma Client"]
PG["PostgreSQL"]
LLM["LangChain + LLM Providers"]
Client --> NextApp
NextApp --> |"REST"| BE
BE --> |"Queries"| PRISMA
PRISMA --> PG
BE --> |"LLM Calls"| LLM
```

## Detailed component analysis

### Frontend (Next.js)
- Technology stack includes Next.js, Prisma, NextAuth, Radix UI, and Recharts.
- Multi-stage Docker build optimizes production image size and startup time.
- Environment variables include database URL, backend URL, OAuth credentials, and analytics keys.
- Layout composes providers and content for consistent theming and state.

```mermaid
classDiagram
class NextApp {
+layout.tsx
+providers.tsx
+globals.css
}
class PrismaSchema {
+User
+Role
+Resume
+Analysis
+InterviewRequest
+LlmConfig
}
NextApp --> PrismaSchema : "uses Prisma Client"
```

### Backend (FastAPI)
- Centralized application factory with lifecycle hooks, middleware, and CORS.
- Routes grouped by feature (ATS, resume analysis, hiring assistant, cover letter, etc.) across v1 and v2.
- LLM configuration supports multiple providers (OpenAI, Anthropic, Google, Ollama, OpenRouter, DeepSeek).
- Structured logging and request tracing for observability.

```mermaid
sequenceDiagram
participant Client as "Frontend"
participant API as "FastAPI"
participant LLM as "LangChain LLM"
participant DB as "PostgreSQL"
Client->>API : "POST /api/v2/ats-evaluation"
API->>LLM : "Invoke ATSEvaluatorGraph"
LLM-->>API : "Structured JSON + Narrative"
API-->>Client : "Evaluation Results"
API->>DB : "Persist Analysis"
DB-->>API : "OK"
```

### AI/ML integration (LangChain)
- Provider-agnostic LLM creation with temperature support and fallbacks.
- ATSEvaluatorGraph composes a LangGraph workflow with optional tool binding (e.g., Tavily search).
- JSON extraction and error handling for structured outputs.

```mermaid
flowchart TD
Start(["Evaluate ATS"]) --> InitLLM["Initialize LLM Provider"]
InitLLM --> BuildPrompt["Build System Prompt"]
BuildPrompt --> Invoke["Invoke LLM with Tools"]
Invoke --> Parse["Parse JSON from Response"]
Parse --> Success{"JSON Parsed?"}
Success --> |Yes| Return["Return Structured Result"]
Success --> |No| Error["Raise HTTP Exception"]
```

### Database model (Prisma)
- Entities include Role, User, Resume, Analysis, InterviewRequest, LlmConfig, and OAuth-related models.
- Relationships define ownership and cascading deletes for coherent data integrity.
- Indexes and unique constraints optimize queries and enforce uniqueness.

```mermaid
erDiagram
ROLE {
string id PK
string name UK
}
USER {
string id PK
string name
string email UK
string roleId FK
}
RESUME {
string id PK
string userId FK
string customName
string rawText
boolean isMaster
}
ANALYSIS {
string id PK
string resumeId UK
json skillsAnalysis
string[] recommendedRoles
}
LLM_CONFIG {
string id PK
string userId FK
string label
string provider
string model
boolean isActive
}
ROLE ||--o{ USER : "has many"
USER ||--o{ RESUME : "owns"
RESUME ||--|| ANALYSIS : "has one"
USER ||--o{ LLM_CONFIG : "owns"
```

## Dependency analysis
Containerization and orchestration:
- docker-compose defines three services: db, backend, and frontend.
- Frontend exposes port 3000 and depends on backend and db.
- Production compose adds a one-time migration stage and external network integration.

```mermaid
graph TB
subgraph "Dev Compose"
DB["postgres:16"]
BE["backend:FastAPI"]
FE["frontend:Next.js"]
DB --> |"Volume: postgres_data"| DB
FE --> |"BACKEND_URL=http://backend:8000"| BE
FE --> |"DATABASE_URL=postgresql://...:5432"| DB
BE --> |"DATABASE_URL=postgresql://...:5432"| DB
end
```

Technology stack dependencies:
- Backend: FastAPI, LangChain, LangChain providers, Pydantic settings, NumPy, SSE Starlette, HTTPX, cryptography.
- Frontend: Next.js, Prisma, NextAuth, Radix UI, Recharts, PostHog, Tailwind.

## Performance considerations
- Container builds
  - Frontend uses a multi-stage Dockerfile to minimize production image size and improve cold start times.
  - Backend uses uv for faster dependency installation and exposes port 8000.
- Observability
  - Request ID propagation and request/response logging enable tracing and debugging.
- AI/ML throughput
  - Provider-agnostic LLM selection allows tuning for latency or cost.
  - LangGraph workflows can be parallelized where safe and appropriate.
- Database scaling
  - PostgreSQL is configured with a persistent volume for durability.
  - Consider read replicas and connection pooling for high concurrency.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Environment variables
  - Ensure DATABASE_URL, BACKEND_URL, NEXTAUTH_URL, and LLM API keys are set consistently across services.
- Health checks
  - Production compose includes a health check for the database service.
- Migration failures
  - The frontend migration stage runs Prisma migrations once; verify logs if startup fails.
- LLM availability
  - If default provider keys are missing, LLM functionality may be disabled; configure provider settings accordingly.

## Conclusion
TalentSync-Normies implements a clean microservices architecture with a Next.js frontend, FastAPI backend, integrated LangChain AI/ML pipelines, and a PostgreSQL data layer. Docker and docker-compose provide reproducible, scalable deployments across environments. The separation of concerns ensures maintainability, while provider-agnostic LLM configuration and structured logging support operational excellence.
