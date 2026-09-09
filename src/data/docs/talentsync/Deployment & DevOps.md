# Deployment & DevOps

## Introduction
This page provides detailed deployment and DevOps guidance for the TalentSync-Normies platform. It covers Docker configuration with multi-stage builds, service orchestration using Docker Compose, environment variable management, CI/CD with GitHub Actions, production deployment strategies, infrastructure provisioning, database setup, monitoring and logging, health checks and alerting, backup and disaster recovery, and troubleshooting and performance optimization.

## Project structure
The platform consists of:
- Backend service built with Python and FastAPI, exposing APIs for ATS evaluation, resume analysis, cold mail generation, cover letter generation, hiring assistant, and interview support.
- Frontend Next.js application using Bun for building and runtime, with Prisma for database operations.
- PostgreSQL database for persistent storage.
- Docker Compose for local development and production orchestration.
- GitHub Actions workflow for automated deployment to a VPS.

```mermaid
graph TB
subgraph "Local Development"
DC["docker-compose.yaml"]
FE["frontend/Dockerfile"]
BE["backend/Dockerfile"]
DB["PostgreSQL 16"]
end
subgraph "Production"
DCP["docker-compose.prod.yaml"]
NPM["nginx-proxy-manager network"]
end
DC --> FE
DC --> BE
DC --> DB
DCP --> FE
DCP --> BE
DCP --> DB
DCP -.-> NPM
```

## Core components
- Backend service
  - Built with Python 3.13 and FastAPI.
  - Exposes multiple API routes for ATS evaluation, resume analysis, cold mail, cover letters, hiring assistant, tailored resume, tips, and interview features.
  - Uses environment-driven configuration via Pydantic settings.
  - Health and logging middleware are integrated.
- Frontend service
  - Next.js application built with Bun and TypeScript.
  - Multi-stage Docker build: deps, builder, prod-deps, migrate, runner.
  - Prisma migrations run during a dedicated migration stage.
- Database
  - PostgreSQL 16 with persistent volume for data durability.
- Orchestration
  - Local development via docker-compose.yaml.
  - Production via docker-compose.prod.yaml with health checks and external network integration.

## Architecture overview
The system comprises three primary containers orchestrated by Docker Compose:
- Frontend: Next.js application with Prisma migrations executed in a separate stage.
- Backend: FastAPI application serving REST endpoints.
- Database: PostgreSQL 16 with health checks and persistent storage.

```mermaid
graph TB
subgraph "Network: TalentSync"
FE["frontend:3000"]
BE["backend:8000"]
DB["db:5432"]
end
FE --> |"HTTP"| BE
BE --> |"SQL"| DB
FE --> |"Prisma Migrate"| DB
```

## Detailed component analysis

### Backend service
- Build and runtime
  - Multi-stage Docker build targeting Python 3.13 slim image.
  - Dependency installation via uv with caching.
  - Application code copied and exposed on port 8000.
- Environment configuration
  - Settings loaded from.env with Pydantic BaseSettings.
  - Includes API metadata, LLM provider configuration, CORS, and interview parameters.
- Application lifecycle
  - FastAPI app configured with CORS middleware and request/response logging.
  - Routes organized under v1 and v2 namespaces for backward compatibility and feature evolution.

```mermaid
classDiagram
class Settings {
+str APP_NAME
+str APP_VERSION
+bool DEBUG
+str LOG_LEVEL
+str GOOGLE_API_KEY
+str MODEL_NAME
+str FASTER_MODEL_NAME
+float MODEL_TEMPERATURE
+str LLM_PROVIDER
+str LLM_MODEL
+str LLM_API_KEY
+str LLM_API_BASE
+str ENCRYPTION_KEY
+str[] CORS_ORIGINS
+int INTERVIEW_MAX_QUESTIONS
+int INTERVIEW_DEFAULT_QUESTIONS
+int INTERVIEW_CODE_EXECUTION_TIMEOUT
+int INTERVIEW_SESSION_MAX_AGE_HOURS
}
class MainApp {
+FastAPI app
+lifespan()
+request_id_middleware()
+request_response_logging_middleware()
+include_router(...)
}
Settings <.. MainApp : "loaded via get_settings()"
```

### Frontend service
- Multi-stage Docker build
  - deps: installs dev dependencies.
  - builder: builds Next.js app and generates Prisma client.
  - prod-deps: installs production-only dependencies.
  - migrate: one-shot Prisma migrations.
  - runner: slim runtime serving the built app.
- Build-time configuration
  - Accepts PostHog keys via build args.
  - NODE_ENV set to production in builder and runner stages.
- Runtime behavior
  - Prisma migrations executed via a dedicated migration stage before starting the runner.
  - Starts Next.js in production mode.

```mermaid
flowchart TD
Start(["Build Start"]) --> Deps["Stage 0: deps<br/>Install dev dependencies"]
Deps --> Builder["Stage 1: builder<br/>Next build + Prisma generate"]
Builder --> ProdDeps["Stage 2: prod-deps<br/>Install production deps"]
ProdDeps --> Migrate["Stage 3: migrate<br/>Run Prisma migrations"]
Migrate --> Runner["Stage 4: runner<br/>Serve built app"]
Runner --> End(["Build Complete"])
```

### Database service
- PostgreSQL 16 image with health check.
- Persistent volume for data durability.
- Environment variables sourced from.env for credentials and database name.
- Health check uses pg_isready against localhost with configured credentials.

