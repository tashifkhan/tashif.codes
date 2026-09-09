# Gmail & SMTP IPC handlers

## Introduction
This page provides detailed documentation for the Gmail and SMTP IPC handlers in the Electron-based bulk messaging application. It covers:
- Gmail OAuth2 authentication flow initiation, authorization URL generation, and callback handling
- Gmail token retrieval and validation
- Email composition, attachment handling, and batch processing via Gmail API
- SMTP email sending with connection parameters, authentication methods, and queue-like batch processing
- Parameter validation schemas, error handling patterns, and retry mechanisms
- Examples of email template processing, HTML content rendering, and progress tracking
- Security considerations for credential storage and transmission

The handlers are exposed via Electron's IPC mechanism and consumed by React components in the renderer process.

## Project structure
The relevant parts of the project structure for this documentation are:
- Electron main process handlers: gmail-handler.js, smtp-handler.js
- Electron main process registration: main.js
- Preload bridge exposing IPC APIs: preload.js
- Frontend components using the handlers: GmailForm.jsx, SMTPForm.jsx, BulkMailer.jsx
- Application documentation and configuration: README.md, electron/package.json

```mermaid
graph TB
subgraph "Electron Main Process"
MAIN["main.js"]
GH["gmail-handler.js"]
SH["smtp-handler.js"]
end
subgraph "Preload Bridge"
PRELOAD["preload.js"]
end
subgraph "Renderer (React)"
GMF["GmailForm.jsx"]
SMF["SMTPForm.jsx"]
BM["BulkMailer.jsx"]
end
GMF --> PRELOAD
SMF --> PRELOAD
BM --> PRELOAD
PRELOAD --> MAIN
MAIN --> GH
MAIN --> SH
```

## Core components
- Gmail IPC handlers:
  - gmail-auth: Initiates OAuth2 flow, opens authorization window, handles redirect callback, exchanges code for tokens, stores credentials
  - gmail-token: Checks local token availability
  - send-email: Sends emails via Gmail API with progress events and rate limiting
- SMTP IPC handler:
  - smtp-send: Validates SMTP config, creates transport, verifies connectivity, sends emails with progress events and rate limiting
- Frontend integration:
  - Preload exposes invokeable APIs for renderer
  - GmailForm and SMTPForm orchestrate user actions and display progress
  - BulkMailer coordinates form validation and handler invocation

Key runtime dependencies:
- googleapis for Gmail API
- nodemailer for SMTP
- electron-store for secure local storage

## Architecture overview
The IPC architecture follows Electron's model:
- Renderer (React) invokes preload-exposed APIs
- Preload forwards IPC invocations to main process handlers
- Main process handlers perform external operations (OAuth, API calls, SMTP)
- Handlers emit progress events back to renderer via IPC channels

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant PRE as "preload.js"
participant M as "main.js"
participant GH as "gmail-handler.js"
participant GAPI as "Gmail API"
participant STORE as "electron-store"
UI->>PRE : invoke("gmail-auth")
PRE->>M : ipcMain.handle("gmail-auth")
M->>GH : handleGmailAuth()
GH->>GH : create OAuth2 client
GH->>GH : generateAuthUrl()
GH->>UI : open BrowserWindow with authUrl
UI-->>GH : user completes OAuth
GH->>GH : getToken(code)
GH->>STORE : store.set("gmail_token", token)
GH-->>M : {success : true}
M-->>PRE : result
PRE-->>UI : result
```

## Detailed component analysis

### Gmail IPC handlers

#### Handler: gmail-auth
- Purpose: Initiate OAuth2 flow for Gmail
- Steps:
  - Validate environment variables for client ID and secret
  - Create OAuth2 client with configured redirect URI
  - Generate authorization URL with offline access and consent prompt
  - Open BrowserWindow to display authorization page
  - Listen for redirect to capture authorization code
  - Exchange code for tokens and store credentials securely
  - Resolve promise with success/failure result
- Timeout: 5 minutes for OAuth completion
- Error handling: Catches missing env vars, token exchange errors, and window closure

```mermaid
flowchart TD
Start(["Invoke gmail-auth"]) --> CheckEnv["Check GOOGLE_CLIENT_ID/SECRET"]
CheckEnv --> EnvOK{"Env vars present?"}
EnvOK --> |No| ReturnErr["Return error"]
EnvOK --> |Yes| CreateClient["Create OAuth2 client"]
CreateClient --> GenAuthUrl["Generate auth URL"]
GenAuthUrl --> OpenWin["Open BrowserWindow"]
OpenWin --> WaitRedirect["Listen for redirect"]
WaitRedirect --> GotCode{"Received code?"}
GotCode --> |No| CloseWin["Close window<br/>Resolve timeout"]
GotCode --> |Yes| TokenExchange["getToken(code)"]
TokenExchange --> StoreCreds["store.set('gmail_token')"]
StoreCreds --> ResolveSuccess["Resolve success"]
```

#### Handler: gmail-token
- Purpose: Check if a stored token exists
- Behavior: Reads token from electron-store and returns presence flag
- Use case: UI enables/disables Gmail actions based on token presence

#### Handler: send-email
- Purpose: Send bulk emails via Gmail API
- Input schema:
  - recipients: array of email addresses
  - subject: string
  - message: HTML string
  - delay: number (optional, milliseconds)
- Processing:
  - Validates token presence
  - Sets up OAuth2 client with stored token
  - Iterates recipients, emits progress events
  - Constructs MIME message with HTML content-type
  - Sends via gmail.users.messages.send
  - Applies rate limiting delay between emails
- Output schema:
  - success: boolean
  - results: array of { recipient, status, error? }

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant PRE as "preload.js"
participant M as "main.js"
participant GH as "gmail-handler.js"
participant GAPI as "Gmail API"
UI->>PRE : invoke("send-email", payload)
PRE->>M : ipcMain.handle("send-email")
M->>GH : handleSendEmail(event, payload)
GH->>GH : validate token
GH->>GH : setCredentials(token)
GH->>GAPI : users.messages.send(raw)
GAPI-->>GH : response
GH->>UI : event.sender.send("email-progress", {status : "sent"})
GH->>GH : delay if not last
GH-->>M : {success : true, results}
M-->>PRE : result
PRE-->>UI : result
```

