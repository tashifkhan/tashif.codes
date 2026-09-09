# Troubleshooting & FAQ

## Introduction
This page provides detailed troubleshooting and FAQ guidance for the SuperSet Telegram Notification Bot. It covers systematic diagnostics for bot communication, database connectivity, update scheduling, and notification delivery. It also includes performance tuning, memory optimization, error recovery, configuration FAQs, debugging techniques, escalation procedures, and production monitoring recommendations.

## Project structure
The bot is organized as a modular Python application with:
- CLI entry point and daemon control
- Service-oriented architecture with dependency injection
- Dedicated servers for bot, scheduler, and webhook
- Database abstraction and services for notifications, users, and data processing
- Runners for update and notification dispatch

```mermaid
graph TB
subgraph "CLI & Control"
MAIN["app/main.py"]
DAEMON["app/core/daemon.py"]
CONFIG["app/core/config.py"]
end
subgraph "Servers"
BOT["app/servers/bot_server.py"]
SCHED["app/servers/scheduler_server.py"]
WEBHOOK["app/servers/webhook_server.py"]
end
subgraph "Services"
DB["app/services/database_service.py"]
NOTIF["app/services/notification_service.py"]
TG["app/services/telegram_service.py"]
WP["app/services/web_push_service.py"]
end
subgraph "Runners"
UPD_RUN["app/runners/update_runner.py"]
NOTIF_RUN["app/runners/notification_runner.py"]
end
subgraph "Clients"
DB_CLIENT["app/clients/db_client.py"]
end
MAIN --> BOT
MAIN --> SCHED
MAIN --> WEBHOOK
MAIN --> DAEMON
MAIN --> CONFIG
BOT --> DB
SCHED --> UPD_RUN
SCHED --> NOTIF_RUN
WEBHOOK --> NOTIF
NOTIF --> TG
NOTIF --> WP
DB --> DB_CLIENT
```

## Core components
- CLI and daemon control: centralized command routing, daemonization, logging initialization
- Servers: Telegram bot, scheduler, and webhook FastAPI server
- Services: database abstraction, notification orchestration, Telegram and Web Push channels
- Runners: update fetching and notification dispatch
- Clients: database client for MongoDB connectivity

Key responsibilities:
- Configuration and logging: type-safe settings, environment loading, log rotation
- Bot server: command handlers, user registration, stats, admin commands
- Scheduler server: cron-based update jobs, official data scraping
- Webhook server: health checks, push subscription APIs, broadcast endpoints
- Database service: CRUD operations, statistics, duplicate prevention
- Notification service: channel routing, batching, delivery tracking
- Telegram service: message formatting, rate limiting, long message splitting
- Web push service: VAPID authentication, subscription management hooks

## Architecture overview
The system separates concerns across CLI, servers, services, and runners. The scheduler and bot servers operate independently, while the webhook server exposes REST endpoints for integrations. Services encapsulate domain logic and depend on the database client for persistence.

```mermaid
sequenceDiagram
participant User as "User"
participant Bot as "BotServer"
participant DB as "DatabaseService"
participant Notif as "NotificationService"
participant TG as "TelegramService"
User->>Bot : "/start" command
Bot->>DB : add_user(...)
DB-->>Bot : success/failure
Bot-->>User : welcome message
Note over Bot,DB : Registration persisted
User->>Bot : "/stats" command
Bot->>DB : get_placement_stats()
DB-->>Bot : stats data
Bot-->>User : formatted stats
```

## Detailed component analysis

### Database connectivity and persistence
- Connection lifecycle: client creates connection, initializes collections, validates with ping
- Database service wraps collections and provides CRUD, statistics, and duplicate prevention
- Indexing strategy optimized for frequent queries (unsent notices, active users, timestamps)

```mermaid
flowchart TD
Start(["DBClient.connect"]) --> CheckEnv["Load MONGO_CONNECTION_STR"]
CheckEnv --> InitClient["Initialize MongoClient"]
InitClient --> SelectDB["Select 'SupersetPlacement' DB"]
SelectDB --> InitCollections["Initialize collections"]
InitCollections --> Ping["Ping admin command"]
Ping --> Success{"Connected?"}
Success --> |Yes| LogSuccess["Log success"]
Success --> |No| RaiseErr["Raise error and exit"]
LogSuccess --> End(["Ready"])
RaiseErr --> End
```

