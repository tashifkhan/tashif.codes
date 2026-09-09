# Architecture & design

## Introduction
This page describes the SuperSet Telegram Notification Bot system's architecture and design. The system is built as a service-oriented application with strong separation of concerns, dependency injection, and modular components. It integrates with external data sources (SuperSet portal, email groups, and official websites) and delivers notifications via Telegram and Web Push channels. The system supports daemon mode for production deployments and provides a FastAPI webhook server for API-driven integrations.

## Project structure
The repository follows a layered, feature-based organization:
- Core: configuration and daemon utilities
- Clients: low-level integrations (MongoDB, Telegram API, Google Groups IMAP)
- Services: domain services implementing business logic (notifications, placement processing, official data scraping)
- Servers: HTTP servers (Telegram bot, webhook, scheduler)
- Runners: orchestration modules for update and notification dispatch
- Data: local JSON datasets and MongoDB storage artifacts

```mermaid
graph TB
subgraph "Core"
CFG["Config (Settings)"]
DAE["Daemon Utils"]
end
subgraph "Clients"
DB["DBClient (Mongo)"]
TG["TelegramClient (HTTP)"]
GG["GoogleGroupsClient (IMAP)"]
end
subgraph "Services"
DBS["DatabaseService"]
NTF["NotificationService"]
TGS["TelegramService"]
PLS["PlacementService"]
ENS["EmailNoticeService"]
OPS["OfficialPlacementService"]
end
subgraph "Servers"
BOT["BotServer (Telegram)"]
WHS["WebhookServer (FastAPI)"]
SCH["SchedulerServer (APScheduler)"]
end
subgraph "Runners"
UPR["UpdateRunner"]
NOR["NotificationRunner"]
end
CFG --> BOT
CFG --> WHS
CFG --> SCH
DAE --> BOT
DAE --> SCH
DB --> DBS
TG --> TGS
GG --> PLS
GG --> ENS
DBS --> NTF
TGS --> NTF
PLS --> DBS
ENS --> DBS
OPS --> DBS
UPR --> PLS
UPR --> ENS
NOR --> NTF
BOT --> NTF
WHS --> NTF
SCH --> UPR
SCH --> NOR
```

## Core components
- Configuration and Environment: centralized settings with typed validation and logging initialization
- Daemon Utilities: process forking, PID management, and graceful shutdown
- Clients:
  - DBClient: MongoDB connection and collection access
  - TelegramClient: Telegram Bot API wrapper with retries and rate-limit handling
  - GoogleGroupsClient: IMAP-based email fetching with forwarded metadata extraction
- Services:
  - DatabaseService: MongoDB operations for notices, jobs, placement offers, users, policies, and official data
  - NotificationService: channel-agnostic orchestrator for broadcasting to Telegram and Web Push
  - TelegramService: Telegram channel implementation with formatting and broadcasting
  - PlacementService: LLM-powered placement offer extraction pipeline with privacy sanitization
  - EmailNoticeService: LLM-powered notice classification and extraction with policy detection
  - OfficialPlacementService: web scraping of official placement data with deduplication
- Servers:
  - BotServer: Telegram bot with commands and user management
  - WebhookServer: FastAPI endpoints for push subscriptions, notifications, and stats
  - SchedulerServer: APScheduler-based automation for periodic updates and official data scraping
- Runners:
  - UpdateRunner: orchestrates fetching and processing from SuperSet and email sources
  - NotificationRunner: dispatches unsent notices to channels

## Architecture overview
The system employs a service-oriented architecture with dependency injection and clear boundaries between data sources, processing services, and delivery channels. The CLI entry point coordinates servers and scripts, while the daemon utilities enable production-grade background processes. External integrations are encapsulated in dedicated clients, and services coordinate business logic with minimal coupling.