### SMTP IPC handler

#### Handler: smtp-send
- Purpose: Send bulk emails via SMTP
- Input schema:
  - smtpConfig: { host, port, secure, user, pass }
  - recipients: array of email addresses
  - subject: string
  - message: HTML string
  - delay: number (optional)
  - saveCredentials: boolean (optional)
- Processing:
  - Validates smtpConfig fields
  - Optionally saves sanitized config to electron-store
  - Creates nodemailer transport with TLS settings
  - Verifies connection via transporter.verify()
  - Iterates recipients, emits progress events
  - Builds mailOptions with HTML and plain text
  - Sends via transporter.sendMail()
  - Applies rate limiting delay between emails
- Output schema:
  - success: boolean
  - results: array of { recipient, status, error? }

```mermaid
flowchart TD
Start(["Invoke smtp-send"]) --> ValidateCfg["Validate smtpConfig fields"]
ValidateCfg --> CfgOK{"Valid?"}
CfgOK --> |No| ReturnErr["Return error"]
CfgOK --> |Yes| SaveCfg["Optionally save config"]
SaveCfg --> CreateTransport["Create nodemailer transport"]
CreateTransport --> Verify["transporter.verify()"]
Verify --> LoopRecips["For each recipient"]
LoopRecips --> BuildMail["Build mailOptions (HTML + text)"]
BuildMail --> SendMail["transporter.sendMail()"]
SendMail --> Progress["event.sender.send('email-progress')"]
Progress --> Delay["Apply delay if not last"]
Delay --> Next{"More recipients?"}
Next --> |Yes| LoopRecips
Next --> |No| ReturnOk["Return {success:true, results}"]
```

### Frontend integration and progress tracking
- Preload exposes:
  - authenticateGmail, getGmailToken, sendEmail
  - sendSMTPEmail
  - onProgress for email-progress events
- GmailForm and SMTPForm:
  - Validate forms and recipients
  - Trigger handler invocations
  - Render activity log with status and errors
- Progress events:
  - Current/total counters
  - Per-recipient status (sending/sent/failed)
  - Error details for failures

## Dependency analysis
External libraries and their roles:
- googleapis: Gmail API client for OAuth2 and sending messages
- nodemailer: SMTP transport creation and email sending
- electron-store: Secure local storage for tokens/configs
- dotenv: Environment variable loading for OAuth credentials

```mermaid
graph LR
GH["gmail-handler.js"] --> GA["googleapis"]
GH --> ES["electron-store"]
SH["smtp-handler.js"] --> NM["nodemailer"]
SH --> ES
PRE["preload.js"] --> MAIN["main.js"]
MAIN --> GH
MAIN --> SH
```

## Performance considerations
- Rate limiting: Both handlers apply configurable delays between emails to avoid throttling and reduce spam risk.
- Batch processing: Iterative loop with per-recipient progress updates ensures visibility and graceful failure handling.
- Connection verification: SMTP handler verifies transport before sending to minimize failures mid-batch.
- Memory footprint: Gmail handler constructs base64-encoded MIME messages; consider message size limits and HTML complexity.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Gmail OAuth timeout or window closed:
  - Increase timeout window or re-initiate authentication
  - Ensure redirect URI matches configured value
- Missing environment variables:
  - Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in.env
- Gmail API errors:
  - Verify OAuth scopes and consent screen configuration
  - Confirm token storage and refresh behavior
- SMTP connection failures:
  - Validate host/port/security settings
  - Use correct authentication credentials
  - Check firewall and TLS settings
- Progress tracking not updating:
  - Ensure onProgress listeners are attached in renderer
  - Verify event channel names match

## Conclusion
The Gmail and SMTP IPC handlers provide reliable, secure, and user-friendly mechanisms for bulk email sending. They integrate smoothly with Electron's IPC model, offer detailed error handling and progress tracking, and adhere to security best practices for credential storage and transmission. The frontend components deliver a polished user experience with real-time feedback and validation.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Parameter validation schemas
- Gmail send-email input:
  - recipients: array<string>
  - subject: string
  - message: string (HTML)
  - delay?: number (default 1000 ms)
- SMTP send-email input:
  - smtpConfig: { host, port, secure, user, pass }
  - recipients: array<string>
  - subject: string
  - message: string (HTML)
  - delay?: number (default 1000 ms)
  - saveCredentials?: boolean

### Security considerations
- OAuth2 credentials:
  - Stored in environment variables; loaded via dotenv
  - Tokens stored in electron-store; avoid logging sensitive data
- SMTP credentials:
  - Passwords are not saved to disk; only sanitized config is persisted
- Transport security:
  - TLS settings configured; self-signed certificate handling included
- UI isolation:
  - Context isolation enabled; preload bridge restricts exposed APIs

### Example workflows
- Gmail OAuth2 flow:
  - User clicks "Authenticate Gmail"
  - App opens authorization window
  - User grants consent and receives code
  - App exchanges code for tokens and stores them
- Bulk email sending (Gmail):
  - User enters recipients, subject, and HTML message
  - App invokes send-email with delay
  - App displays per-recipient progress and final results
- Bulk email sending (SMTP):
  - User configures SMTP settings and imports recipients
  - App validates config and verifies transport
  - App sends emails with HTML and plain text variants
