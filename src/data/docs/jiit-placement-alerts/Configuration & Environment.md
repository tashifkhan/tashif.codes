# Configuration & environment

## Introduction
This page explains the configuration and environment management for the SuperSet Telegram Notification Bot. It covers the Pydantic-based settings system, environment variable handling, credential management, configuration hierarchy, defaults, overrides, validation rules, and error handling. It also provides security best practices, backup strategies, and environment-specific guidance for development, staging, and production.

## Project structure
Configuration is centralized in a single module that defines strongly-typed settings, loads from environment variables, and supports caching. Clients and services consume configuration through the settings object or environment variables directly when appropriate. The CLI orchestrates daemonization and logging initialization.

```mermaid
graph TB
subgraph "Core"
CFG["app/core/config.py<br/>Settings + get_settings()"]
DAE["app/core/daemon.py<br/>PID + daemon lifecycle"]
end
subgraph "CLI"
MAIN["app/main.py<br/>CLI entry + logging setup"]
end
subgraph "Clients"
DB["app/clients/db_client.py<br/>MongoDB"]
TG["app/clients/telegram_client.py<br/>Telegram API"]
GG["app/clients/google_groups_client.py<br/>IMAP/Gmail"]
SS["app/clients/superset_client.py<br/>SuperSet API"]
end
MAIN --> CFG
MAIN --> DAE
DB --> CFG
TG --> CFG
GG --> CFG
SS --> CFG
```

## Core components
- Centralized Settings: Strongly typed configuration using Pydantic Settings with validation aliases and defaults.
- Configuration Loader: Lazy-loading with caching and.env discovery.
- Logging Setup: Initializes loggers with configurable levels and handlers, supporting daemon mode.
- Daemon Utilities: PID file management and Unix-style daemonization for background processes.
- Client Integrations: Clients read credentials either from Settings or environment variables directly.

Key responsibilities:
- Settings define all configuration fields, validation rules, and defaults.
- get_settings() loads from.env and environment variables, caches results.
- setup_logging() configures handlers and levels, respecting daemon mode.
- Daemon utilities manage process lifecycle and logging redirection for background runs.

## Architecture overview
The configuration system follows a layered approach:
- Layer 1: Settings definition with Pydantic Fields and validation aliases.
- Layer 2: Loader that resolves.env and environment variables, caches instances.
- Layer 3: CLI initializes logging and optionally daemonizes.
- Layer 4: Clients access configuration via Settings or environment variables.

```mermaid
sequenceDiagram
participant CLI as "CLI (main.py)"
participant CFG as "Settings Loader (config.py)"
participant LOG as "Logger (config.py)"
participant DAE as "Daemon (daemon.py)"
participant CL as "Clients"
CLI->>CFG : get_settings()
CFG-->>CLI : Settings instance (cached)
CLI->>LOG : setup_logging(settings)
alt daemon mode requested
CLI->>DAE : daemonize(name)
DAE-->>CLI : PID file + redirected stdio
CLI->>LOG : re-init logging in daemon
end
CL->>CFG : read fields (via Settings or env)
CFG-->>CL : validated values
```

## Detailed component analysis

### Settings model and environment resolution
- Settings class defines all configuration fields with explicit validation aliases and defaults.
-.env loading occurs before returning the Settings instance.
- get_settings() caches the instance for the process lifetime.

Configuration categories:
- Database: MongoDB connection string.
- Telegram: Bot token and default chat ID.
- SuperSet: JSON list of credentials.
- Google AI (Gemini): API key.
- Email (placement): Email address and app password.
- Web Push (VAPID): Private/public key and contact email.
- Server: Host and port for webhook server.
- Daemon: Toggle to suppress stdout.
- Logging: Levels and file paths for bot and scheduler logs.

Environment resolution order:
1. Environment variables (highest precedence).
2..env file (if present).
3. Code defaults (lowest precedence).

```mermaid
flowchart TD
Start(["Load Settings"]) --> EnvCheck{"Env var present?"}
EnvCheck --> |Yes| UseEnv["Use env value"]
EnvCheck --> |No| DotEnvCheck{"DotEnv present?"}
DotEnvCheck --> |Yes| UseDotEnv["Use .env value"]
DotEnvCheck --> |No| UseDefault["Use default"]
UseEnv --> Validate["Pydantic validation"]
UseDotEnv --> Validate
UseDefault --> Validate
Validate --> Done(["Settings ready"])
```

### Configuration loading and caching
- get_settings() determines.env location relative to the config module, tries project root and app subdirectory, then falls back to default behavior.
- Uses python-dotenv to load variables from.env.
- Returns a cached Settings instance using LRU cache.

Operational notes:
- Daemon processes clear the cache before reinitializing logging to ensure fresh settings.
- Absolute log paths are resolved consistently with the same base directory logic.

### Logging configuration
- setup_logging() configures file and optional console handlers based on daemon mode.
- Ensures log directories exist and normalizes relative paths.
- Reduces noise from third-party libraries.

Daemon-specific behavior:
- In daemon mode, console handler is suppressed; logs are written to files.
- Scheduler uses a separate log file path override.

### Daemon utilities
- daemonize() performs Unix-style double-fork, writes PID file, redirects stdio to log files, and prepares the process for background operation.
- PID files are stored under a dedicated directory.
- stop_daemon() sends termination signals and cleans up PID files.

Integration with configuration:
- CLI clears settings cache and reinitializes logging after daemonization.
- Scheduler overrides log file path before logging setup.

### Client credential access patterns
- DBClient: Reads MONGO_CONNECTION_STR from environment if not provided.
- TelegramClient: Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment.
- GoogleGroupsClient: Reads PLACEMENT_EMAIL and PLACEMENT_APP_PASSWORD from Settings.
- SupersetClient: Does not read credentials via Settings; credentials are passed programmatically.

