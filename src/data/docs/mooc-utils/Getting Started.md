# Getting started

## Introduction
This guide helps you quickly set up and use the MOOC Utils suite: the Assignment Solver browser extension, the Notice Reminders CLI tool and API backend, and the Website dashboard. You will find prerequisites, environment setup, installation steps, initial configuration, and a basic workflow for new users. Quick start examples show how to install the extension, configure your Gemini API key, and access the website dashboard.

## Project structure
MOOC Utils is organized as a multi-project repository with three independent components:
- Assignment Solver: a browser extension for AI-powered assignment assistance.
- Notice Reminders: a Python CLI tool and FastAPI backend for course announcements and subscriptions.
- Website: a Next.js web app providing a landing page and dashboard for Notice Reminders and Assignment Solver.

```mermaid
graph TB
subgraph "Repository Root"
R["README.md"]
end
subgraph "Assignment Solver"
AS_README["assignment-solver/README.md"]
AS_PKG["assignment-solver/package.json"]
AS_MAN["assignment-solver/manifest.config.js"]
AS_VITE["assignment-solver/vite.config.js"]
AS_GEM["assignment-solver/src/services/gemini/index.js"]
end
subgraph "Notice Reminders"
NR_README["notice-reminders/README.md"]
NR_TOML["notice-reminders/pyproject.toml"]
NR_MAIN["notice-reminders/main.py"]
NR_CFG["notice-reminders/app/core/config.py"]
end
subgraph "Website"
WEB_README["website/README.md"]
WEB_PKG["website/package.json"]
WEB_ENV[".env.local"]
WEB_API["website/lib/api.ts"]
end
R --> AS_README
R --> NR_README
R --> WEB_README
AS_README --> AS_PKG
AS_README --> AS_MAN
AS_README --> AS_VITE
AS_README --> AS_GEM
NR_README --> NR_TOML
NR_README --> NR_MAIN
NR_README --> NR_CFG
WEB_README --> WEB_PKG
WEB_README --> WEB_ENV
WEB_README --> WEB_API
```

## Core components
- Assignment Solver extension: AI-powered question extraction and solving using Gemini, with manual and automated modes. Requires a Gemini API key and a modern browser.
- Notice Reminders CLI tool and API: Python-based tool to search courses, fetch announcements, and manage subscriptions via a FastAPI backend. Provides OTP-based login and httpOnly cookie authentication.
- Website dashboard: Next.js app with a landing page and a dashboard for Notice Reminders. Requires the backend to be running for login and data.

## Architecture overview
The three components operate independently but integrate through the Website dashboard and Notice Reminders backend.

```mermaid
graph TB
subgraph "User"
U["Browser / Terminal / Web App"]
end
subgraph "Assignment Solver"
EXT["Extension UI<br/>Side Panel"]
BG["Background Worker"]
CS["Content Script"]
GEM["Gemini API"]
end
subgraph "Notice Reminders"
CLI["CLI Mode"]
API["FastAPI Backend"]
DB["SQLite / DB"]
AUTH["OTP Auth"]
end
subgraph "Website"
LANDING["Landing Page"]
DASH["Dashboard"]
NEXT["Next.js App"]
AXIOS["API Client"]
end
U --> EXT
EXT --> BG
EXT --> CS
CS --> GEM
BG --> GEM
U --> CLI
CLI --> API
API --> DB
API --> AUTH
U --> NEXT
NEXT --> DASH
NEXT --> LANDING
DASH --> AXIOS
AXIOS --> API
```

## Detailed component analysis

### Assignment solver extension
Installation and setup:
- Prerequisites: Bun package manager, a Gemini API key, and a supported browser (Chrome or Firefox).
- Build: Use the provided scripts to build for Chrome or Firefox, or build both.
- Load in browser: Developer mode required; load the appropriate distribution folder.
- Configure API key: Open the side panel, go to Settings, enter your Gemini API key, and save.

Basic workflow:
- Navigate to an assignment page.
- Open the extension side panel and extract questions.
- Choose Manual or Auto mode; review and confirm actions.

Verification steps:
- Ensure the extension icon appears in the toolbar.
- Confirm the side panel opens and displays settings.
- Test extraction and solving with a known assignment page.

Common issues and fixes:
- "Could not get page HTML": Refresh the page and re-extract.
- "Question container not found": Re-extract and check console logs.
- "API Key invalid": Verify the key at the AI Studio and ensure no extra spaces.
- Answers not applied: Platform-specific input components may require manual application.

#### Build and load flow
```mermaid
flowchart TD
Start(["Start"]) --> Clone["Clone repository"]
Clone --> InstallDeps["Install dependencies with Bun"]
InstallDeps --> Build["Build extension (Chrome/Firefox)"]
Build --> LoadDev["Load unpacked in browser developer mode"]
LoadDev --> Configure["Enter Gemini API key in settings"]
Configure --> Done(["Ready"])
```

### Notice reminders CLI tool and API
Installation and setup:
- Prerequisites: Python 3.12+.
- Install dependencies using the project's dependency management tool.
- Run in CLI mode for interactive scraping without a database.
- Run in API mode to start the backend server; optionally enable auto-reload for development.

Environment and configuration:
- The backend reads settings from environment variables and supports configurable CORS origins, JWT secrets, and OTP delivery.