```mermaid
flowchart TD
Init(["Service Start"]) --> WaitHealthy{"DB Healthy?"}
WaitHealthy --> |No| Retry["Retry until healthy"]
WaitHealthy --> |Yes| Proceed["Proceed to dependent services"]
Retry --> WaitHealthy
```

### CI/CD pipeline with GitHub Actions
- Workflow triggers on pushes to main branch.
- Steps:
  - Checkout repository.
  - SSH into VPS using secrets.
  - Pull latest code.
  - Build and start services using docker-compose.prod.yaml.
- Secrets required:
  - VPS_HOST, VPS_USER, SSH_PRIVATE_KEY, VPS_PROJECT_PATH.

```mermaid
sequenceDiagram
participant GH as "GitHub Actions"
participant VPS as "VPS Host"
participant DC as "Docker Compose"
GH->>VPS : "SSH login"
GH->>VPS : "cd project path"
GH->>VPS : "git pull origin main"
GH->>DC : "compose -f docker-compose.prod.yaml build"
GH->>DC : "compose -f docker-compose.prod.yaml up -d --force-recreate"
GH-->>VPS : "Deployment complete"
```

### Environment configuration management
- Centralized environment variables
  - Root.env and per-service.env files (.env, backend/.env, frontend/.env).
  - Variables include database credentials, OAuth clients, email settings, JWT secrets, API keys, and analytics keys.
- Variable precedence and usage
  - Docker Compose env_file loads variables from.env files.
  - DATABASE_URL constructed from POSTGRES_* variables.
  - Frontend NEXTAUTH_URL and BACKEND_URL configured for internal and external access.
- Security considerations
  - Encryption key and secrets are present in.env files; ensure secrets are managed securely in CI/CD and production environments.

## Dependency analysis
- Backend dependencies
  - Core: FastAPI, asyncpg, datetime, cryptography.
  - LLM integrations: langchain, langchain-google-genai, langchain-openai, langchain-anthropic, langchain-ollama, tavily-python, gitingest.
  - Utilities: numpy, pydantic-settings, python-dotenv, httpx, sse-starlette, bs4, pymupdf, pymupdf4llm.
- Frontend dependencies
  - Next.js, NextAuth, Prisma client, PostHog JS, react ecosystem, nodemailer, recharts, mermaid, sharp, zod.

```mermaid
graph LR
BE["backend/pyproject.toml"] --> FastAPI["fastapi"]
BE --> LangChain["langchain-*"]
BE --> Crypto["cryptography"]
FE["frontend/package.json"] --> Next["next"]
FE --> NextAuth["next-auth"]
FE --> Prisma["@prisma/client"]
FE --> PostHog["posthog-js"]
```

## Performance considerations
- Containerization
  - Multi-stage builds reduce final image size and improve startup times.
  - Use production-only dependencies in the frontend prod-deps stage.
- Database
  - Health checks ensure readiness before starting dependent services.
  - Persistent volume prevents data loss and supports scaling strategies.
- Application logging
  - Structured request/response logging aids performance diagnostics.
- Observability
  - Integrate metrics and tracing in future enhancements for deeper insights.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Health checks failing
  - Verify PostgreSQL health check configuration and credentials.
  - Confirm service_healthy conditions in docker-compose.prod.yaml.
- Migration failures
  - Ensure the frontend migrate stage completes successfully before starting the runner.
  - Check Prisma configuration and database connectivity.
- Environment variables
  - Validate.env files and ensure required variables are present.
  - Confirm DATABASE_URL construction and NEXTAUTH_URL alignment with deployment domain.
- CI/CD deployment
  - Confirm SSH access to VPS and availability of secrets.
  - Verify docker-compose.prod.yaml path and permissions on the VPS.

## Conclusion
The TalentSync-Normies platform uses reliable Docker multi-stage builds, orchestrated services with Docker Compose, and a streamlined GitHub Actions deployment pipeline. By adhering to environment variable management best practices, implementing health checks, and establishing secure CI/CD workflows, the platform achieves reliable deployments suitable for production environments. Future enhancements can focus on observability, autoscaling, and advanced backup strategies.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Production deployment strategies
- Infrastructure
  - Use a VPS or managed Kubernetes cluster for container orchestration.
  - External load balancing via nginx-proxy-manager or equivalent.
- Scaling
  - Stateless frontend and backend services can scale horizontally.
  - Database scaling via read replicas and connection pooling.
- Security
  - Store secrets in a secure secret manager and mount as environment variables.
  - Enable HTTPS termination at the reverse proxy.

[No sources needed since this section provides general guidance]

### Monitoring and logging
- Backend
  - Structured logging middleware captures request/response payloads and durations.
  - Integrate centralized logging and metrics collection for production visibility.
- Frontend
  - Use PostHog for product analytics and telemetry.
- Alerts
  - Configure health check alerts and log-based alerting for critical failures.

[No sources needed since this section provides general guidance]

### Backup and disaster recovery
- Database backups
  - Schedule regular logical backups of PostgreSQL data.
  - Test restoration procedures periodically.
- Artifact retention
  - Retain container images and deployment artifacts for rollback scenarios.
- DR procedures
  - Define RTO/RPO targets and automate failover to secondary regions.

[No sources needed since this section provides general guidance]
