# Security implementation

## Introduction
This page provides detailed security documentation for the desktop application. It focuses on the Electron security model, preload script security, secure IPC communication, OAuth2 authentication security for Gmail API, SMTP credential security, input validation and sanitization strategies, sandboxing and privilege separation, API key management, and compliance considerations for data protection.

## Project structure
The application is an Electron desktop app with a React UI. Security-relevant areas include:
- Electron main process and preload bridge
- Gmail and SMTP handlers for secure credential handling and API communication
- Frontend forms and validation logic
- Python integration via Pyodide for number parsing

```mermaid
graph TB
subgraph "Electron Main Process"
M["main.js<br/>BrowserWindow config, IPC handlers"]
U["utils.js<br/>isDev()"]
end
subgraph "Preload Bridge"
P["preload.js<br/>contextBridge exposeInMainWorld()"]
end
subgraph "Handlers"
GH["gmail-handler.js<br/>OAuth2, token storage"]
SH["smtp-handler.js<br/>SMTP transport, saved config"]
end
subgraph "UI"
BM["BulkMailer.jsx<br/>form orchestration"]
GF["GmailForm.jsx<br/>Gmail controls"]
SF["SMTPForm.jsx<br/>SMTP controls"]
WF["WhatsAppForm.jsx<br/>WhatsApp controls"]
PY["pyodide.js<br/>Pyodide loader"]
end
M --> P
P --> GH
P --> SH
BM --> GF
BM --> SF
BM --> WF
WF --> PY
```

## Core components
- Electron security model: context isolation enabled, remote module disabled, preload bridge exposes only explicit APIs.
- Secure IPC: handlers registered via ipcMain.handle; renderer communicates via ipcRenderer.invoke/on.
- Gmail OAuth2: environment-based client credentials, offline token retrieval, local token persistence.
- SMTP: credential handling with optional encrypted storage of non-secret config; TLS verification.
- Input validation: frontend form validation for email formats and required fields.
- Privilege separation: main process handles sensitive operations; renderer only triggers via bridge.

## Architecture overview
The Electron app enforces a strict security boundary between the renderer and main process. The preload script creates a controlled API surface exposed to the renderer. Handlers in the main process manage sensitive operations like OAuth2 and SMTP transport.

```mermaid
sequenceDiagram
participant R as "Renderer (React)"
participant PB as "Preload Bridge"
participant MP as "Main Process"
participant GH as "Gmail Handler"
participant SH as "SMTP Handler"
R->>PB : invoke("gmail-auth")
PB->>MP : ipcRenderer.invoke("gmail-auth")
MP->>GH : handleGmailAuth()
GH-->>MP : {success, error?}
MP-->>PB : result
PB-->>R : result
R->>PB : invoke("send-email", payload)
PB->>MP : ipcRenderer.invoke("send-email", payload)
MP->>GH : handleSendEmail(event, payload)
GH-->>MP : {success, results}
MP-->>PB : result
PB-->>R : result
```

## Detailed component analysis

### Electron security model and preload script security
- Context isolation is enabled in BrowserWindow webPreferences.
- Remote module is disabled.
- Preload script exposes a minimal API surface via contextBridge.
- Renderer invokes IPC only through explicitly exposed methods.

Recommendations:
- Keep preload minimal and review for unintended exposure.
- Avoid exposing Node.js globals or filesystem APIs.
- Validate and sanitize all IPC payloads in main process handlers.

### Secure IPC communication
- Handlers registered via ipcMain.handle for Gmail, SMTP, and WhatsApp.
- Renderer uses ipcRenderer.invoke for requests and ipcRenderer.on for events.
- Event-driven progress updates for long-running tasks.

Security considerations:
- Validate and sanitize all handler inputs.
- Limit handler scope to necessary operations.
- Avoid leaking internal state via events.

### OAuth2 authentication security for gmail API
- Client ID and secret loaded from environment variables.
- Offline token requested with consent prompt to obtain refresh token.
- Token stored locally using electron-store.
- Auth window configured with context isolation and no node integration.

