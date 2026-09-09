# Design principles

## Introduction
This page explains the design principles underpinning the SuperSet Telegram Notification Bot. The system follows Service-Oriented Architecture (SOA) with a strong emphasis on single responsibility, dependency injection for loose coupling, and separation of concerns across data access, business logic, presentation, and distribution layers. It also documents the orchestration pattern used for email processing to prevent data loss, ensuring emails are marked as read only after successful processing.

## Project structure
The project is organized into distinct layers:
- Core: centralized configuration and logging
- Clients: external integrations (database, SuperSet, Google Groups)
- Services: business logic and processing (notices, placement, notifications)
- Runners: orchestrators for update and notification flows
- Servers: presentation layer (Telegram bot, scheduler, webhook)
- Data: local storage artifacts and configuration

```mermaid
graph TB
subgraph "Core"
CFG["config.py"]
end
subgraph "Clients"
DB["db_client.py"]
SG["google_groups_client.py"]
end
subgraph "Services"
DBS["database_service.py"]
PS["placement_service.py"]
ENS["email_notice_service.py"]
NS["notification_service.py"]
end
subgraph "Runners"
UR["update_runner.py"]
NR["notification_runner.py"]
end
subgraph "Servers"
BOT["bot_server.py"]
SCH["scheduler_server.py"]
end
CFG --> BOT
CFG --> SCH
DB --> DBS
SG --> PS
SG --> ENS
DBS --> PS
DBS --> ENS
DBS --> NS
UR --> PS
UR --> ENS
NR --> NS
BOT --> NS
SCH --> UR
```

## Core components
- Configuration and logging: centralized settings and logging setup with daemon-aware printing and caching.
- Data access: DBClient encapsulates MongoDB connectivity; DatabaseService exposes typed operations and maintains loose coupling via dependency injection.
- Business logic: PlacementService and EmailNoticeService implement reliable LLM-driven pipelines with classification, extraction, validation, and privacy sanitization.
- Orchestration: UpdateRunner and NotificationRunner coordinate multi-service workflows with DI and resource lifecycle management.
- Presentation: BotServer and SchedulerServer expose command-driven and scheduled workflows respectively, injecting services for decoupled operation.
- Distribution: NotificationService orchestrates multiple channels (Telegram, Web Push) and marks notices sent only after successful delivery.

Key design principles demonstrated:
- Single Responsibility: Each class focuses on one concern (e.g., DBClient for DB connectivity, PlacementService for placement extraction).
- Dependency Injection: Services accept dependencies via constructor parameters, enabling testability and runtime substitution.
- Separation of Concerns: Data access (clients), business logic (services), orchestration (runners), presentation (servers), and distribution (notification service) are cleanly separated.

## Architecture overview
The system adheres to SOA with DI and layered separation:
- Presentation: Telegram bot and scheduler servers expose user/admin interfaces and scheduled jobs.
- Orchestration: Runners coordinate data ingestion and notification dispatch.
- Business Logic: Services encapsulate domain-specific processing (placement offers, notices, policies).
- Data Access: Clients abstract external systems; DatabaseService centralizes persistence operations.
- Distribution: NotificationService routes messages across channels and marks notices sent upon success.

```mermaid
graph TB
CLI["CLI (main.py)"]
BOT["BotServer"]
SCH["SchedulerServer"]
UR["UpdateRunner"]
NR["NotificationRunner"]
PS["PlacementService"]
ENS["EmailNoticeService"]
NS["NotificationService"]
DBS["DatabaseService"]
DB["DBClient"]
SG["GoogleGroupsClient"]
CLI --> BOT
CLI --> SCH
CLI --> UR
CLI --> NR
UR --> PS
UR --> ENS
NR --> NS
PS --> DBS
ENS --> DBS
PS --> SG
ENS --> SG
DBS --> DB
NS --> DBS
```

## Detailed component analysis

### Dependency injection patterns and loose coupling
- Constructor injection: Services accept dependencies (e.g., DatabaseService, GoogleGroupsClient, TelegramService) via constructor parameters, enabling runtime substitution and test doubles.
- Optional dependencies with defaults: Runners conditionally construct services if not provided, allowing reuse across CLI, servers, and tests.
- Resource ownership: Runners track whether they own DB connections and close them deterministically via context managers.

Examples from the codebase:
- DatabaseService receives a DBClient instance and delegates collection access, keeping persistence logic isolated.
- PlacementService and EmailNoticeService accept DB and formatter/policy services, enabling modular composition.
- UpdateRunner and NotificationRunner accept services or construct them locally, supporting DI and isolation.

### Orchestration pattern for email processing (sequential, read-affirmed)
The email processing orchestrator ensures data integrity by fetching content without marking as read, attempting placement detection, then notice detection, and finally marking as read only after successful processing or determination of irrelevance. This prevents data loss if transient failures occur mid-processing.

```mermaid
sequenceDiagram
participant CLI as "CLI (main.py/cmd_update_emails)"
participant GC as "GoogleGroupsClient"
participant PS as "PlacementService"
participant DBS as "DatabaseService"
participant ENS as "EmailNoticeService"
CLI->>GC : "get_unread_message_ids()"
GC-->>CLI : "IDs"
loop For each email ID
CLI->>GC : "fetch_email(id, mark_as_read=False)"
GC-->>CLI : "email_data"
CLI->>PS : "process_email(email_data)"
alt Placement offer found
PS-->>CLI : "offer"
CLI->>DBS : "save_placement_offers([offer])"
DBS-->>CLI : "events"
CLI->>CLI : "process_events(events) via formatter"
CLI->>GC : "mark_as_read(id)"
else Not a placement offer
CLI->>ENS : "process_single_email(email_data)"
alt Notice detected
ENS-->>CLI : "NoticeDocument"
CLI->>DBS : "save_notice(doc)"
DBS-->>CLI : "success"
CLI->>GC : "mark_as_read(id)"
else Irrelevant
CLI->>GC : "mark_as_read(id)"
end
end
end
```