Basic workflow:
- Register or log in via OTP on the Website dashboard.
- Use the dashboard to search courses, view announcements, and manage subscriptions.
- Optionally run the CLI to search and view announcements directly from the terminal.

Verification steps:
- Confirm the API server is reachable at the configured host/port.
- Verify OTP login succeeds and persists a session cookie.
- Ensure course search and announcement retrieval work.

Common issues and fixes:
- Port conflicts: Change host/port when starting the API server.
- Database initialization: Ensure the database path exists and is writable.
- OTP delivery: Configure SMTP or adjust OTP delivery settings for production.

#### API startup sequence
```mermaid
sequenceDiagram
participant User as "User"
participant CLI as "Main Entry Point"
participant API as "FastAPI Server"
participant DB as "Database"
User->>CLI : "Run in API mode"
CLI->>API : "Initialize app with host/port"
API->>DB : "Ensure migrations and tables"
API-->>User : "Server ready on host : port"
```

### Website dashboard
Installation and setup:
- Prerequisites: Node.js and Bun.
- Install dependencies and configure environment variables for the API URL.
- Build the Next.js app and run lint checks.

Basic workflow:
- Visit the website and use the OTP login to access the dashboard.
- Browse courses, manage subscriptions, and view notifications.

Verification steps:
- Confirm the dashboard loads and shows navigation links.
- Log in using OTP and verify session persistence.
- Check that course search and subscription management are functional.

Common issues and fixes:
- Backend not running: The dashboard requires the Notice Reminders API to be available.
- Environment misconfiguration: Ensure NEXT_PUBLIC_API_URL points to the running backend.
- Development server: Follow the repository's guidance on using the correct dev command.

#### Website API client flow
```mermaid
sequenceDiagram
participant UI as "Next.js UI"
participant API as "API Client"
participant BE as "Notice Reminders API"
UI->>API : "Fetch courses/search"
API->>BE : "HTTP request with credentials"
BE-->>API : "JSON response"
API-->>UI : "Parsed data"
```

## Dependency analysis
- Assignment Solver depends on Bun, Vite, and webextension-polyfill for building and cross-browser compatibility. It integrates with the Gemini API for AI-powered extraction and solving.
- Notice Reminders depends on Python 3.12+, FastAPI, Tortoise ORM, Aerich, and HTTPX for scraping and database operations. It exposes a REST API for the frontend.
- Website depends on Next.js, React, TanStack Query, and Tailwind for the UI and API client integration.

```mermaid
graph LR
AS_PKG["assignment-solver/package.json"] --> AS_DEPS["Bun/Vite/webextension-polyfill"]
AS_MAN["manifest.config.js"] --> AS_BROWSER["Chrome/Firefox"]
AS_VITE["vite.config.js"] --> AS_OUT["dist/chrome | dist/firefox"]
NR_TOML["notice-reminders/pyproject.toml"] --> NR_DEPS["FastAPI/Tortoise/Aerich/HTTPX"]
NR_MAIN["main.py"] --> NR_API["FastAPI Server"]
WEB_PKG["website/package.json"] --> WEB_DEPS["Next.js/TanStack Query"]
WEB_ENV[".env.local"] --> WEB_API["API Client"]
```

## Performance considerations
- Assignment Solver: Rate limiting is handled client-side to prevent API throttling and ensure reliable DOM updates. Consider reducing concurrent operations if encountering rate limit errors.
- Notice Reminders: Configure cache TTL and database connection pooling appropriately. Use production-grade ASGI servers for higher concurrency.
- Website: Minimize unnecessary re-fetches using TanStack Query caching and invalidate queries after mutations.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Assignment Solver
  - "Could not get page HTML": Ensure you are on a real assignment page and refresh the page.
  - "Question container not found": Re-extract questions and check the browser console.
  - "API Key invalid": Verify the key at the AI Studio and remove extra spaces.
  - Answers not applied: Some platforms use custom components; apply answers manually to identify issues.
  - Rate limit errors: Wait before retrying, upgrade quotas, or reduce batch size.

- Notice Reminders
  - Port conflicts: Change host/port when starting the API server.
  - Database path: Ensure the database path exists and is writable.
  - OTP delivery: Configure SMTP or adjust OTP delivery settings.

- Website
  - Backend not running: Start the Notice Reminders API before launching the website.
  - Environment misconfiguration: Set NEXT_PUBLIC_API_URL to the backend address.
  - Dev server: Follow the repository's guidance on using the correct dev command.

## Conclusion
You now have the essentials to install and use MOOC Utils components. Start with the Assignment Solver to practice with a Gemini API key, then set up the Notice Reminders backend and Website dashboard for a complete workflow. Use the troubleshooting tips to resolve common issues and verify each component's configuration.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Quick start examples
- Setting up course subscriptions
  - Log in to the Website dashboard using OTP.
  - Search for courses and add subscriptions to receive updates.
  - Manage channels and notifications from the dashboard.

- Installing the Assignment Solver extension
  - Build the extension for your browser and load it in developer mode.
  - Enter your Gemini API key in the extension settings.
  - Practice extraction and solving on a test assignment page.

- Accessing the Website
  - Install dependencies and configure NEXT_PUBLIC_API_URL.
  - Build and run the Next.js app; log in via OTP to access the dashboard.
