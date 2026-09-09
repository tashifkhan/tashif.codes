# Credential storage and encryption

## Introduction
This page explains how the application securely stores and manages credentials across all authentication methods. It focuses on:
- Use of electron-store for secure credential persistence
- Data serialization and access control
- Encryption strategies for sensitive data, token obfuscation, and secure configuration management
- Lifecycle management of credentials: creation, validation, rotation, and secure deletion
- Security patterns for API keys, OAuth tokens, and SMTP credentials
- Best practices for backup, recovery, and secure sharing between application instances

The project's README explicitly mentions encrypted storage as a security feature, and the Electron main process integrates electron-store to persist tokens and configurations.

## Project structure
The credential-related logic spans the Electron main process, preload bridge, and handler modules:
- Electron main process initializes the app, sets up IPC handlers, and manages cleanup.
- Preload exposes a controlled API surface to the renderer via contextBridge.
- Handler modules encapsulate authentication flows and credential persistence.

```mermaid
graph TB
subgraph "Electron Main Process"
MAIN["main.js"]
UTILS["utils.js"]
end
subgraph "Preload Bridge"
PRELOAD["preload.js"]
end
subgraph "Handlers"
GH["gmail-handler.js"]
SM["smtp-handler.js"]
end
MAIN --> PRELOAD
MAIN --> GH
MAIN --> SM
PRELOAD --> GH
PRELOAD --> SM
```

## Core components
- Electron main process: registers IPC handlers for Gmail, SMTP, and WhatsApp; manages app lifecycle and cleanup.
- Preload bridge: exposes a minimal, typed API to renderer code via contextBridge.
- Gmail handler: orchestrates OAuth2 flow, validates environment variables, persists tokens, and sends emails.
- SMTP handler: validates configuration, optionally persists non-sensitive config, and sends emails.

Key security-relevant points:
- electron-store is used for persistent storage of tokens and configurations.
- Environment variables are required for OAuth2 client credentials.
- Passwords are not persisted in SMTP configuration; only non-sensitive fields are saved.

## Architecture overview
The credential lifecycle is orchestrated through IPC from the renderer to the main process, which interacts with external services and persists tokens securely.

```mermaid
sequenceDiagram
participant UI as "Renderer UI"
participant PB as "Preload Bridge"
participant MP as "Electron Main"
participant GH as "Gmail Handler"
participant ST as "Store (electron-store)"
UI->>PB : "authenticateGmail()"
PB->>MP : "invoke('gmail-auth')"
MP->>GH : "handleGmailAuth()"
GH->>GH : "validate env vars"
GH->>GH : "generate OAuth2 URL"
GH-->>UI : "auth window opened"
UI->>GH : "OAuth redirect with code"
GH->>GH : "exchange code for token"
GH->>ST : "store.set('gmail_token', token)"
GH-->>PB : "{success : true}"
PB-->>UI : "{success : true}"
UI->>PB : "getGmailToken()"
PB->>MP : "invoke('gmail-token')"
MP->>GH : "handleGmailToken()"
GH->>ST : "store.get('gmail_token')"
GH-->>PB : "{success : true, hasToken : true}"
PB-->>UI : "{success : true, hasToken : true}"
```

## Detailed component analysis

### Electron main process and IPC
- Registers IPC handlers for Gmail, SMTP, and WhatsApp.
- Exposes renderer-safe methods via preload bridge.
- Performs cleanup on app close and logout, including deletion of cached files.

Security implications:
- Centralized IPC registration reduces attack surface in renderer.
- Cleanup routines remove cached authentication artifacts.

### Preload bridge (secure IPC)
- Exposes a typed API surface to renderer code.
- Uses contextBridge to isolate Node.js APIs from renderer.

Security implications:
- Prevents direct access to Node.js modules from renderer.
- Reduces risk of prototype pollution and remote code execution.

### Gmail handler: OAuth2 and token persistence
Responsibilities:
- Validates environment variables for OAuth2 client credentials.
- Generates OAuth2 authorization URL and opens an embedded browser window.
- Handles redirects, extracts authorization code, exchanges for token, and persists it.
- Retrieves stored token for subsequent operations.

Data persistence:
- Uses electron-store to save the token under a dedicated key.
- Token is retrieved from store when sending emails.

Access control:
- Renderer invokes via preload bridge; main process validates and performs OAuth.
- No sensitive data is exposed to renderer.