### Service-Oriented architecture with single responsibility
- DBClient: encapsulates MongoDB connection and collection access.
- DatabaseService: exposes typed CRUD and aggregation operations for notices, jobs, placement offers, users, policies, and official data.
- PlacementService: orchestrates placement offer extraction via LangGraph with classification, extraction, validation, and privacy sanitization.
- EmailNoticeService: processes non-placement notices via LLM-based classification and extraction, with policy update handling.
- NotificationService: aggregates channels and broadcasts messages, marking notices sent only after successful delivery.
- UpdateRunner and NotificationRunner: coordinate multi-service workflows for ingestion and distribution.

```mermaid
classDiagram
class DBClient {
+connect()
+close_connection()
+notices_collection
+jobs_collection
+placement_offers_collection
+users_collection
+policies_collection
+official_placement_data_collection
}
class DatabaseService {
+notice_exists(id)
+save_notice(notice)
+get_unsent_notices()
+mark_as_sent(id)
+save_placement_offers(offers)
+save_official_placement_data(data)
+get_placement_stats()
}
class GoogleGroupsClient {
+get_unread_message_ids()
+fetch_email(id, mark_as_read)
+mark_as_read(id)
}
class PlacementService {
+process_email(email_data)
}
class EmailNoticeService {
+process_emails(mark_as_read)
+process_single_email(email_data)
}
class NotificationService {
+broadcast(message, channels)
+send_unsent_notices(telegram, web)
}
DBClient <.. DatabaseService : "dependency"
GoogleGroupsClient <.. PlacementService : "dependency"
GoogleGroupsClient <.. EmailNoticeService : "dependency"
DatabaseService <.. PlacementService : "dependency"
DatabaseService <.. EmailNoticeService : "dependency"
DatabaseService <.. NotificationService : "dependency"
```

### Presentation and distribution layers
- BotServer: Telegram bot with DI for DB, notification, admin, and stats services; registers command handlers and runs in polling mode.
- SchedulerServer: schedules periodic update jobs mirroring legacy behavior and official placement scraping.
- NotificationRunner: constructs channels (Telegram/Web Push) and delegates to NotificationService for sending unsent notices.

```mermaid
sequenceDiagram
participant User as "User"
participant Bot as "BotServer"
participant DBS as "DatabaseService"
participant NS as "NotificationService"
participant TG as "TelegramService"
User->>Bot : "/start"
Bot->>DBS : "add_user(...)"
DBS-->>Bot : "result"
Bot-->>User : "welcome message"
Note over Bot,NS : Scheduled or manual send flow
Bot->>NS : "send_unsent_notices(telegram=True)"
NS->>DBS : "get_unsent_notices()"
DBS-->>NS : "unsent posts"
NS->>TG : "broadcast_to_all_users(message)"
TG-->>NS : "results"
NS->>DBS : "mark_as_sent(post_id)"
```

### Orchestration flow in CLI (SuperSet + emails + send)
The CLI composes a full pipeline: SuperSet updates, email updates (placement offers and notices), and notification dispatch. This demonstrates SOA with DI and layered orchestration.

```mermaid
flowchart TD
Start(["CLI Entry"]) --> SS["Fetch SuperSet Updates"]
SS --> EM["Fetch Email Updates<br/>Placement Offers + Notices"]
EM --> ORCH["Orchestrator:<br/>Try PlacementService -> Else EmailNoticeService -> Mark Read"]
ORCH --> SEND["Send Unsented Notices"]
SEND --> End(["Complete"])
```

## Dependency analysis
The system exhibits low coupling and high cohesion:
- Clients depend on external APIs; services depend on clients and shared protocols.
- Runners depend on services and orchestrate workflows.
- Servers depend on services for presentation and scheduling.

```mermaid
graph LR
CFG["config.py"] --> BOT["bot_server.py"]
CFG --> SCH["scheduler_server.py"]
DB["db_client.py"] --> DBS["database_service.py"]
SG["google_groups_client.py"] --> PS["placement_service.py"]
SG --> ENS["email_notice_service.py"]
DBS --> PS
DBS --> ENS
DBS --> NS["notification_service.py"]
UR["update_runner.py"] --> PS
UR --> ENS
NR["notification_runner.py"] --> NS
BOT --> NS
```

## Performance considerations
- Lazy initialization and DI reduce startup overhead and enable reuse of services.
- Batch operations: DatabaseService merges placement offers and computes statistics efficiently.
- Conditional enrichment: UpdateRunner filters existing IDs and enriches only new jobs to minimize API calls.
- Sequential email processing avoids concurrent writes and ensures atomicity of read-mark cycles.
- Logging and daemon mode reduce I/O overhead in production environments.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Configuration and logging: Centralized settings and logging setup with daemon-aware printing and cached settings.
- Graceful error handling: Services catch exceptions, log errors, and avoid marking emails as read on failure to retry later.
- Resource lifecycle: Runners manage DB connections and close them deterministically.

## Conclusion
The SuperSet Telegram Notification Bot applies SOA with DI and separation of concerns to achieve maintainability, testability, and extensibility. The orchestration pattern for email processing prioritizes data integrity by marking emails as read only after successful processing. These design principles enable clean layering, easy testing, and straightforward extension of new sources, channels, and processing logic.