### Telegram bot communication
- Command handlers for start, stop, status, stats, and admin commands
- Message formatting and long message splitting with rate limiting
- Broadcast to all active users with success/failure accounting

```mermaid
sequenceDiagram
participant User as "User"
participant Bot as "BotServer"
participant DB as "DatabaseService"
participant TG as "TelegramService"
User->>Bot : "/start"
Bot->>DB : add_user(user_id, chat_id, ...)
DB-->>Bot : result
Bot-->>User : welcome message
Note over Bot,TG : Broadcast to active users
Bot->>TG : broadcast_to_all_users(message)
TG->>TG : split_long_message if needed
TG-->>Bot : {success, failed, total}
```

### Notification delivery pipeline
- NotificationService orchestrates channels and tracks delivery
- DatabaseService provides unsent notices and marks as sent upon successful broadcast
- TelegramService handles rate limits and long messages; WebPushService handles VAPID and subscription removal on expiration

```mermaid
sequenceDiagram
participant Runner as "NotificationRunner"
participant Notif as "NotificationService"
participant DB as "DatabaseService"
participant TG as "TelegramService"
participant WP as "WebPushService"
Runner->>Notif : send_unsent_notices(telegram, web)
Notif->>DB : get_unsent_notices()
DB-->>Notif : list of notices
Notif->>TG : broadcast_to_all_users(message) (if enabled)
Notif->>WP : broadcast_to_all_users(message) (if enabled)
TG-->>Notif : {success, failed, total}
WP-->>Notif : {success, failed, total}
Notif->>DB : mark_as_sent(post_id) (on success)
Notif-->>Runner : summary
```

### Update scheduling and data processing
- SchedulerServer sets up cron jobs for updates and official data scraping
- UpdateRunner fetches notices/jobs from SuperSet and processes with job enrichment
- Email processing orchestrates LLM-based placement extraction and notice classification

```mermaid
flowchart TD
SchedStart["SchedulerServer.setup_scheduler"] --> Cron["Add cron jobs (IST)"]
Cron --> UpdateJob["run_scheduled_update"]
UpdateJob --> SS["fetch_and_process_updates()"]
UpdateJob --> EmailProc["cmd_update_emails()"]
UpdateJob --> SendTG["send_updates(telegram=True, web=False)"]
SS --> DBSave["DatabaseService.save_notice / upsert_structured_job"]
EmailProc --> Placement["PlacementService.process_email"]
Placement --> DBSavePO["DatabaseService.save_placement_offers"]
SendTG --> Notif["NotificationService.send_unsent_notices"]
```

### Webhook server and integrations
- Health endpoints, push subscription management, and broadcast APIs
- Dependency injection for services and graceful degradation when optional dependencies are missing

```mermaid
sequenceDiagram
participant Client as "External Client"
participant Webhook as "WebhookServer"
participant DB as "DatabaseService"
participant Notif as "NotificationService"
participant WP as "WebPushService"
Client->>Webhook : GET /health
Webhook-->>Client : {status : "healthy"}
Client->>Webhook : POST /api/push/subscribe
Webhook->>DB : save subscription
DB-->>Webhook : success
Webhook-->>Client : {success}
Client->>Webhook : POST /api/notify
Webhook->>Notif : broadcast(message, channels)
Notif->>WP : broadcast_to_all_users (if enabled)
Webhook-->>Client : {success, results}
```

## Dependency analysis
- Loose coupling via dependency injection and factory functions
- Centralized configuration and logging across components
- Clear separation between servers, services, and runners

```mermaid
graph LR
MAIN["main.py"] --> BOT["bot_server.py"]
MAIN --> SCHED["scheduler_server.py"]
MAIN --> WEBHOOK["webhook_server.py"]
BOT --> DB["database_service.py"]
SCHED --> UPD_RUN["update_runner.py"]
SCHED --> NOTIF_RUN["notification_runner.py"]
WEBHOOK --> NOTIF["notification_service.py"]
NOTIF --> TG["telegram_service.py"]
NOTIF --> WP["web_push_service.py"]
DB --> DB_CLIENT["db_client.py"]
```

