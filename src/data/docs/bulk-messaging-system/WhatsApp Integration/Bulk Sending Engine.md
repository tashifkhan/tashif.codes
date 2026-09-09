# Bulk sending engine

## Introduction
This page explains the bulk message sending engine implemented in the desktop application. It covers the end-to-end workflow for sending WhatsApp messages and emails in bulk, including contact iteration, message personalization, rate limiting, delivery confirmation, progress monitoring, and error handling. It also provides performance optimization techniques and best practices for large-scale campaigns.

## Project structure
The application is organized as a cross-platform desktop app with:
- Electron main process orchestrating IPC handlers and integrations
- React frontend for user controls and progress display
- Python backend utilities for contact processing and validation
- Local development server and prototype utilities

```mermaid
graph TB
subgraph "Electron Frontend"
UI["React UI<br/>BulkMailer.jsx, WhatsAppForm.jsx"]
Utils["Utils<br/>pyodide.js"]
end
subgraph "Electron Main Process"
Main["IPC Handlers<br/>main.js"]
Gmail["Gmail Handler<br/>gmail-handler.js"]
SMTP["SMTP Handler<br/>smtp-handler.js"]
end
subgraph "Python Backend"
PBApp["Flask API<br/>app.py"]
Ext["Contact Extraction<br/>extract_contacts.py"]
Val["Number Validation<br/>validate_number.py"]
end
subgraph "External Services"
WA["WhatsApp Web"]
GAPI["Gmail API"]
SMTPS["SMTP Server"]
end
UI --> Main
Utils --> PBApp
Main --> Gmail
Main --> SMTP
Main --> WA
Gmail --> GAPI
SMTP --> SMTPS
PBApp --> Ext
PBApp --> Val
```

## Core components
- Electron main process manages WhatsApp client lifecycle, handles IPC events, and coordinates email sending via Gmail API and SMTP.
- React components provide user controls for connecting to WhatsApp, importing contacts, composing messages, and monitoring progress.
- Python backend exposes REST endpoints for contact import and parsing, and standalone utilities for contact extraction and phone number validation.
- Pyodide runtime enables running Python logic directly in the renderer process for manual number parsing.

Key responsibilities:
- Contact ingestion and normalization
- Message personalization
- Rate limiting and throttling
- Delivery confirmation and status tracking
- Error handling and retries

## Architecture overview
The bulk sending engine integrates three channels:
- WhatsApp Web: QR-based authentication, per-contact registration checks, and per-message delays.
- Gmail API: OAuth2-based sending with per-email delays and progress updates.
- SMTP: Transport-based sending with per-email delays and progress updates.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "React UI"
participant Main as "Electron Main"
participant WA as "WhatsApp Client"
participant GAPI as "Gmail API"
participant SMTPS as "SMTP Server"
User->>UI : "Start bulk send"
UI->>Main : "IPC : sendWhatsAppMessages / send-email / smtp-send"
Main->>WA : "Authenticate and connect"
Main->>WA : "Iterate contacts"
WA-->>Main : "isRegisteredUser(chatId)"
alt Registered
Main->>WA : "sendMessage(chatId, personalizedMessage)"
WA-->>Main : "Success"
else Not registered
Main-->>Main : "Mark as failed"
end
Main-->>UI : "Progress updates (sent/failed)"
Note over Main,UI : "Rate limiting delays between attempts"
UI->>Main : "Gmail/SMTP send"
Main->>GAPI : "Send via Gmail API"
Main->>SMTPS : "Send via SMTP"
GAPI-->>Main : "Delivery result"
SMTPS-->>Main : "Delivery result"
Main-->>UI : "Progress updates"
```

## Detailed component analysis

### WhatsApp bulk sending
Workflow:
- Initialize WhatsApp client with local authentication strategy.
- Display QR code for user authentication.
- After authentication, iterate over contacts:
  - Construct chat ID from phone number.
  - Check if the number is registered on WhatsApp.
  - Personalize message using {{name}} placeholder.
  - Send message with a fixed delay between attempts.
- Report completion metrics (sent vs failed).

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant Main as "main.js"
participant WA as "WhatsApp Client"
participant Ext as "Contact Parser"
UI->>Main : "whatsapp-start-client"
Main->>WA : "initialize()"
WA-->>Main : "qr | ready | authenticated"
Main-->>UI : "whatsapp-qr | status"
UI->>Main : "whatsapp-send-messages({contacts, messageText})"
loop For each contact
Main->>WA : "isRegisteredUser(chatId)"
alt Registered
Main->>WA : "sendMessage(chatId, personalizedMessage)"
WA-->>Main : "OK"
Main-->>UI : "whatsapp-send-status : sent"
else Not registered
Main-->>UI : "whatsapp-send-status : not registered"
end
Main-->>UI : "whatsapp-send-status : progress"
end
Main-->>UI : "whatsapp-send-status : summary"
```

