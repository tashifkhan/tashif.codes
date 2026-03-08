# Architecture Overview

<cite>
**Referenced Files in This Document**
- [README.md](file://assignment-solver/README.md)
- [architechture.md](file://assignment-solver/docs/architechture.md)
- [package.json](file://assignment-solver/package.json)
- [manifest.config.js](file://assignment-solver/manifest.config.js)
- [background/index.js](file://assignment-solver/src/background/index.js)
- [ui/index.js](file://assignment-solver/src/ui/index.js)
- [gemini/index.js](file://assignment-solver/src/services/gemini/index.js)
- [README.md](file://notice-reminders/README.md)
- [pyproject.toml](file://notice-reminders/pyproject.toml)
- [main.py](file://notice-reminders/main.py)
- [app/api/main.py](file://notice-reminders/app/api/main.py)
- [user.py](file://notice-reminders/app/models/user.py)
- [course.py](file://notice-reminders/app/models/course.py)
- [notification.py](file://notice-reminders/app/models/notification.py)
- [README.md](file://website/README.md)
- [package.json](file://website/package.json)
- [layout.tsx](file://website/app/layout.tsx)
- [api.ts](file://website/lib/api.ts)
- [auth-context.tsx](file://website/lib/auth-context.tsx)
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
10. [Appendices](#appendices)

## Introduction
This document presents the architecture of the MOOC Utils ecosystem, a cohesive suite of tools designed to enhance the MOOC learning experience. The system comprises three independent yet interconnected components:
- A browser extension that assists with assignment-solving using AI.
- A FastAPI backend that manages users, subscriptions, course data, and notifications.
- A Next.js web application that serves as a landing and dashboard experience, integrating with the backend for authentication and data.

These components collaborate to deliver a unified learning utility suite: the extension automates assignment tasks, the backend stores and orchestrates learning data, and the website provides a user-friendly interface for discovery, authentication, and dashboard management.

## Project Structure
The repository is organized as a monorepo with three primary packages:
- assignment-solver: A modern browser extension built with Vite and webextension-polyfill, supporting Chrome and Firefox.
- notice-reminders: A FastAPI application with Tortoise ORM for persistence, offering REST endpoints for users, courses, subscriptions, and notifications.
- website: A Next.js 16 application using React 19, TypeScript, and TanStack Query for a responsive frontend.

```mermaid
graph TB
subgraph "Browser Extension"
EXT_UI["UI (Side Panel)"]
EXT_BG["Background Worker"]
EXT_CONTENT["Content Script"]
end
subgraph "Next.js Website"
WEB_APP["Next.js App Router"]
WEB_AUTH["Auth Context"]
WEB_API["API Client"]
end
subgraph "FastAPI Backend"
API_APP["FastAPI App"]
DB["Database (Tortoise ORM)"]
end
EXT_UI <- --> EXT_BG
EXT_BG <- --> EXT_CONTENT
WEB_APP --> WEB_AUTH
WEB_APP --> WEB_API
WEB_API --> API_APP
API_APP --> DB
```

**Diagram sources**
- [manifest.config.js](file://assignment-solver/manifest.config.js#L14-L105)
- [background/index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [ui/index.js](file://assignment-solver/src/ui/index.js#L1-L113)
- [layout.tsx](file://website/app/layout.tsx#L1-L99)
- [api.ts](file://website/lib/api.ts#L1-L184)
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)

**Section sources**
- [README.md](file://assignment-solver/README.md#L142-L160)
- [README.md](file://notice-reminders/README.md#L7-L11)
- [README.md](file://website/README.md#L1-L51)

## Core Components
- Browser Extension (Assignment Solver)
  - UI: Side panel with controllers for settings, progress, and solving workflows.
  - Background: Service worker implementing a message router and handlers for extraction, screenshots, Gemini requests, and answer application.
  - Content Script: Interacts with the assignment page to extract HTML and apply answers.
  - Services: Gemini service for AI-powered extraction and solving, storage service for local key management.
  - Build: Vite with dynamic manifest generation for Chrome and Firefox.

- FastAPI Backend (Notice Reminders)
  - Application: FastAPI app with CORS middleware and route registration for users, auth, search, courses, announcements, subscriptions, and notifications.
  - Persistence: Tortoise ORM with Aerich migrations.
  - Entry Point: CLI/API mode selection via a single main entry point.

- Next.js Web Application (Website)
  - Routing: App Router with pages for landing, notice reminders dashboard, login, and privacy.
  - Authentication: Email OTP login with httpOnly cookies, session refresh, and logout.
  - API Layer: Strongly typed API client wrapping fetch with credential handling.
  - Providers: Theme provider and other UI providers.

**Section sources**
- [architechture.md](file://assignment-solver/docs/architechture.md#L7-L71)
- [background/index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [ui/index.js](file://assignment-solver/src/ui/index.js#L1-L113)
- [gemini/index.js](file://assignment-solver/src/services/gemini/index.js#L1-L342)
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)
- [pyproject.toml](file://notice-reminders/pyproject.toml#L1-L41)
- [api.ts](file://website/lib/api.ts#L1-L184)
- [auth-context.tsx](file://website/lib/auth-context.tsx#L1-L97)

## Architecture Overview
The MOOC Utils ecosystem follows a distributed, layered architecture:
- Presentation Layer: Next.js website handles user onboarding, authentication, and dashboard views.
- API Layer: FastAPI backend exposes REST endpoints for CRUD operations and orchestration.
- Data Layer: Database persists users, courses, subscriptions, and notifications.
- Edge Layer: Browser extension integrates with the assignment page and communicates with the backend via the website’s API layer.

```mermaid
graph TB
subgraph "Presentation"
WEB["Next.js Website"]
end
subgraph "API"
FASTAPI["FastAPI Backend"]
end
subgraph "Data"
TORTOISE["Tortoise ORM"]
DB["PostgreSQL"]
end
subgraph "Edge"
EXT["Browser Extension"]
end
WEB --> FASTAPI
FASTAPI --> TORTOISE
TORTOISE --> DB
EXT --> WEB
```

**Diagram sources**
- [layout.tsx](file://website/app/layout.tsx#L1-L99)
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)
- [pyproject.toml](file://notice-reminders/pyproject.toml#L7-L19)
- [api.ts](file://website/lib/api.ts#L1-L184)
- [manifest.config.js](file://assignment-solver/manifest.config.js#L14-L105)

## Detailed Component Analysis

### Browser Extension Architecture
The extension employs a modular, dependency-injected design with explicit separation of concerns:
- UI: Initializes adapters, services, state, and controllers; waits for background readiness; wires event listeners.
- Background: Registers message handlers for extraction, screenshots, Gemini requests, and answer application; opens the side panel on action click.
- Content Script: Runs in page context to extract HTML and apply answers.
- Services: Gemini service encapsulates API calls, schema usage, and response parsing; storage service manages keys.

```mermaid
classDiagram
class BackgroundWorker {
+initialize()
+registerHandlers()
+openPanel()
}
class GeminiService {
+extract(apiKey, html, pageInfo, images, screenshots, model, reasoning)
+solve(extracted, images, screenshots, model, reasoning)
+callAPI(apiKey, payload, model)
+directAPICall(apiKey, payload, model)
}
class StorageService {
+saveApiKey(key)
+getApiKey()
+clearApiKey()
}
class SidePanelUI {
+initEventListeners()
+waitForBackgroundReady()
+loadApiKeyOnInit()
}
BackgroundWorker --> GeminiService : "uses"
BackgroundWorker --> StorageService : "uses"
SidePanelUI --> GeminiService : "uses"
SidePanelUI --> StorageService : "uses"
```

**Diagram sources**
- [background/index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [gemini/index.js](file://assignment-solver/src/services/gemini/index.js#L60-L342)
- [ui/index.js](file://assignment-solver/src/ui/index.js#L1-L113)

**Section sources**
- [architechture.md](file://assignment-solver/docs/architechture.md#L73-L132)
- [background/index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [ui/index.js](file://assignment-solver/src/ui/index.js#L1-L113)
- [gemini/index.js](file://assignment-solver/src/services/gemini/index.js#L1-L342)

### FastAPI Backend Pattern
The backend follows a layered FastAPI pattern:
- Application Factory: Creates the FastAPI app, registers CORS, includes routers, and registers the database.
- Routers: Organized under app/api/routers for users, auth, search, courses, announcements, subscriptions, and notifications.
- Persistence: Models define entities and relationships; Tortoise ORM manages schema and migrations.
- Entry Point: Single main entry supports CLI and API modes.

```mermaid
sequenceDiagram
participant Client as "Next.js Website"
participant API as "FastAPI App"
participant Users as "Users Router"
participant Auth as "Auth Router"
participant DB as "Database"
Client->>API : HTTP Request (e.g., GET /users/{id})
API->>Users : Route dispatch
Users->>DB : Query user by id
DB-->>Users : User record
Users-->>API : Serialized user
API-->>Client : HTTP Response
Client->>API : HTTP Request (e.g., POST /auth/request-otp)
API->>Auth : Route dispatch
Auth->>DB : Persist OTP and session metadata
DB-->>Auth : OK
Auth-->>API : Auth status
API-->>Client : HTTP Response
```

**Diagram sources**
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)
- [user.py](file://notice-reminders/app/models/user.py#L1-L20)
- [main.py](file://notice-reminders/main.py#L1-L71)

**Section sources**
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)
- [user.py](file://notice-reminders/app/models/user.py#L1-L20)
- [course.py](file://notice-reminders/app/models/course.py#L1-L22)
- [notification.py](file://notice-reminders/app/models/notification.py#L1-L37)
- [pyproject.toml](file://notice-reminders/pyproject.toml#L1-L41)
- [main.py](file://notice-reminders/main.py#L1-L71)

### Next.js Web Application Structure
The website uses App Router with a strict provider hierarchy:
- Layout: Sets metadata, fonts, and wraps children with Providers.
- Authentication Context: Manages OTP login, session refresh, logout, and user state.
- API Client: Centralized fetch wrapper with credential inclusion and error handling.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "Next.js Page"
participant Auth as "Auth Context"
participant API as "API Client"
participant BE as "FastAPI Backend"
User->>UI : Navigate to Login
UI->>Auth : requestOtp(email)
Auth->>API : POST /auth/request-otp
API->>BE : Forward request
BE-->>API : OTP issued
API-->>Auth : OTP response
Auth-->>UI : OTP requested
User->>UI : Submit OTP
UI->>Auth : verifyOtp(email, code)
Auth->>API : POST /auth/verify-otp
API->>BE : Forward request
BE-->>API : AuthStatus with user
API-->>Auth : AuthStatus
Auth-->>UI : Redirect to dashboard
```

**Diagram sources**
- [layout.tsx](file://website/app/layout.tsx#L1-L99)
- [auth-context.tsx](file://website/lib/auth-context.tsx#L1-L97)
- [api.ts](file://website/lib/api.ts#L1-L184)
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)

**Section sources**
- [layout.tsx](file://website/app/layout.tsx#L1-L99)
- [auth-context.tsx](file://website/lib/auth-context.tsx#L1-L97)
- [api.ts](file://website/lib/api.ts#L1-L184)

### Data Flow Between Components
- Extension to AI: The UI sends a message to the background worker, which invokes the Gemini service to call the Gemini API with structured prompts and schemas. Responses are parsed and returned to the UI.
- Website to Backend: The Next.js app calls the FastAPI backend using the API client, which includes credentials and handles errors. The backend routes requests to appropriate routers and interacts with the database.
- Cross-Browser Compatibility: The extension uses webextension-polyfill adapters to abstract browser differences and dynamic manifests for Chrome and Firefox.

```mermaid
flowchart TD
Start(["User Action"]) --> ExtUI["Extension UI"]
ExtUI --> BG["Background Worker"]
BG --> Gemini["Gemini Service"]
Gemini --> GeminiAPI["Gemini API"]
GeminiAPI --> GeminiResp["Parsed Response"]
GeminiResp --> ExtUI
ExtUI --> Apply["Apply Answers to Page"]
Start --> WebUI["Website UI"]
WebUI --> APIClient["API Client"]
APIClient --> FastAPI["FastAPI Backend"]
FastAPI --> DB["Database"]
DB --> FastAPI
FastAPI --> APIClient
APIClient --> WebUI
```

**Diagram sources**
- [gemini/index.js](file://assignment-solver/src/services/gemini/index.js#L145-L217)
- [background/index.js](file://assignment-solver/src/background/index.js#L32-L68)
- [api.ts](file://website/lib/api.ts#L28-L53)
- [app/api/main.py](file://notice-reminders/app/api/main.py#L1-L46)

**Section sources**
- [gemini/index.js](file://assignment-solver/src/services/gemini/index.js#L1-L342)
- [background/index.js](file://assignment-solver/src/background/index.js#L1-L135)
- [api.ts](file://website/lib/api.ts#L1-L184)

## Dependency Analysis
- Technology Stack Choices
  - Browser Extension: Vite, webextension-polyfill, dynamic manifest generation, ES modules.
  - Backend: FastAPI, Uvicorn, Tortoise ORM, Aerich, Pydantic settings, HTTPX.
  - Website: Next.js 16, React 19, TypeScript, TanStack Query, Tailwind CSS, shadcn/ui.

- Architectural Patterns
  - Dependency Injection: Factory functions in the extension for testability and modularity.
  - Message-Driven Communication: Background worker routes messages to specialized handlers.
  - Event-Driven Architecture: Handlers react to UI actions and page events.
  - Clean Architecture: Separation of core utilities, platform adapters, services, background, UI, and content script.

```mermaid
graph LR
Vite["Vite Build"] --> EXT["Extension Artifacts"]
Polyfill["webextension-polyfill"] --> EXT
FastAPI["FastAPI"] --> Routers["Routers"]
Routers --> DBLayer["Tortoise ORM"]
DBLayer --> DB["Database"]
Next["Next.js"] --> API["API Client"]
API --> FastAPI
```

**Diagram sources**
- [package.json](file://assignment-solver/package.json#L15-L29)
- [pyproject.toml](file://notice-reminders/pyproject.toml#L7-L19)
- [package.json](file://website/package.json#L11-L27)

**Section sources**
- [package.json](file://assignment-solver/package.json#L1-L30)
- [pyproject.toml](file://notice-reminders/pyproject.toml#L1-L41)
- [package.json](file://website/package.json#L1-L47)

## Performance Considerations
- Extension
  - Rate limiting and delays between API calls and DOM operations reduce throttling and ensure reliable page updates.
  - Direct API calls bypass message channel timeouts in certain environments.
- Backend
  - Asynchronous processing and efficient database queries improve responsiveness.
  - CORS configuration enables secure cross-origin requests.
- Website
  - TanStack Query caching and optimistic updates enhance perceived performance.
  - Strict typing reduces runtime errors and improves maintainability.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Extension
  - API Key Issues: Verify key validity and permissions; ensure correct model selection.
  - Platform Compatibility: Adjust selectors for unsupported platforms; confirm page readiness.
  - Rate Limits: Allow retries and reduce concurrent operations.
- Backend
  - Database Connectivity: Confirm connection URL and migration status.
  - Router Registration: Ensure all routers are included in the application factory.
- Website
  - Authentication: Check cookie settings and CORS configuration.
  - API Client: Validate base URL and error handling behavior.

**Section sources**
- [README.md](file://assignment-solver/README.md#L259-L290)
- [architechture.md](file://assignment-solver/docs/architechture.md#L262-L274)
- [app/api/main.py](file://notice-reminders/app/api/main.py#L17-L42)
- [api.ts](file://website/lib/api.ts#L18-L53)

## Conclusion
The MOOC Utils ecosystem demonstrates a well-structured, modular architecture that leverages modern technologies to deliver a seamless learning experience. The browser extension, FastAPI backend, and Next.js website each serve distinct roles while remaining tightly integrated through clear APIs and shared patterns. The emphasis on dependency injection, message-driven communication, and clean separation of concerns ensures scalability, maintainability, and cross-platform compatibility.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- System Boundaries
  - Extension boundary: UI, background worker, content script, and Gemini service.
  - Backend boundary: FastAPI app, routers, and database.
  - Website boundary: App Router, providers, and API client.
- Integration Points
  - Extension ↔ Website: API client consumes backend endpoints.
  - Website ↔ Backend: RESTful endpoints with CORS and session management.
  - Extension ↔ Gemini: Structured prompts and schemas for extraction and solving.

[No sources needed since this section provides general guidance]