Security considerations:
- Environment variables must be managed securely outside the app bundle.
- Redirect URI is localhost; ensure no unintended exposure.
- Token storage is local; consider OS keychain integration for production.
- Implement token refresh logic if needed; current implementation relies on stored token.

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant PB as "preload.js"
participant MP as "main.js"
participant GH as "gmail-handler.js"
UI->>PB : invoke("gmail-auth")
PB->>MP : ipcRenderer.invoke("gmail-auth")
MP->>GH : handleGmailAuth()
GH->>GH : create OAuth2 client
GH->>GH : generateAuthUrl(prompt=consent)
GH-->>MP : {success : true/false, error?}
MP-->>PB : result
PB-->>UI : result
```

### Token storage and refresh mechanisms
- Tokens persisted via electron-store under a dedicated key.
- No automatic refresh logic present; relies on stored token validity.
- Consider implementing token refresh using the stored token and persisting refreshed credentials.

Best practices:
- Encrypt stored tokens at rest.
- Rotate tokens periodically.
- Implement reliable error handling for token expiry.

### SMTP credential security
- Credentials passed to handler via IPC; password is not saved to disk.
- Optional saving of non-secret SMTP config (host, port, secure, user).
- TLS verification performed; rejectUnauthorized configurable.

Security considerations:
- Avoid storing passwords in memory longer than necessary.
- Consider encrypting saved SMTP config if persisted.
- Ensure TLS is enabled for production SMTP servers.

### Input validation and sanitization strategies
- Frontend validation checks:
  - Required fields for recipients, subject, and message.
  - Basic email format validation using regex.
- Renderer orchestrates validation before invoking handlers.

Recommendations:
- Apply backend validation in handlers as a secondary check.
- Sanitize user inputs before constructing emails or messages.
- Enforce rate limits and input size caps.

### Sandbox and privilege separation
- Renderer runs in isolated context with preload bridge.
- Main process performs privileged operations (OAuth, SMTP, file dialogs).
- Puppeteer launched with restricted arguments; headless mode enabled.

Recommendations:
- Keep main process handlers minimal and focused.
- Avoid enabling nodeIntegration in BrowserWindow.
- Review puppeteer arguments for least privilege.

### Network communication security
- Gmail API via official client library.
- SMTP via nodemailer with TLS verification.
- QR code generation handled locally; no external rendering of QR images.

Recommendations:
- Pin TLS certificates for SMTP servers.
- Monitor and log network errors.
- Consider adding certificate pinning for critical endpoints.

### Python integration security (pyodide)
- Pyodide dynamically loaded from CDN.
- Python script fetched and executed safely.
- Input sanitized before passing to Python.

Recommendations:
- Verify CDN integrity if required.
- Limit Python script scope and validate inputs rigorously.
- Consider offline packaging of trusted scripts.

## Dependency analysis
Key runtime dependencies relevant to security:
- electron-store: local encrypted storage abstraction
- googleapis: OAuth2 and Gmail API client
- nodemailer: SMTP transport with TLS
- whatsapp-web.js: WhatsApp client with LocalAuth

```mermaid
graph LR
Pkg["package.json"]
ES["electron-store"]
GA["googleapis"]
NM["nodemailer"]
WWA["whatsapp-web.js"]
Pkg --> ES
Pkg --> GA
Pkg --> NM
Pkg --> WWA
```

## Performance considerations
- Rate limiting delays between sends to avoid throttling.
- Asynchronous processing with progress events.
- QR code generation occurs in main process to keep renderer responsive.

Recommendations:
- Tune delay parameters based on provider limits.
- Batch operations where feasible.
- Monitor memory usage during mass operations.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and mitigations:
- Authentication timeouts: increase timeout window or retry mechanism.
- OAuth errors: verify client credentials and redirect URI.
- SMTP verification failures: check server configuration and TLS settings.
- Renderer API not available: ensure preload bridge is loaded and Electron environment is active.

## Conclusion
The application implements a strong Electron security foundation with context isolation, a minimal preload bridge, and secure IPC. Gmail OAuth2 and SMTP operations are encapsulated in main-process handlers with careful credential handling. Frontend validation and rate limiting help prevent abuse. For production hardening, consider OS keychain integration for tokens, encrypted storage for SMTP configs, stricter TLS policies, and detailed error logging.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Security best practices checklist
- Manage secrets via environment variables or OS keychain.
- Encrypt sensitive data at rest.
- Enforce HTTPS and certificate pinning where applicable.
- Validate and sanitize all inputs.
- Implement rate limiting and circuit breakers.
- Regularly audit dependencies and update versions.
- Conduct periodic security reviews and penetration testing.

[No sources needed since this section provides general guidance]