```mermaid
flowchart TD
Start(["Start Gmail Auth"]) --> CheckEnv["Check GOOGLE_CLIENT_ID<br/>and GOOGLE_CLIENT_SECRET"]
CheckEnv --> EnvOK{"Env vars present?"}
EnvOK --> |No| ReturnErr["Return error to renderer"]
EnvOK --> |Yes| CreateOAuth["Create OAuth2 client"]
CreateOAuth --> GenURL["Generate auth URL"]
GenURL --> OpenWin["Open auth window"]
OpenWin --> Redirect{"Redirect to callback?"}
Redirect --> |No| Timeout["Timeout or window closed"]
Redirect --> |Yes| ExtractCode["Extract authorization code"]
ExtractCode --> Exchange["Exchange code for token"]
Exchange --> Persist["store.set('gmail_token', token)"]
Persist --> Done(["Auth success"])
```

### SMTP handler: configuration and credential handling
Responsibilities:
- Validates SMTP configuration fields.
- Optionally persists non-sensitive configuration (host, port, secure, user).
- Sends emails using nodemailer with provided credentials.
- Does not persist passwords.

Data persistence:
- Non-sensitive SMTP config is saved to store for convenience.
- Password remains in memory only.

Access control:
- Renderer passes credentials directly to main process for immediate use.
- No long-term storage of secrets.

### WhatsApp client: local authentication
- Uses LocalAuth strategy for session persistence.
- Clears cached files on startup and logout.
- Emits QR codes and status events to renderer.

Security implications:
- Session files are managed by the library; app cleans them on logout.
- QR generation occurs in main process; renderer receives only data URLs.

## Dependency analysis
External libraries involved in credential handling:
- electron-store: persistent key-value store for tokens and non-sensitive configs.
- googleapis: OAuth2 client and Gmail API integration.
- nodemailer: SMTP transport and email sending.
- whatsapp-web.js: WhatsApp Web session management with LocalAuth.

```mermaid
graph LR
GH["gmail-handler.js"] --> GS["googleapis"]
GH --> ES["electron-store"]
SM["smtp-handler.js"] --> NM["nodemailer"]
SM --> ES
MAIN["main.js"] --> WWA["whatsapp-web.js"]
MAIN --> ES
```

## Performance considerations
- Token retrieval and persistence: electron-store operations are lightweight but should be minimized during high-throughput sending.
- Rate limiting: Both Gmail and SMTP handlers include configurable delays to avoid throttling and improve reliability.
- Memory usage: Avoid keeping large credential objects in memory beyond their use window.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common credential-related issues and resolutions:
- Missing environment variables for Gmail OAuth2:
  - Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in the environment.
- Gmail authentication failures:
  - Verify OAuth consent screen configuration and that the redirect URI matches expectations.
- SMTP configuration errors:
  - Confirm host, port, user, and pass are provided; secure flag matches server requirements.
- WhatsApp logout and cache cleanup:
  - Use the logout IPC to clear session and cached files; errors are handled gracefully.

## Conclusion
The application employs a layered approach to credential security:
- electron-store persists tokens and non-sensitive configurations.
- OAuth2 is handled in the main process with environment-controlled client credentials.
- SMTP credentials are passed directly to the main process without persistent storage of passwords.
- Cleanup routines ensure cached authentication artifacts are removed on logout and app exit.

These practices align with secure defaults: minimize persistent secrets, keep sensitive data in memory, and centralize credential operations in the main process.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Best practices for credential lifecycle
- Creation
  - Use environment variables for OAuth2 client credentials.
  - Persist only non-sensitive configuration; avoid saving passwords.
- Validation
  - Validate configuration fields before establishing connections.
  - Verify token presence and freshness before sending.
- Rotation
  - Re-authenticate via OAuth2 when tokens expire or scopes change.
  - Rotate SMTP credentials periodically and update stored non-sensitive config.
- Secure Deletion
  - Clear tokens and cached files on logout and app shutdown.
  - Remove temporary authentication artifacts.

### Backup and recovery procedures
- Back up the electron-store database location (platform-dependent) along with any exported non-sensitive configurations.
- Recovery involves restoring the store and re-authenticating via OAuth2 if necessary.
- For SMTP, re-enter passwords upon restoration.

### Secure sharing between instances
- Avoid sharing persistent credentials across instances; each instance should authenticate independently.
- Use environment variables and local store per-user profile.
- For multi-instance deployments, manage credentials centrally with secure secret management systems outside the app.

[No sources needed since this section provides general guidance]