```mermaid
graph TB
CLI["CLI (main.py)"]
CFG["Settings (config.py)"]
DAE["Daemon (daemon.py)"]
subgraph "Data Sources"
SS["SuperSet Portal"]
EM["Google Groups (IMAP)"]
OW["Official Website (JIIT)"]
end
subgraph "Processing"
PLS["PlacementService"]
ENS["EmailNoticeService"]
OPS["OfficialPlacementService"]
DBS["DatabaseService"]
end
subgraph "Delivery"
TGS["TelegramService"]
NTF["NotificationService"]
WHS["WebhookServer"]
end
CLI --> CFG
CLI --> DAE
CLI --> BOT["BotServer"]
CLI --> SCH["SchedulerServer"]
CLI --> WHS
SS --> PLS
EM --> PLS
EM --> ENS
OW --> OPS
PLS --> DBS
ENS --> DBS
OPS --> DBS
DBS --> NTF
TGS --> NTF
NTF --> TGS
NTF --> WHS
```

## Detailed component analysis

### DatabaseService
- Responsibilities: CRUD operations for notices, jobs, placement offers, users, policies, and official placement data; statistical queries; MongoDB connection lifecycle
- Patterns: dependency injection via DBClient; collection delegation; transaction-like operations with error handling and logging
- Persistence: MongoDB collections for each domain entity; deduplication and indexing considerations for notices and placement offers

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
+mark_as_sent(post_id)
+save_placement_offers(offers)
+save_official_placement_data(data)
+get_placement_stats()
+add_user(...)
+get_active_users()
+get_user_by_id(user_id)
+get_users_stats()
+get_policy_by_year(year)
+upsert_policy(policy)
}
DatabaseService --> DBClient : "uses"
```

### NotificationService and TelegramService
- NotificationService: channel-agnostic orchestrator; broadcasts to enabled channels; tracks unsent notices and marks them after successful delivery
- TelegramService: channel implementation with message formatting (HTML/Markdown), long message splitting, rate limiting, and user broadcasting

```mermaid
classDiagram
class NotificationService {
+channels
+broadcast(message, channels)
+send_to_channel(message, channel_name)
+send_unsent_notices(telegram, web)
+send_new_posts_to_all_users(telegram, web)
}
class TelegramService {
+channel_name
+send_message(message, parse_mode)
+send_to_user(user_id, message, parse_mode)
+broadcast_to_all_users(message, parse_mode)
+convert_markdown_to_html(text)
+convert_markdown_to_telegram(text)
}
NotificationService --> TelegramService : "routes to"
```

### PlacementService (LLM-powered)
- Implements a LangGraph pipeline for placement offer extraction:
  - Classification: keyword-based confidence scoring
  - Extraction: LLM-based JSON schema extraction with retry
  - Validation: schema validation and enrichment
  - Privacy: sanitization of headers and forwarded metadata
- Integrates with GoogleGroupsClient for email ingestion and DatabaseService for persistence

```mermaid
flowchart TD
Start(["Email Received"]) --> Classify["Classify with Keywords"]
Classify --> Confidence{"Confidence ≥ 0.6?"}
Confidence --> |No| Reject["Reject as Non-Relevant"]
Confidence --> |Yes| Extract["LLM Extraction (JSON)"]
Extract --> Validate["Validate Schema & Enrich"]
Validate --> Privacy["Sanitize Privacy"]
Privacy --> Store["Save to DB & Emit Events"]
Reject --> End(["Done"])
Store --> End
```

### EmailNoticeService (LLM-powered)
- Classifies and extracts structured notices from Google Groups emails
- Detects placement policy updates and delegates to PlacementPolicyService
- Formats notices for consistent delivery and persists to database

```mermaid
sequenceDiagram
participant GG as "GoogleGroupsClient"
participant ENS as "EmailNoticeService"
participant LLM as "LLM (LangGraph)"
participant DB as "DatabaseService"
GG->>ENS : "Unread email IDs"
ENS->>GG : "Fetch email content"
ENS->>LLM : "Classify & Extract"
LLM-->>ENS : "Structured notice or policy update"
ENS->>DB : "Save notice"
ENS-->>GG : "Mark as read"
```

### OfficialPlacementService
- Scrapes official JIIT placement page, parses tabs and tables, and stores deduplicated results
- Uses DatabaseService for persistence and timestamp updates

```mermaid
flowchart TD
Start(["Scrape Official Page"]) --> Fetch["GET HTML"]
Fetch --> Parse["Parse Tabs & Tables"]
Parse --> Model["Build Pydantic Models"]
Model --> Save["Save to DB (Deduplicate)"]
Save --> End(["Done"])
```

### Servers and orchestration
- BotServer: Telegram bot with commands and user management; DI for services
- WebhookServer: FastAPI app exposing health, push subscription, notification, and stats endpoints; DI for services
- SchedulerServer: APScheduler-based automation for periodic updates and official data scraping

```mermaid
sequenceDiagram
participant User as "User"
participant Bot as "BotServer"
participant Ntf as "NotificationService"
participant Tgs as "TelegramService"
participant DB as "DatabaseService"
User->>Bot : "/start"
Bot->>DB : "Add/Activate User"
User->>Bot : "/stats"
Bot->>DB : "Get Placement Stats"
Bot-->>User : "Stats Response"
Note over Bot,Ntf : "Background scheduling triggers updates"
Ntf->>DB : "Get Unsented Notices"
Ntf->>Tgs : "Broadcast to Users"
Tgs-->>Ntf : "Results"
Ntf->>DB : "Mark as Sent"
```

## Dependency analysis
- Configuration and daemon utilities are foundational and consumed by all servers and CLI commands
- Clients encapsulate external integrations and are injected into services
- Services depend on clients and each other minimally, enabling testability and modularity
- Servers orchestrate services and expose APIs; they rely on DI factories to wire dependencies
- Runners coordinate update and notification dispatch, mirroring CLI commands

```mermaid
graph LR
CFG["config.py"] --> BOT["bot_server.py"]
CFG --> WHS["webhook_server.py"]
CFG --> SCH["scheduler_server.py"]
DAE["daemon.py"] --> BOT
DAE --> SCH
DB["db_client.py"] --> DBS["database_service.py"]
TG["telegram_client.py"] --> TGS["telegram_service.py"]
GG["google_groups_client.py"] --> PLS["placement_service.py"]
GG --> ENS["email_notice_service.py"]
DBS --> NTF["notification_service.py"]
TGS --> NTF
PLS --> DBS
ENS --> DBS
OPS["official_placement_service.py"] --> DBS
BOT --> NTF
WHS --> NTF
SCH --> UPR["update_runner.py"]
SCH --> NOR["notification_runner.py"]
```

## Performance considerations
- Asynchronous processing: Telegram bot and webhook server use async frameworks; scheduler uses APScheduler for non-blocking jobs
- Retry and backoff: TelegramClient implements exponential backoff for rate-limited responses; PlacementService and EmailNoticeService include retry logic for LLM extraction
- Connection pooling and lifecycle: DBClient manages MongoDB connections; services close connections after operations to prevent leaks
- Rate limiting: TelegramService applies small delays between broadcasts to avoid throttling
- Scheduling cadence: SchedulerServer runs frequent intervals (hourly) to balance freshness and load
- Scalability: Modular design allows horizontal scaling of servers and runners; database sharding and indexing can be introduced at the MongoDB layer

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Configuration issues: verify environment variables for MongoDB, Telegram, Google API, and VAPID keys; Settings validates and loads from.env
- Daemon mode: PID files and logging are managed by daemon utilities; use status/stop commands to inspect and terminate processes
- Email fetching: GoogleGroupsClient requires proper credentials and app password; IMAP connectivity and folder selection are handled internally
- Telegram delivery: TelegramClient logs failures and retries; check rate limits and parse modes; fallback to plain text if formatted messages fail
- Database connectivity: DBClient tests connection with ping; ensure connection string and network access to MongoDB
- Scheduler jobs: SchedulerServer logs errors and continues; review logs for specific job failures and adjust schedules as needed

## Conclusion
The SuperSet Telegram Notification Bot is a modular, service-oriented system designed for reliability and maintainability. It integrates external data sources through decoupled clients, processes content with LLM-powered pipelines, and delivers notifications across multiple channels. The architecture supports production-grade deployment via daemon mode, FastAPI webhooks, and APScheduler-based automation, with clear separation of concerns and dependency injection enabling testability and extensibility.