## Performance considerations
- Database queries: use indexes and projections; avoid loading entire collections
- Asynchronous design: ensure non-blocking operations in async contexts
- Batch operations: bulk writes and updates to reduce overhead
- Memory usage: clear caches, avoid circular references, monitor RSS
- LLM model selection: choose appropriate model for speed vs accuracy trade-offs

[No sources needed since this section provides general guidance]

## Troubleshooting guide

### Connection issues
- MongoDB connection failures
  - Validate connection string format and credentials
  - Check IP whitelist and network access
  - Confirm firewall allows outbound connections to port 27017
  - Test connectivity with ping and curl
  - Use the provided connection test script in troubleshooting docs
- Email IMAP authentication failures
  - Ensure 2FA is enabled and app password is used
  - Regenerate app password if needed
- Telegram bot token invalid
  - Verify token format and ensure it is active
  - Check for spaces or typos in the token

### Bot issues
- Bot not receiving messages
  - Confirm bot server is running and listening
  - Distinguish between long-polling and webhook modes
  - Ensure user has sent /start and is registered
  - Validate chat ID format and permissions
- Bot commands not responding
  - Check command format and casing
  - Verify admin-only commands require admin ID
  - Respect rate limiting and timing
- Bot crashes unexpectedly
  - Inspect logs for unhandled exceptions
  - Monitor memory usage and consider reducing batch sizes
  - Ensure database reconnection logic is in place
  - Avoid blocking operations in async code paths

### Data processing issues
- Notices not being scraped
  - Validate SuperSet credentials and portal accessibility
  - Check for portal layout changes affecting selectors
  - Review duplicate detection logic and last scraped timestamps
- Placement offers not extracted
  - Verify GOOGLE_API_KEY validity and LLM model configuration
  - Confirm email fetching is functioning
- Duplicate notifications sent
  - Inspect notice ID uniqueness and timestamp handling
  - Check manual updates and sent flags

### Notification issues
- Messages not sent to Telegram
  - Reset sent flags if needed and re-send
  - Test Telegram API connectivity manually
  - Validate chat ID format and length limits
- Web push not working
  - Generate and configure VAPID keys
  - Verify user subscriptions exist
  - Ensure service worker is registered on the client
  - Handle expired subscriptions and remove them

### Performance issues
- Slow bot response
  - Analyze slow database queries and add indexes
  - Replace blocking I/O with async equivalents
  - Batch operations and reduce per-user loops
  - Tune LLM model for speed if latency is high
- High memory usage
  - Use lazy cursors for large queries
  - Periodically clear caches and finalize objects
  - Investigate circular references and weak references

### FAQ
- How often should updates run?
  - Default schedule is three times daily (12 AM, 12 PM, 6 PM IST); adjust via configuration
- Can I run multiple instances?
  - Yes, coordinate via process isolation and database locking
- How do I back up data?
  - Use mongodump against the configured connection string
- How do I add a new data source?
  - Create a service class and integrate via the main CLI or scheduler
- Can I use SQLite instead of MongoDB?
  - Not without rewriting the database abstraction
- How do I change the bot token?
  - Obtain a new token from BotFather and restart the daemon
- How do I see what's happening?
  - Tail the logs in the configured log directory
- Why aren't notifications sent at scheduled times?
  - Verify scheduler is enabled, bot is running, and scheduler logs
- Can users filter notifications?
  - Not yet, but options are /start and /stop
- How do I contact support?
  - Use GitHub Issues or the live bot link

## Conclusion
This troubleshooting guide consolidates practical diagnostics, logging strategies, and resolution steps for the SuperSet Telegram Notification Bot. By following the systematic approaches outlined, covering connection, bot, data processing, notification delivery, performance, and operational FAQs, you can maintain a reliable, production-grade notification system.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Systematic diagnostic checklist
- Environment variables validated and loaded
- Database connectivity verified
- Bot server running and reachable
- Scheduler jobs configured and logging
- Notification channels enabled and configured
- Logs reviewed for recent errors and warnings
- Resource usage monitored (CPU, memory, disk)

### Escalation procedures
- Capture logs from all components (bot, scheduler, webhook)
- Provide environment details and configuration excerpts
- Include reproduction steps and error messages
- Engage with community support channels as documented