Key implementation details:
- Personalization: Replace {{name}} with contact name or default value.
- Registration check: Uses isRegisteredUser(chatId) to avoid sending to unregistered numbers.
- Delays: Fixed delays between attempts to reduce rate limits and detection risk.
- Status reporting: Real-time updates via IPC channels for UI rendering.

### Email bulk sending (gmail API)
Workflow:
- Authenticate via OAuth2 and persist tokens.
- For each recipient:
  - Prepare email payload.
  - Send via Gmail API.
  - Emit progress updates.
  - Apply configurable delay between sends.

```mermaid
sequenceDiagram
participant UI as "BulkMailer.jsx"
participant Main as "main.js"
participant Gmail as "gmail-handler.js"
participant GAPI as "Gmail API"
UI->>Main : "send-email({recipients, subject, message, delay})"
Main->>Gmail : "handleSendEmail(...)"
Gmail->>GAPI : "users.messages.send(raw)"
GAPI-->>Gmail : "200 OK"
Gmail-->>Main : "{recipient, status=sent}"
Main-->>UI : "email-progress : sent"
Gmail-->>Main : "{recipient, status=failed, error}"
Main-->>UI : "email-progress : failed"
```

Key implementation details:
- OAuth2 flow: Generates auth URL, captures authorization code, exchanges for tokens.
- Token persistence: Stores tokens securely for reuse.
- Progress tracking: Emits structured progress events with current/total and per-recipient status.
- Delay-based rate limiting: Applies delay between sends to avoid throttling.

### Email bulk sending (SMTP)
Workflow:
- Validate SMTP configuration.
- Create transport and verify connectivity.
- For each recipient:
  - Build email options (HTML and plain text).
  - Send via SMTP.
  - Emit progress updates.
  - Apply configurable delay between sends.

```mermaid
sequenceDiagram
participant UI as "BulkMailer.jsx"
participant Main as "main.js"
participant SMTP as "smtp-handler.js"
participant Srv as "SMTP Server"
UI->>Main : "smtp-send({smtpConfig, recipients, subject, message, delay})"
Main->>SMTP : "handleSMTPSend(...)"
SMTP->>Srv : "verify() and sendMail()"
Srv-->>SMTP : "OK"
SMTP-->>Main : "{recipient, status=sent}"
Main-->>UI : "email-progress : sent"
SMTP-->>Main : "{recipient, status=failed, error}"
Main-->>UI : "email-progress : failed"
```

Key implementation details:
- Transport verification: Ensures SMTP server readiness before sending.
- Credential handling: Optional saving of non-secret config (host/port/secure/user).
- Progress tracking: Same event-driven pattern as Gmail API.
- Delay-based rate limiting: Consistent throttling across providers.

### Contact processing and validation
The system supports importing contacts from CSV, TXT, and Excel files, and validating/normalizing phone numbers.

```mermaid
flowchart TD
Start(["Upload or Paste Contacts"]) --> Detect["Detect File Type or Text"]
Detect --> FileType{"File Type?"}
FileType --> |CSV/TXT| ParseCSV["Parse Lines and Columns"]
FileType --> |Excel| ParseExcel["Read Sheets and Headers"]
FileType --> |Manual| ParseManual["Pyodide: parse_manual_numbers"]
ParseCSV --> Clean["Clean and Normalize Numbers"]
ParseExcel --> Clean
ParseManual --> Clean
Clean --> Validate["Validate Length and Format"]
Validate --> Filter["Filter Invalid Entries"]
Filter --> Output["Return Normalized Contacts"]
```

