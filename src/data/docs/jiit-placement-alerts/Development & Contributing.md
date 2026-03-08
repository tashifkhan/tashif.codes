# Development & Contributing

<cite>
**Referenced Files in This Document**
- [app/main.py](file://app/main.py)
- [app/pyproject.toml](file://app/pyproject.toml)
- [app/requirements.txt](file://app/requirements.txt)
- [app/docker-compose.dev.yaml](file://app/docker-compose.dev.yaml)
- [app/core/config.py](file://app/core/config.py)
- [app/core/daemon.py](file://app/core/daemon.py)
- [app/services/database_service.py](file://app/services/database_service.py)
- [app/services/telegram_service.py](file://app/services/telegram_service.py)
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py)
- [app/servers/bot_server.py](file://app/servers/bot_server.py)
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md)
- [docs/README.md](file://docs/README.md)
- [AGENTS.md](file://AGENTS.md)
- [.github/workflows/daily-run.yml.legacy](file://.github/workflows/daily-run.yml.legacy)
- [.github/workflows/noon-run.yml.legacy](file://.github/workflows/noon-run.yml.legacy)
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
9. [Contribution Workflow](#contribution-workflow)
10. [Extensibility & Integration Guide](#extensibility--integration-guide)
11. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive development and contribution guidance for the SuperSet Telegram Notification Bot. It covers local setup, testing, code standards, development tools, debugging and profiling, performance optimization, CI/CD, and extension strategies for adding new notification channels and data sources.

## Project Structure
The project is organized as a modular Python application under the app/ directory with clear separation of concerns:
- Core configuration and daemon utilities
- Service layer for business logic
- Servers for Telegram bot, webhook, and update orchestration
- Data models and schemas
- Tests and logs
- Development and deployment assets

```mermaid
graph TB
subgraph "Core"
CFG["core/config.py"]
DAE["core/daemon.py"]
end
subgraph "Services"
DB["services/database_service.py"]
TG["services/telegram_service.py"]
end
subgraph "Runners"
NR["runners/notification_runner.py"]
end
subgraph "Servers"
BOT["servers/bot_server.py"]
end
subgraph "CLI"
MAIN["app/main.py"]
end
CFG --> MAIN
DAE --> MAIN
MAIN --> BOT
MAIN --> NR
NR --> DB
NR --> TG
BOT --> DB
BOT --> TG
```

**Diagram sources**
- [app/main.py](file://app/main.py#L370-L632)
- [app/core/config.py](file://app/core/config.py#L18-L254)
- [app/core/daemon.py](file://app/core/daemon.py#L114-L251)
- [app/services/database_service.py](file://app/services/database_service.py#L16-L200)
- [app/services/telegram_service.py](file://app/services/telegram_service.py#L20-L200)
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py#L21-L160)
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L29-L200)

**Section sources**
- [docs/README.md](file://docs/README.md#L1-L252)
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L115-L173)

## Core Components
- CLI entry point orchestrating commands for bot, scheduler, webhook, update, send, official, and daemon control
- Centralized configuration with Pydantic settings and logging setup
- Daemon utilities for Unix-style background processes
- Service layer for database operations, Telegram notifications, and integrations
- Notification runner coordinating dispatch across channels
- Telegram bot server handling commands and user interactions

Key responsibilities and integration points are defined in the CLI and service wiring.

**Section sources**
- [app/main.py](file://app/main.py#L370-L632)
- [app/core/config.py](file://app/core/config.py#L18-L254)
- [app/core/daemon.py](file://app/core/daemon.py#L114-L251)
- [app/services/database_service.py](file://app/services/database_service.py#L16-L200)
- [app/services/telegram_service.py](file://app/services/telegram_service.py#L20-L200)
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py#L21-L160)
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L29-L200)

## Architecture Overview
The system follows a dependency-injected, modular architecture:
- Data sources (SuperSet portal, emails, official website) feed structured data into MongoDB
- Services encapsulate business logic and integrate with external APIs
- Notification channels (Telegram, Web Push) consume unsent notices from storage
- CLI and servers orchestrate execution and expose admin interfaces

```mermaid
graph TB
SRC1["SuperSet Portal"] --> SS["SupersetClientService"]
SRC2["Emails (Gmail)"] --> PS["PlacementService"]
SRC3["Official Website"] --> OPS["OfficialPlacementService"]
SS --> DB["DatabaseService"]
PS --> DB
OPS --> DB
DB --> NR["NotificationRunner"]
NR --> TG["TelegramService"]
NR --> WP["WebPushService"]
CLI["CLI (main.py)"] --> BOT["BotServer"]
CLI --> WH["Webhook Server"]
CLI --> SCH["Scheduler Server"]
```

**Diagram sources**
- [app/main.py](file://app/main.py#L370-L632)
- [app/services/database_service.py](file://app/services/database_service.py#L16-L200)
- [app/services/telegram_service.py](file://app/services/telegram_service.py#L20-L200)
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py#L21-L160)
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L29-L200)

## Detailed Component Analysis

### CLI and Command Orchestration
The CLI defines subcommands for bot, scheduler, webhook, update, send, official, and daemon control. It sets up logging, supports daemon mode, and wires services for orchestrated execution.

```mermaid
sequenceDiagram
participant U as "User"
participant CLI as "main.py"
participant CFG as "Config"
participant LOG as "Logging"
participant BOT as "BotServer"
participant NR as "NotificationRunner"
U->>CLI : "python main.py bot -d"
CLI->>CFG : get_settings()
CLI->>LOG : setup_logging(settings)
CLI->>BOT : create_bot_server(settings, daemon_mode)
BOT-->>U : "Bot running in background"
```

**Diagram sources**
- [app/main.py](file://app/main.py#L370-L632)
- [app/core/config.py](file://app/core/config.py#L188-L254)
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L29-L200)

**Section sources**
- [app/main.py](file://app/main.py#L370-L632)

### Configuration and Logging
Centralized settings management with Pydantic, environment loading, and configurable logging levels and destinations. Includes daemon-aware printing and PID file management.

```mermaid
flowchart TD
Start(["Load Settings"]) --> EnvCheck{"Env file present?"}
EnvCheck --> |Yes| LoadEnv["Load .env via dotenv"]
EnvCheck --> |No| DefaultEnv["Use default behavior"]
LoadEnv --> InitSettings["Initialize Settings"]
DefaultEnv --> InitSettings
InitSettings --> SetupLog["setup_logging(settings)"]
SetupLog --> Done(["Ready"])
```

**Diagram sources**
- [app/core/config.py](file://app/core/config.py#L156-L254)

**Section sources**
- [app/core/config.py](file://app/core/config.py#L18-L254)

### Daemon Utilities
Unix-style daemonization with PID file management, graceful stop, and status reporting. Ensures background processes detach cleanly and redirect output.

```mermaid
flowchart TD
A["is_running(name)"] --> B{"PID file exists?"}
B --> |No| NotRunning["False"]
B --> |Yes| CheckProc["os.kill(pid, 0)"]
CheckProc --> |Exists| Running["True"]
CheckProc --> |Error| Clean["cleanup_pid_file(name); False"]
Stop["stop_daemon(name)"] --> ReadPID["read_pid_file(name)"]
ReadPID --> HasPID{"PID found?"}
HasPID --> |No| NotRunning2["False"]
HasPID --> |Yes| Kill["SIGTERM -> wait -> SIGKILL if needed"]
Kill --> Cleanup["cleanup_pid_file(name); True"]
```

**Diagram sources**
- [app/core/daemon.py](file://app/core/daemon.py#L59-L112)

**Section sources**
- [app/core/daemon.py](file://app/core/daemon.py#L1-L251)

### Database Service
Encapsulates MongoDB operations for notices, jobs, placement offers, users, and policies. Provides helpers for existence checks, retrieval, and statistics.

```mermaid
classDiagram
class DatabaseService {
+notice_exists(notice_id) bool
+save_notice(notice) (bool, str)
+get_unsent_notices() List
+mark_as_sent(post_id) bool
+get_notice_stats() Dict
+close_connection() void
}
```

**Diagram sources**
- [app/services/database_service.py](file://app/services/database_service.py#L16-L200)

**Section sources**
- [app/services/database_service.py](file://app/services/database_service.py#L16-L200)

### Telegram Service
Implements Telegram notifications with message chunking, formatting, and broadcasting capabilities. Integrates with a Telegram client wrapper.

```mermaid
classDiagram
class TelegramService {
+channel_name str
+test_connection() bool
+send_message(message, parse_mode) bool
+send_to_user(user_id, message, parse_mode) bool
+broadcast_to_all_users(message, parse_mode) Dict
+send_message_html(message) bool
}
```

**Diagram sources**
- [app/services/telegram_service.py](file://app/services/telegram_service.py#L20-L200)

**Section sources**
- [app/services/telegram_service.py](file://app/services/telegram_service.py#L20-L200)

### Notification Runner
Coordinates sending unsent notices across channels using dependency injection. Supports Telegram and Web Push, with optional NotificationService composition.

```mermaid
sequenceDiagram
participant CLI as "main.py"
participant NR as "NotificationRunner"
participant DB as "DatabaseService"
participant TG as "TelegramService"
participant WP as "WebPushService"
CLI->>NR : send_updates(telegram, web)
NR->>DB : get_unsent_notices()
alt telegram
NR->>TG : send_message(formatted)
end
alt web
NR->>WP : send_push(formatted)
end
NR-->>CLI : results
```

**Diagram sources**
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py#L60-L160)

**Section sources**
- [app/runners/notification_runner.py](file://app/runners/notification_runner.py#L21-L160)

### Telegram Bot Server
Long-polling Telegram bot with command handlers for user registration, help, status, stats, and administrative commands. Integrates with services for DB, notifications, and stats.

```mermaid
sequenceDiagram
participant TGB as "Telegram Bot"
participant BS as "BotServer"
participant DB as "DatabaseService"
participant NS as "NotificationService"
TGB->>BS : "/start"
BS->>DB : add_user(...)
BS-->>TGB : Welcome message
TGB->>BS : "/stats"
BS->>NS : compute stats
BS-->>TGB : Stats reply
```

**Diagram sources**
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L87-L200)

**Section sources**
- [app/servers/bot_server.py](file://app/servers/bot_server.py#L29-L200)

## Dependency Analysis
- Project metadata and dependencies are defined in pyproject.toml and requirements.txt
- Development uses uv for dependency management and reproducible environments
- Docker Compose provides a local MongoDB instance for development

```mermaid
graph TB
PY["pyproject.toml"] --> UV["uv (sync)"]
RT["requirements.txt"] --> PIP["pip install"]
DC["docker-compose.dev.yaml"] --> MONGO["MongoDB Container"]
UV --> APP["app/"]
PIP --> APP
MONGO --> APP
```

**Diagram sources**
- [app/pyproject.toml](file://app/pyproject.toml#L1-L27)
- [app/requirements.txt](file://app/requirements.txt#L1-L81)
- [app/docker-compose.dev.yaml](file://app/docker-compose.dev.yaml#L1-L15)

**Section sources**
- [app/pyproject.toml](file://app/pyproject.toml#L1-L27)
- [app/requirements.txt](file://app/requirements.txt#L1-L81)
- [app/docker-compose.dev.yaml](file://app/docker-compose.dev.yaml#L1-L15)

## Performance Considerations
- Use daemon mode for background processes to reduce overhead and improve reliability
- Chunk long Telegram messages to avoid rate limits and failures
- Minimize database round-trips by batching operations and using aggregation where possible
- Leverage caching for settings and enable logging levels appropriate to environment
- Profile CPU and memory usage during heavy update cycles using built-in profiling tools

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and remedies:
- Verify environment variables and MongoDB connectivity before running
- Check daemon status and logs for background processes
- Use verbose CLI mode for detailed logs
- Inspect scheduler job registrations and intervals
- Validate Telegram bot token and chat ID configuration

**Section sources**
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L569-L593)
- [app/core/daemon.py](file://app/core/daemon.py#L235-L251)
- [app/core/config.py](file://app/core/config.py#L188-L254)

## Contribution Workflow
- Fork and branch: feature/your-feature-name or fix/issue-description
- Develop with pytest for unit tests and flake8 for style checks
- Commit with conventional messages (feat:, fix:, refactor:, docs:, test:)
- Create Pull Request with checklist items addressed
- Address reviewer feedback and ensure tests pass

**Section sources**
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L175-L234)
- [AGENTS.md](file://AGENTS.md#L414-L481)

## Extensibility & Integration Guide
- Adding a new notification channel:
  - Implement a channel-specific service following the INotificationChannel pattern
  - Integrate via NotificationRunner and CLI flags
  - Add tests and update documentation
- Adding a new data source:
  - Create a client/service pair similar to SupersetClientService or PlacementService
  - Wire into update orchestration in main.py
  - Ensure idempotent persistence and event generation for notifications
- Integrating additional LLM pipelines:
  - Extend LangGraph workflows in dedicated services
  - Maintain separation of concerns and inject dependencies

**Section sources**
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L633-L704)
- [app/main.py](file://app/main.py#L98-L334)

## Continuous Integration and Release Management
- Scheduled workflows run the bot hourly and scrape official data
- Python version pinned to 3.11 in CI for stability
- Secrets injected for Telegram, MongoDB, SuperSet credentials, and email access
- Use uv caching for faster dependency installs in CI

**Section sources**
- [.github/workflows/daily-run.yml.legacy](file://.github/workflows/daily-run.yml.legacy#L1-L72)
- [.github/workflows/noon-run.yml.legacy](file://.github/workflows/noon-run.yml.legacy#L1-L58)

## Development & Testing Guide
- Local setup with uv sync and Docker Compose for MongoDB
- Run pytest for unit tests and coverage
- Use mocks for external services in tests
- Follow AGENTS.md style and best practices

**Section sources**
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L15-L112)
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L236-L335)
- [AGENTS.md](file://AGENTS.md#L38-L54)

## Debugging and Profiling
- Use safe_print for daemon-friendly output
- Enable verbose logging via CLI flags
- Employ pdb or IDE debuggers for interactive inspection
- Profile code using cProfile for hotspots

**Section sources**
- [docs/DEVELOPMENT.md](file://docs/DEVELOPMENT.md#L484-L629)

## Code Standards and Style
- Python 3.12+ with type hints and docstrings
- Organized imports, consistent naming, and class structure
- Logging at appropriate levels and error handling patterns
- Configuration via Pydantic settings with validation

**Section sources**
- [AGENTS.md](file://AGENTS.md#L64-L233)

## Conclusion
This guide consolidates local development, testing, contribution, and operational practices for the SuperSet Telegram Notification Bot. By following the documented workflows, standards, and extension patterns, contributors can reliably add features, integrate new channels, and maintain system performance and reliability.