```mermaid
classDiagram
class Settings {
+mongo_connection_str
+telegram_bot_token
+telegram_chat_id
+superset_credentials
+google_api_key
+placement_email
+placement_app_password
+vapid_private_key
+vapid_public_key
+vapid_email
+webhook_port
+webhook_host
+daemon_mode
+log_level
+log_file
+scheduler_log_file
}
class DBClient {
+connect()
+close_connection()
}
class TelegramClient {
+send_message(...)
+test_connection()
}
class GoogleGroupsClient {
+connect()
+fetch_email(...)
}
class SupersetClientService {
+login(...)
+get_notices(...)
+get_job_listings(...)
}
DBClient --> Settings : "reads env via os.getenv()"
TelegramClient --> Settings : "reads env via os.getenv()"
GoogleGroupsClient --> Settings : "reads fields"
SupersetClientService --> Settings : "no direct read"
```

### Environment variables and validation rules
The following environment variables are recognized by the Settings model and related components. Required vs optional status is derived from the Settings defaults and client behavior.

- Database
  - MONGO_CONNECTION_STR (required): MongoDB connection URI. Used by DBClient.

- Telegram
  - TELEGRAM_BOT_TOKEN (required): Telegram bot token. Used by TelegramClient.
  - TELEGRAM_CHAT_ID (required): Default chat ID. Used by TelegramClient.

- SuperSet
  - SUPERSET_CREDENTIALS (optional): JSON array of SuperSet credentials. Used by services that scrape SuperSet.

- Google AI (Gemini)
  - GOOGLE_API_KEY (optional): API key for Gemini LLM. Used by LLM-enabled services.

- Email (placement)
  - PLACEMENT_EMAIL (optional): Gmail address for monitoring. Used by GoogleGroupsClient.
  - PLACEMENT_APP_PASSWORD (optional): App password for Gmail. Used by GoogleGroupsClient.

- Web Push (VAPID)
  - VAPID_PRIVATE_KEY (optional): Private key for web push.
  - VAPID_PUBLIC_KEY (optional): Public key for web push.
  - VAPID_EMAIL (optional): Contact email for VAPID.

- Server
  - WEBHOOK_PORT (optional): Port for webhook server. Used by CLI.
  - WEBHOOK_HOST (optional): Host for webhook server. Used by CLI.

- Daemon
  - DAEMON_MODE (optional): Suppress stdout in daemon mode. Used by CLI and logging.

- Logging
  - LOG_LEVEL (optional): Logging level. Used by setup_logging.
  - LOG_FILE (optional): Log file path for bot. Used by setup_logging.
  - SCHEDULER_LOG_FILE (optional): Log file path for scheduler. Used by CLI.

Notes:
- Some variables documented in project docs (e.g., SCHEDULER_ENABLED, UPDATE_SCHEDULE, DEBUG, TESTING, etc.) are not defined in the Settings class shown in the code. They appear to be handled elsewhere or via environment variables consumed directly by services.

### Security best practices for credentials
- Never commit tokens or passwords to version control.
- Use app-specific passwords for email services.
- Limit API key scopes and rotate keys periodically.
- Store secrets externally (e.g., secret managers) and inject via environment variables.
- Restrict filesystem permissions for.env and log files.
- Avoid printing sensitive values; sanitize logs.

[No sources needed since this section provides general guidance]

### Configuration backup strategies
- Maintain separate.env files per environment (development, staging, production).
- Version only non-sensitive defaults; keep secrets out of version control.
- Use CI/CD secret stores to populate environment variables at runtime.
- Periodically audit and rotate secrets.

[No sources needed since this section provides general guidance]

### Environment-Specific configurations
- Development: Local MongoDB, verbose logging, debug flags.
- Staging/Production: Cloud database URIs, restricted log levels, daemon mode, secure secrets management.

[No sources needed since this section provides general guidance]

## Dependency analysis
External dependencies relevant to configuration:
- pydantic-settings: Provides BaseSettings and environment variable loading/validation.
- python-dotenv: Loads.env files.
- pydantic: Provides Field and validation capabilities.

```mermaid
graph LR
PY["pyproject.toml"] --> PS["pydantic-settings"]
PY --> PD["pydantic"]
PY --> PDE["python-dotenv"]
CFG["app/core/config.py"] --> PS
CFG --> PDE
CFG --> PD
```

## Performance considerations
- Settings are cached per-process to avoid repeated.env parsing and validation overhead.
- Logging initialization is performed once; daemon mode avoids console overhead.
- Client-side environment reads are O(1); avoid excessive repeated getenv calls.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing or invalid database connection string:
  - Symptom: Connection errors during DBClient.connect().
  - Action: Verify MONGO_CONNECTION_STR format and credentials; ensure database name is correct.

- Telegram token/chat ID misconfiguration:
  - Symptom: Messages fail to send or rate-limited responses.
  - Action: Confirm TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID values; ensure bot has permissions.

- Email credentials errors:
  - Symptom: IMAP login failures.
  - Action: Verify PLACEMENT_EMAIL and PLACEMENT_APP_PASSWORD; ensure 2FA and app password are configured.

- Daemon logging anomalies:
  - Symptom: Logs not visible or missing after daemonization.
  - Action: Clear settings cache, reinitialize logging, and confirm PID/log file paths.

## Conclusion
The configuration system is centralized, type-safe, and environment-driven. It supports flexible loading from.env and environment variables, with strong defaults and validation. Clients integrate smoothly by reading from Settings or environment variables directly. Adhering to the outlined best practices ensures secure, maintainable, and reliable deployments across environments.