Key implementation details:
- CSV/Excel parsing: Heuristically detects phone and name columns.
- TXT parsing: Splits by separators and extracts likely phone numbers.
- Manual parsing: Uses Pyodide to run Python logic in the renderer for quick number extraction.
- Validation: Enforces digit-only length constraints and optional leading plus sign normalization.

### Rate limiting and spam prevention
- WhatsApp:
  - Fixed delays between sending attempts to registered users and between failures.
  - Registration checks prevent sending to unregistered numbers, reducing bounce-related errors.
- Gmail/SMTP:
  - Configurable delay between emails to avoid throttling and rate limits.
  - Progress events allow users to adjust delay dynamically.

Best practices:
- Start with conservative delays and increase gradually based on provider feedback.
- Monitor delivery failures and reduce batch sizes for problematic domains/providers.
- Respect provider-specific rate limits and quotas.

### Delivery confirmation and status tracking
- WhatsApp:
  - Real-time status updates for QR generation, authentication, and per-contact send results.
  - Completion summary with sent and failed counts.
- Gmail/SMTP:
  - Per-email progress events with current/total counters and per-recipient status.
  - Structured failure details for diagnostics.

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant Main as "main.js"
participant WA as "WhatsApp Client"
UI->>Main : "whatsapp-send-messages"
loop For each contact
Main->>WA : "isRegisteredUser"
alt Success
Main->>WA : "sendMessage"
WA-->>Main : "OK"
Main-->>UI : "whatsapp-send-status : sent"
else Failure
Main-->>UI : "whatsapp-send-status : failed"
end
end
Main-->>UI : "whatsapp-send-status : summary"
```

### Retry mechanisms and error recovery
- WhatsApp:
  - Attempts to send to registered users only; failures are recorded and retried on subsequent runs.
  - Disconnection handler resets client state and clears cached files.
- Gmail/SMTP:
  - Per-email failure events include error messages; UI can trigger reattempts selectively.
  - Transport verification helps detect misconfiguration early.

Recommendations:
- Implement explicit retry loops for transient failures.
- Persist partial results to resume interrupted campaigns.
- Provide user controls to pause/resume and adjust retry policies.

## Dependency analysis
External libraries and services:
- Electron: Desktop runtime and IPC
- whatsapp-web.js: WhatsApp Web integration
- googleapis: Gmail API authentication and sending
- nodemailer: SMTP transport
- qrcode: QR code generation for WhatsApp
- Pyodide: Python runtime in the browser for manual number parsing

```mermaid
graph LR
Electron["Electron Main<br/>main.js"] --> WA["whatsapp-web.js"]
Electron --> GAPI["googleapis"]
Electron --> Nodemailer["nodemailer"]
Electron --> QR["qrcode"]
UI["React UI<br/>BulkMailer.jsx"] --> Electron
UI --> Py["Pyodide Runtime<br/>pyodide.js"]
Py --> PyScript["parse_manual_numbers.py"]
```

## Performance considerations
- Concurrency control: Limit simultaneous send operations to respect provider rate limits.
- Batch sizing: Reduce batch size for providers with strict quotas.
- Memory management: Clear cached files and reset client state on disconnects.
- Network resilience: Use exponential backoff for retries and circuit breaker patterns.
- UI responsiveness: Offload heavy tasks to background threads and emit frequent progress updates.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- WhatsApp QR code not loading:
  - Ensure network connectivity and restart the app.
  - Clear cached files and retry initialization.
- Gmail authentication failures:
  - Verify OAuth2 client credentials and ensure Gmail API is enabled.
- SMTP connection issues:
  - Confirm server settings, ports, and TLS configuration.
- Contact import errors:
  - Validate file format and encoding; ensure proper column headers.

## Conclusion
The bulk sending engine integrates WhatsApp Web, Gmail API, and SMTP with reliable contact processing, personalization, rate limiting, and progress monitoring. By using IPC handlers, structured progress events, and provider-specific safeguards, it supports reliable large-scale campaigns while maintaining user control and transparency.
